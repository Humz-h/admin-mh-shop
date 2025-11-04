import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, shareReplay, timeout, retryWhen, delay, take, switchMap } from 'rxjs/operators';

interface CacheEntry {
  data: Product[] | Product | ProductResponse;
  timestamp: number;
}

interface HttpError extends Error {
  status?: number;
  originalError?: unknown;
  error?: unknown;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  originalPrice?: number;
  salePrice?: number;
  price: number;
  imageUrl: string;
  status: boolean;
  category: string;
  productGroup?: string;
  productCode: string;
  stock: number;
  createdAt?: string | Date;
  productDetails?: ProductDetail[];
  productVariants?: ProductVariant[];
}

export interface ProductDetail {
  id: number;
  productId: number;
  brand: string;
  origin: string;
  warranty: string;
  specifications: string;
  features: string;
  additionalInfo: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  product?: string;
}

export interface ProductVariant {
  id: number;
  productId: number;
  variantName: string;
  attributes: string;
  price: number;
  sku: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  product?: string;
}

export interface ProductResponse {
  data: Product[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'http://localhost:5000/api/products';
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 phút
  private loadingStates = new Map<string, Observable<Product[]>>(); // Tránh duplicate requests
  private readonly http = inject(HttpClient);

  // Lấy tất cả sản phẩm với cache
  getAllProducts(): Observable<Product[]> {
    const cacheKey = 'all_products';
    const cached = this.getCachedData(cacheKey);
    
    if (cached && Array.isArray(cached)) {
      console.log('Using cached products:', cached.length);
      return of(cached);
    }

    // Kiểm tra xem có request đang chạy không
    if (this.loadingStates.has(cacheKey)) {
      console.log('Request already in progress, returning existing observable');
      return this.loadingStates.get(cacheKey)!;
    }

    console.log('Fetching products from API...');
    const request$ = this.http.get<Product[]>(`${this.apiUrl}?page=1&pageSize=20`).pipe(
      timeout(10000), // 10 giây timeout
      map(products => {
        console.log('Products loaded from API:', products.length);
        // Map dữ liệu từ API response để đảm bảo tương thích
        const mappedProducts = products.map(product => ({
          ...product,
          imageUrl: product.imageUrl && 
                   product.imageUrl.trim() !== '' && 
                   !product.imageUrl.includes('placeholder.com') &&
                   !product.imageUrl.includes('via.placeholder.com') &&
                   (product.imageUrl.startsWith('http') || product.imageUrl.startsWith('/'))
                   ? product.imageUrl 
                   : '', // Để trống thay vì placeholder URL
          status: product.status !== undefined ? product.status : true
        }));
        this.setCachedData(cacheKey, mappedProducts);
        this.loadingStates.delete(cacheKey); // Xóa loading state
        return mappedProducts;
      }),
      shareReplay(1),
      catchError(error => {
        console.error('Error loading products:', error);
        this.loadingStates.delete(cacheKey); // Xóa loading state
        return of([]);
      })
    );

    this.loadingStates.set(cacheKey, request$);
    return request$;
  }

  // Lấy sản phẩm với pagination
  getProductsPaginated(page: number = 1, limit: number = 10, search?: string): Observable<ProductResponse> {
    const cacheKey = `products_page_${page}_limit_${limit}_search_${search || ''}`;
    const cached = this.getCachedProductResponse(cacheKey);
    
    if (cached) {
      return of(cached);
    }

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', limit.toString());
    
    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<Product[]>(this.apiUrl, { params }).pipe(
      map(products => {
        const response: ProductResponse = {
          data: products,
          total: products.length,
          page,
          limit
        };
        this.setCachedData(cacheKey, response);
        return response;
      }),
      shareReplay(1),
      catchError(error => {
        console.error('Error loading paginated products:', error);
        // Fallback to getAllProducts if pagination not supported
        return this.getAllProducts().pipe(
          map(products => ({
            data: products.slice((page - 1) * limit, page * limit),
            total: products.length,
            page,
            limit
          }))
        );
      })
    );
  }

  // Lấy sản phẩm theo ID với cache
  getProductById(id: number): Observable<Product> {
    const cacheKey = `product_${id}`;
    const cached = this.getCachedSingleProduct(cacheKey);
    
    if (cached) {
      return of(cached);
    }

    return this.http.get<Product>(`${this.apiUrl}/${id}`).pipe(
      map(product => {
        this.setCachedData(cacheKey, product);
        return product;
      }),
      shareReplay(1),
      catchError(error => {
        console.error('Error loading product:', error);
        return of({} as Product);
      })
    );
  }

  // Tạo sản phẩm mới
  createProduct(product: Omit<Product, 'id'> & { productGroup?: string }): Observable<Product> {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Chuẩn bị dữ liệu để gửi lên server với validation
    const productGroup = product.productGroup?.trim() || 'Sản phẩm';
    const productData = {
      name: product.name?.trim() || '',
      description: product.description?.trim() || '',
      originalPrice: Number(product.originalPrice) || 0,
      salePrice: Number(product.salePrice) || 0,
      price: Number(product.price) || 0,
      imageUrl: product.imageUrl?.trim() || '',
      status: product.status !== undefined ? product.status : true,
      category: product.category?.trim() || 'Điện tử',
      productGroup: productGroup,
      productCode: product.productCode?.trim() || `PRD-${Date.now()}`,
      stock: Number(product.stock) || 0,
      productDetails: product.productDetails || [],
      productVariants: product.productVariants || []
    };
    
    // Validate dữ liệu trước khi gửi - linh hoạt hơn
    if (!productData.name) {
      throw new Error('Product name is required');
    }
    if (productData.price < 0) {
      throw new Error('Product price cannot be negative');
    }
    if (productData.stock < 0) {
      throw new Error('Product stock cannot be negative');
    }
    
    console.log('Creating product with data:', productData);
    console.log('ImageUrl being sent:', productData.imageUrl);
    console.log('Data types:', {
      name: typeof productData.name,
      description: typeof productData.description,
      price: typeof productData.price,
      stock: typeof productData.stock,
      imageUrl: typeof productData.imageUrl
    });
    
    return this.http.post<Product>(this.apiUrl, productData, { headers }).pipe(
      map(newProduct => {
        console.log('Product created successfully:', newProduct);
        this.clearCache(); // Clear cache after creating
        return newProduct;
      }),
      catchError(error => {
        console.error('Error creating product:', error);
        console.error('Error details:', {
          status: error.status,
          message: error.message,
          error: error.error,
          requestData: productData
        });
        
        // Enhanced error handling với thông báo chi tiết
        let errorMessage = 'Create failed';
        if (error.status === 400) {
          errorMessage = 'Invalid data format or missing required fields';
        } else if (error.status === 401) {
          errorMessage = 'Unauthorized access. Please check your permissions.';
        } else if (error.status === 500) {
          errorMessage = 'Server error occurred';
        } else if (error.status === 0) {
          errorMessage = 'Network connection failed';
        }
        
        // Tạo error object với thông tin đầy đủ
        const enhancedError = new Error(errorMessage) as HttpError;
        enhancedError.status = error.status;
        enhancedError.originalError = error;
        enhancedError.error = error.error;
        throw enhancedError;
      })
    );
  }

  // Cập nhật sản phẩm với validation cải tiến
  updateProduct(id: number, product: Partial<Product>): Observable<Product> {
    console.log('ProductService: Updating product with ID:', id);
    console.log('ProductService: Update data:', product);
    
    // Validate input
    if (!id || id <= 0) {
      throw new Error('Invalid product ID');
    }
    
    if (!product || Object.keys(product).length === 0) {
      throw new Error('No product data provided');
    }
    
    // Validation chi tiết từng field - linh hoạt hơn
    if (!product.name || product.name.trim().length === 0) {
      throw new Error('Product name is required');
    }
    
    if (product.price === undefined || product.price === null) {
      throw new Error('Valid price is required');
    }
    
    if (product.stock === undefined || product.stock === null) {
      throw new Error('Valid stock quantity is required');
    }
    
    // Chuẩn bị dữ liệu với validation đầy đủ
    const updateData = {
      name: product.name.trim(),
      description: product.description?.trim() || '',
      originalPrice: Number(product.originalPrice) || 0,
      salePrice: Number(product.salePrice) || 0,
      price: Number(product.price),
      imageUrl: product.imageUrl?.trim() || '',
      status: product.status !== undefined ? product.status : true,
      category: product.category?.trim() || 'Điện tử',
      productGroup: product.productGroup?.trim() || 'Sản phẩm',
      productCode: product.productCode?.trim() || `PRD-${Date.now()}`,
      stock: Number(product.stock),
      productDetails: product.productDetails || [],
      productVariants: product.productVariants || []
    };
    
    // Validate final data trước khi gửi - linh hoạt hơn
    if (updateData.name.length < 2) {
      throw new Error('Product name must be at least 2 characters');
    }
    
    if (updateData.price < 0) {
      throw new Error('Price cannot be negative');
    }
    
    if (updateData.stock < 0) {
      throw new Error('Stock cannot be negative');
    }
    
    console.log('ProductService: Final update data:', updateData);
    console.log('ImageUrl being sent:', updateData.imageUrl);
    console.log('ProductService: Data types:', {
      name: typeof updateData.name,
      description: typeof updateData.description,
      price: typeof updateData.price,
      stock: typeof updateData.stock,
      imageUrl: typeof updateData.imageUrl
    });
    console.log('ProductService: Data values:', {
      name: updateData.name,
      description: updateData.description,
      price: updateData.price,
      stock: updateData.stock,
      imageUrl: updateData.imageUrl
    });
    console.log('ProductService: API URL:', `${this.apiUrl}/${id}`);
    
    // Thêm headers cho authentication
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    return this.http.put<Product>(`${this.apiUrl}/${id}`, updateData, { headers, observe: 'response' }).pipe(
      switchMap((response: HttpResponse<Product>) => {
        // Nếu response có body (status 200), sử dụng body đó
        if (response.body) {
          this.clearCache();
          return of(response.body);
        }
        
        // Nếu response không có body (status 204), gọi GET để lấy dữ liệu mới
        if (response.status === 204 || !response.body) {
          this.clearCache();
          return this.getProductById(id).pipe(
            map(updatedProduct => {
              return updatedProduct;
            })
          );
        }
        
        // Trường hợp khác, tạo Product từ request data
        const updatedProduct: Product = {
          id: id,
          name: updateData.name,
          description: updateData.description,
          originalPrice: updateData.originalPrice,
          salePrice: updateData.salePrice,
          price: updateData.price,
          imageUrl: updateData.imageUrl,
          status: updateData.status,
          category: updateData.category,
          productGroup: updateData.productGroup,
          productCode: updateData.productCode,
          stock: updateData.stock,
          productDetails: updateData.productDetails,
          productVariants: updateData.productVariants
        };
        return of(updatedProduct);
      }),
      catchError(error => {
        // Enhanced error handling
        let errorMessage = 'Update failed';
        if (error.status === 400) {
          errorMessage = 'Invalid data format or missing required fields';
        } else if (error.status === 401) {
          errorMessage = 'Unauthorized access. Please check your permissions.';
        } else if (error.status === 404) {
          errorMessage = 'Product not found';
        } else if (error.status === 500) {
          errorMessage = 'Server error occurred';
        }
        
        const enhancedError = new Error(errorMessage) as HttpError;
        enhancedError.originalError = error;
        throw enhancedError;
      })
    );
  }

  // Xóa sản phẩm
  deleteProduct(id: number): Observable<void> {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': '*/*'
    };
    
    // Sử dụng endpoint với chữ P hoa (Products) để khớp với API
    const deleteUrl = `http://localhost:5000/api/Products/${id}`;
    
    return this.http.delete(deleteUrl, { headers, observe: 'response', responseType: 'json' }).pipe(
      map((response) => {
        this.clearCache(); // Clear cache after deleting
        
        // Xóa thành công nếu status là 200, 204, hoặc không có lỗi
        if (response.status === 200 || response.status === 204 || !response.body) {
          return;
        }
        
        return;
      }),
      catchError(error => {
        // Xử lý lỗi từ server (có thể là text/plain hoặc JSON)
        let errorMessage = 'Không thể xóa sản phẩm';
        
        // Xử lý error response
        if (error.error) {
          // Nếu error.error là string (text/plain response)
          if (typeof error.error === 'string') {
            errorMessage = error.error;
            
            // Xử lý các lỗi SQL phổ biến
            if (error.error.includes("Invalid object name") || error.error.includes("CartItems")) {
              errorMessage = 'Lỗi database: Bảng CartItems chưa được tạo. Vui lòng liên hệ quản trị viên để kiểm tra database.';
            }
          } 
          // Nếu error.error là object (JSON response)
          else if (typeof error.error !== null && typeof error.error === 'object') {
            // Kiểm tra các field có thể chứa error message
            const errorObj = error.error as any;
            
            if (errorObj.message) {
              errorMessage = errorObj.message;
              
              // Xử lý lỗi SQL trong message
              if (errorObj.message.includes("Invalid object name") || errorObj.message.includes("CartItems")) {
                errorMessage = 'Lỗi database: Bảng CartItems chưa được tạo. Vui lòng liên hệ quản trị viên để kiểm tra database.';
              }
            } else if (errorObj.error) {
              errorMessage = typeof errorObj.error === 'string' ? errorObj.error : errorObj.error.message || errorMessage;
            } else if (errorObj.title) {
              errorMessage = errorObj.title;
            } else if (errorObj.detail) {
              errorMessage = errorObj.detail;
            } else if (errorObj.type) {
              errorMessage = errorObj.type;
            }
          }
        }
        
        // Thêm thông tin status code vào message nếu có
        if (error.status) {
          if (error.status === 500) {
            // Nếu chưa có message chi tiết, dùng message mặc định
            if (errorMessage === 'Không thể xóa sản phẩm') {
              errorMessage = 'Lỗi server khi xóa sản phẩm. Có thể sản phẩm đang được sử dụng ở đơn hàng hoặc giỏ hàng. Vui lòng thử lại sau.';
            }
          }
        }
        
        // Enhanced error với thông tin chi tiết
        const enhancedError = new Error(errorMessage) as HttpError;
        enhancedError.status = error.status;
        enhancedError.originalError = error;
        enhancedError.error = error.error;
        
        throw enhancedError;
      })
    );
  }

  // Cache management
  private getCachedData(key: string): Product[] | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      const data = cached.data;
      if (Array.isArray(data)) {
        return data;
      }
    }
    this.cache.delete(key);
    return null;
  }

  private getCachedProductResponse(key: string): ProductResponse | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      const data = cached.data;
      if (data && typeof data === 'object' && 'data' in data && 'total' in data) {
        return data as ProductResponse;
      }
    }
    this.cache.delete(key);
    return null;
  }

  private getCachedSingleProduct(key: string): Product | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      const data = cached.data;
      if (data && typeof data === 'object' && !Array.isArray(data) && !('data' in data)) {
        return data as Product;
      }
    }
    this.cache.delete(key);
    return null;
  }

  private setCachedData(key: string, data: Product[] | Product | ProductResponse): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private clearCache(): void {
    this.cache.clear();
  }

  // Clear specific cache entry
  clearProductCache(id?: number): void {
    if (id) {
      this.cache.delete(`product_${id}`);
    } else {
      this.clearCache();
    }
  }

  // Upload ảnh lên server
  uploadImage(formData: FormData): Observable<{ imageUrl: string }> {
    return this.http.post<{ imageUrl: string }>(`${this.apiUrl}/images/upload`, formData);
  }





  // Retry mechanism với exponential backoff
  private retryWithBackoff(maxRetries: number = 3, delayMs: number = 1000) {
    return retryWhen(errors => 
      errors.pipe(
        delay(delayMs),
        take(maxRetries),
        catchError(err => throwError(err))
      )
    );
  }
}