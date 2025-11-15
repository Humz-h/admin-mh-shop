import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError, forkJoin } from 'rxjs';
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

export interface ProductDetailApiResponse {
  success: boolean;
  data: ProductDetail[];
  message?: string;
}

export interface ProductDetailCreateUpdate {
  productId: number;
  brand: string;
  origin: string;
  warranty: string;
  specifications: string;
  features: string;
  additionalInfo: string;
}

export interface ProductVariantApiResponse {
  success: boolean;
  data: ProductVariant[];
  message?: string;
}

export interface ProductVariantCreateUpdate {
  productId: number;
  variantName: string;
  attributes: string;
  price: number;
  sku: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'http://localhost:5000/api/products';
  private productDetailsApiUrl = 'http://localhost:5000/api/ProductDetails';
  private productVariantsApiUrl = 'http://localhost:5000/api/ProductVariants';
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 phút
  private loadingStates = new Map<string, Observable<Product[]>>(); // Tránh duplicate requests
  private readonly http = inject(HttpClient);

  // Lấy tất cả sản phẩm với cache (không giới hạn số lượng)
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

    console.log('Fetching all products from API...');
    
    // Helper function để map products
    const mapProducts = (products: Product[]): Product[] => {
      return products.map(product => ({
        ...product,
        imageUrl: product.imageUrl && 
                 typeof product.imageUrl === 'string' &&
                 product.imageUrl.trim() !== '' && 
                 !product.imageUrl.includes('placeholder.com') &&
                 !product.imageUrl.includes('via.placeholder.com')
                 ? product.imageUrl.trim() 
                 : (product.imageUrl || ''),
        status: product.status !== undefined ? product.status : true
      }));
    };

    // Thử gọi API không có pagination trước (lấy tất cả)
    const request$ = this.http.get<Product[]>(this.apiUrl).pipe(
      timeout(30000), // 30 giây timeout
      map(products => {
        console.log('All products loaded from API (no pagination):', products.length);
        const mappedProducts = mapProducts(products);
        this.setCachedData(cacheKey, mappedProducts);
        this.loadingStates.delete(cacheKey);
        return mappedProducts;
      }),
      shareReplay(1),
      catchError(error => {
        console.log('API without pagination failed, trying with large pageSize...', error);
        // Nếu không được, thử với pageSize rất lớn
        return this.http.get<Product[]>(`${this.apiUrl}?pageSize=10000`).pipe(
          timeout(30000),
          map(products => {
            console.log('All products loaded from API (large pageSize):', products.length);
            const mappedProducts = mapProducts(products);
            this.setCachedData(cacheKey, mappedProducts);
            this.loadingStates.delete(cacheKey);
            return mappedProducts;
          }),
          catchError(pageSizeError => {
            console.error('Error loading products with large pageSize:', pageSizeError);
            // Nếu vẫn lỗi, thử lấy từng trang và gộp lại
            console.log('Trying to load all products by fetching multiple pages...');
            return this.loadAllProductsByPages();
          })
        );
      })
    );

    this.loadingStates.set(cacheKey, request$);
    return request$;
  }

  // Load tất cả sản phẩm bằng cách gọi nhiều trang và gộp lại
  private loadAllProductsByPages(): Observable<Product[]> {
    const pageSize = 100; // Lấy 100 sản phẩm mỗi trang
    
    const loadPage = (page: number, accumulatedProducts: Product[] = []): Observable<Product[]> => {
      const params = new HttpParams()
        .set('page', page.toString())
        .set('pageSize', pageSize.toString());
      
      return this.http.get<Product[]>(this.apiUrl, { params }).pipe(
        timeout(10000),
        switchMap(products => {
          if (!products || products.length === 0) {
            // Không còn sản phẩm, trả về tất cả đã tích lũy
            return of(accumulatedProducts);
          }
          
          // Thêm sản phẩm vào danh sách tích lũy
          const newAccumulated = [...accumulatedProducts, ...products];
          
          // Nếu số sản phẩm trả về bằng pageSize, có thể còn trang tiếp theo
          if (products.length === pageSize) {
            return loadPage(page + 1, newAccumulated);
          } else {
            // Đã hết sản phẩm
            return of(newAccumulated);
          }
        }),
        catchError(error => {
          console.error(`Error loading page ${page}:`, error);
          // Trả về những gì đã tích lũy được
          return of(accumulatedProducts);
        })
      );
    };
    
    return loadPage(1).pipe(
      map(products => {
        console.log('All products loaded by pages:', products.length);
        const mappedProducts = products.map(product => ({
          ...product,
          imageUrl: product.imageUrl && 
                   typeof product.imageUrl === 'string' &&
                   product.imageUrl.trim() !== '' && 
                   !product.imageUrl.includes('placeholder.com') &&
                   !product.imageUrl.includes('via.placeholder.com')
                   ? product.imageUrl.trim() 
                   : (product.imageUrl || ''),
          status: product.status !== undefined ? product.status : true
        }));
        this.setCachedData('all_products', mappedProducts);
        this.loadingStates.delete('all_products');
        return mappedProducts;
      }),
      catchError(error => {
        console.error('Error in loadAllProductsByPages:', error);
        this.loadingStates.delete('all_products');
        return of([]);
      })
    );
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
          else if (error.error !== null && typeof error.error === 'object') {
            // Kiểm tra các field có thể chứa error message
            interface ErrorResponse {
              message?: string;
              error?: string | { message?: string };
              title?: string;
              detail?: string;
              type?: string;
            }
            const errorObj = error.error as ErrorResponse;
            
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

  // ========== ProductDetails API Methods ==========

  // Lấy tất cả ProductDetails
  getAllProductDetails(): Observable<ProductDetail[]> {
    return this.http.get<ProductDetailApiResponse>(this.productDetailsApiUrl).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        return [];
      }),
      catchError(error => {
        console.error('Error loading product details:', error);
        return of([]);
      })
    );
  }

  // Lấy ProductDetails theo ProductId
  getProductDetailsByProductId(productId: number): Observable<ProductDetail[]> {
    return this.http.get<ProductDetailApiResponse>(`${this.productDetailsApiUrl}?productId=${productId}`).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        return [];
      }),
      catchError(error => {
        console.error('Error loading product details by productId:', error);
        return of([]);
      })
    );
  }

  // Tạo ProductDetail mới
  createProductDetail(productDetail: ProductDetailCreateUpdate): Observable<ProductDetail> {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const detailData = {
      productId: productDetail.productId,
      brand: (productDetail.brand || '').trim(),
      origin: (productDetail.origin || '').trim(),
      warranty: (productDetail.warranty || '').trim(),
      specifications: (productDetail.specifications || '').trim(),
      features: (productDetail.features || '').trim(),
      additionalInfo: (productDetail.additionalInfo || '').trim()
    };

    return this.http.post<ProductDetail>(this.productDetailsApiUrl, detailData, { headers }).pipe(
      map(newDetail => {
        this.clearCache();
        return newDetail;
      }),
      catchError(error => {
        console.error('Error creating product detail:', error);
        let errorMessage = 'Không thể tạo chi tiết sản phẩm';
        if (error.status === 400) {
          errorMessage = 'Dữ liệu không hợp lệ';
        } else if (error.status === 500) {
          errorMessage = 'Lỗi server';
        }
        const enhancedError = new Error(errorMessage) as HttpError;
        enhancedError.status = error.status;
        enhancedError.originalError = error;
        throw enhancedError;
      })
    );
  }

  // Tạo nhiều ProductDetails cùng lúc
  createProductDetails(productDetails: ProductDetailCreateUpdate[]): Observable<ProductDetail[]> {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const detailsData = productDetails.map(detail => ({
      productId: detail.productId,
      brand: (detail.brand || '').trim(),
      origin: (detail.origin || '').trim(),
      warranty: (detail.warranty || '').trim(),
      specifications: (detail.specifications || '').trim(),
      features: (detail.features || '').trim(),
      additionalInfo: (detail.additionalInfo || '').trim()
    }));

    // Gửi từng detail một (có thể tối ưu thành batch nếu backend hỗ trợ)
    const createObservables = detailsData.map(detailData =>
      this.http.post<ProductDetail>(this.productDetailsApiUrl, detailData, { headers })
    );

    return forkJoin(createObservables).pipe(
      map(results => {
        this.clearCache();
        return results;
      }),
      catchError(error => {
        console.error('Error creating product details:', error);
        return of([]);
      })
    );
  }

  // Cập nhật ProductDetail
  updateProductDetail(id: number, productDetail: Partial<ProductDetailCreateUpdate>): Observable<ProductDetail> {
    if (!id || id <= 0) {
      throw new Error('Invalid product detail ID');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const updateData: Partial<ProductDetailCreateUpdate> = {};
    if (productDetail.productId !== undefined) updateData.productId = productDetail.productId;
    if (productDetail.brand !== undefined) updateData.brand = productDetail.brand.trim();
    if (productDetail.origin !== undefined) updateData.origin = productDetail.origin.trim();
    if (productDetail.warranty !== undefined) updateData.warranty = productDetail.warranty.trim();
    if (productDetail.specifications !== undefined) updateData.specifications = productDetail.specifications.trim();
    if (productDetail.features !== undefined) updateData.features = productDetail.features.trim();
    if (productDetail.additionalInfo !== undefined) updateData.additionalInfo = productDetail.additionalInfo.trim();

    return this.http.put<ProductDetail>(`${this.productDetailsApiUrl}/${id}`, updateData, { headers }).pipe(
      map(updatedDetail => {
        this.clearCache();
        return updatedDetail;
      }),
      catchError(error => {
        console.error('Error updating product detail:', error);
        let errorMessage = 'Không thể cập nhật chi tiết sản phẩm';
        if (error.status === 400) {
          errorMessage = 'Dữ liệu không hợp lệ';
        } else if (error.status === 404) {
          errorMessage = 'Không tìm thấy chi tiết sản phẩm';
        } else if (error.status === 500) {
          errorMessage = 'Lỗi server';
        }
        const enhancedError = new Error(errorMessage) as HttpError;
        enhancedError.status = error.status;
        enhancedError.originalError = error;
        throw enhancedError;
      })
    );
  }

  // Xóa ProductDetail
  deleteProductDetail(id: number): Observable<void> {
    if (!id || id <= 0) {
      throw new Error('Invalid product detail ID');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    return this.http.delete<void>(`${this.productDetailsApiUrl}/${id}`, { headers }).pipe(
      map(() => {
        this.clearCache();
      }),
      catchError(error => {
        console.error('Error deleting product detail:', error);
        let errorMessage = 'Không thể xóa chi tiết sản phẩm';
        if (error.status === 404) {
          errorMessage = 'Không tìm thấy chi tiết sản phẩm';
        } else if (error.status === 500) {
          errorMessage = 'Lỗi server';
        }
        const enhancedError = new Error(errorMessage) as HttpError;
        enhancedError.status = error.status;
        enhancedError.originalError = error;
        throw enhancedError;
      })
    );
  }

  // Lưu ProductDetails cho một Product (xóa cũ và tạo mới)
  saveProductDetailsForProduct(productId: number, productDetails: ProductDetailCreateUpdate[]): Observable<ProductDetail[]> {
    // Lọc bỏ các detail rỗng
    const validDetails = productDetails.filter(detail =>
      detail.brand || detail.origin || detail.warranty ||
      detail.specifications || detail.features || detail.additionalInfo
    );

    if (validDetails.length === 0) {
      return of([]);
    }

    // Lấy danh sách ProductDetails hiện tại của product
    return this.getProductDetailsByProductId(productId).pipe(
      switchMap(existingDetails => {
        // Xóa các ProductDetails cũ
        const deleteObservables = existingDetails.map(detail => this.deleteProductDetail(detail.id));
        
        // Nếu có detail cũ, xóa chúng trước
        if (deleteObservables.length > 0) {
          return forkJoin(deleteObservables).pipe(
            switchMap(() => {
              // Sau đó tạo mới
              return this.createProductDetails(validDetails);
            })
          );
        } else {
          // Nếu không có detail cũ, tạo mới luôn
          return this.createProductDetails(validDetails);
        }
      }),
      catchError(error => {
        console.error('Error saving product details:', error);
        return of([]);
      })
    );
  }

  // ========== ProductVariants API Methods ==========

  // Lấy tất cả ProductVariants
  getAllProductVariants(): Observable<ProductVariant[]> {
    return this.http.get<ProductVariantApiResponse>(this.productVariantsApiUrl).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        return [];
      }),
      catchError(error => {
        console.error('Error loading product variants:', error);
        return of([]);
      })
    );
  }

  // Lấy ProductVariants theo ProductId
  getProductVariantsByProductId(productId: number): Observable<ProductVariant[]> {
    return this.http.get<ProductVariantApiResponse>(`${this.productVariantsApiUrl}?productId=${productId}`).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        return [];
      }),
      catchError(error => {
        console.error('Error loading product variants by productId:', error);
        return of([]);
      })
    );
  }

  // Tạo ProductVariant mới
  createProductVariant(productVariant: ProductVariantCreateUpdate): Observable<ProductVariant> {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const variantData = {
      productId: productVariant.productId,
      variantName: (productVariant.variantName || '').trim(),
      attributes: (productVariant.attributes || '').trim(),
      price: Number(productVariant.price) || 0,
      sku: (productVariant.sku || '').trim()
    };

    return this.http.post<ProductVariant>(this.productVariantsApiUrl, variantData, { headers }).pipe(
      map(newVariant => {
        this.clearCache();
        return newVariant;
      }),
      catchError(error => {
        console.error('Error creating product variant:', error);
        let errorMessage = 'Không thể tạo biến thể sản phẩm';
        if (error.status === 400) {
          errorMessage = 'Dữ liệu không hợp lệ';
        } else if (error.status === 500) {
          errorMessage = 'Lỗi server';
        }
        const enhancedError = new Error(errorMessage) as HttpError;
        enhancedError.status = error.status;
        enhancedError.originalError = error;
        throw enhancedError;
      })
    );
  }

  // Tạo nhiều ProductVariants cùng lúc
  createProductVariants(productVariants: ProductVariantCreateUpdate[]): Observable<ProductVariant[]> {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const variantsData = productVariants.map(variant => ({
      productId: variant.productId,
      variantName: (variant.variantName || '').trim(),
      attributes: (variant.attributes || '').trim(),
      price: Number(variant.price) || 0,
      sku: (variant.sku || '').trim()
    }));

    // Gửi từng variant một (có thể tối ưu thành batch nếu backend hỗ trợ)
    const createObservables = variantsData.map(variantData =>
      this.http.post<ProductVariant>(this.productVariantsApiUrl, variantData, { headers })
    );

    return forkJoin(createObservables).pipe(
      map(results => {
        this.clearCache();
        return results;
      }),
      catchError(error => {
        console.error('Error creating product variants:', error);
        return of([]);
      })
    );
  }

  // Cập nhật ProductVariant
  updateProductVariant(id: number, productVariant: Partial<ProductVariantCreateUpdate>): Observable<ProductVariant> {
    if (!id || id <= 0) {
      throw new Error('Invalid product variant ID');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const updateData: Partial<ProductVariantCreateUpdate> = {};
    if (productVariant.productId !== undefined) updateData.productId = productVariant.productId;
    if (productVariant.variantName !== undefined) updateData.variantName = productVariant.variantName.trim();
    if (productVariant.attributes !== undefined) updateData.attributes = productVariant.attributes.trim();
    if (productVariant.price !== undefined) updateData.price = Number(productVariant.price) || 0;
    if (productVariant.sku !== undefined) updateData.sku = productVariant.sku.trim();

    return this.http.put<ProductVariant>(`${this.productVariantsApiUrl}/${id}`, updateData, { headers }).pipe(
      map(updatedVariant => {
        this.clearCache();
        return updatedVariant;
      }),
      catchError(error => {
        console.error('Error updating product variant:', error);
        let errorMessage = 'Không thể cập nhật biến thể sản phẩm';
        if (error.status === 400) {
          errorMessage = 'Dữ liệu không hợp lệ';
        } else if (error.status === 404) {
          errorMessage = 'Không tìm thấy biến thể sản phẩm';
        } else if (error.status === 500) {
          errorMessage = 'Lỗi server';
        }
        const enhancedError = new Error(errorMessage) as HttpError;
        enhancedError.status = error.status;
        enhancedError.originalError = error;
        throw enhancedError;
      })
    );
  }

  // Xóa ProductVariant
  deleteProductVariant(id: number): Observable<void> {
    if (!id || id <= 0) {
      throw new Error('Invalid product variant ID');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    return this.http.delete<void>(`${this.productVariantsApiUrl}/${id}`, { headers }).pipe(
      map(() => {
        this.clearCache();
      }),
      catchError(error => {
        console.error('Error deleting product variant:', error);
        let errorMessage = 'Không thể xóa biến thể sản phẩm';
        if (error.status === 404) {
          errorMessage = 'Không tìm thấy biến thể sản phẩm';
        } else if (error.status === 500) {
          errorMessage = 'Lỗi server';
        }
        const enhancedError = new Error(errorMessage) as HttpError;
        enhancedError.status = error.status;
        enhancedError.originalError = error;
        throw enhancedError;
      })
    );
  }

  // Lưu ProductVariants cho một Product (xóa cũ và tạo mới)
  saveProductVariantsForProduct(productId: number, productVariants: ProductVariantCreateUpdate[]): Observable<ProductVariant[]> {
    // Lọc bỏ các variant rỗng
    const validVariants = productVariants.filter(variant =>
      variant.variantName || variant.attributes || variant.price > 0 || variant.sku
    );

    if (validVariants.length === 0) {
      return of([]);
    }

    // Lấy danh sách ProductVariants hiện tại của product
    return this.getProductVariantsByProductId(productId).pipe(
      switchMap(existingVariants => {
        // Xóa các ProductVariants cũ
        const deleteObservables = existingVariants.map(variant => this.deleteProductVariant(variant.id));
        
        // Nếu có variant cũ, xóa chúng trước
        if (deleteObservables.length > 0) {
          return forkJoin(deleteObservables).pipe(
            switchMap(() => {
              // Sau đó tạo mới
              return this.createProductVariants(validVariants);
            })
          );
        } else {
          // Nếu không có variant cũ, tạo mới luôn
          return this.createProductVariants(validVariants);
        }
      }),
      catchError(error => {
        console.error('Error saving product variants:', error);
        return of([]);
      })
    );
  }
}