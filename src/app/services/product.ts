import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
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
  private apiUrl = 'http://localhost:5000/api/Products';
  private cache = new Map<string, any>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 phút

  constructor(private http: HttpClient) { }

  // Lấy tất cả sản phẩm với cache
  getAllProducts(): Observable<Product[]> {
    const cacheKey = 'all_products';
    const cached = this.getCachedData(cacheKey);
    
    if (cached) {
      return of(cached);
    }

    return this.http.get<Product[]>(this.apiUrl).pipe(
      map(products => {
        this.setCachedData(cacheKey, products);
        return products;
      }),
      shareReplay(1),
      catchError(error => {
        console.error('Error loading products:', error);
        return of([]);
      })
    );
  }

  // Lấy sản phẩm với pagination
  getProductsPaginated(page: number = 1, limit: number = 10, search?: string): Observable<ProductResponse> {
    const cacheKey = `products_page_${page}_limit_${limit}_search_${search || ''}`;
    const cached = this.getCachedData(cacheKey);
    
    if (cached) {
      return of(cached);
    }

    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    
    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<ProductResponse>(`${this.apiUrl}/paginated`, { params }).pipe(
      map(response => {
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
    const cached = this.getCachedData(cacheKey);
    
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
  createProduct(product: Omit<Product, 'id'>): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, product).pipe(
      map(newProduct => {
        this.clearCache(); // Clear cache after creating
        return newProduct;
      }),
      catchError(error => {
        console.error('Error creating product:', error);
        throw error;
      })
    );
  }

  // Cập nhật sản phẩm
  updateProduct(id: number, product: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/${id}`, product).pipe(
      map(updatedProduct => {
        this.clearCache(); // Clear cache after updating
        return updatedProduct;
      }),
      catchError(error => {
        console.error('Error updating product:', error);
        throw error;
      })
    );
  }

  // Xóa sản phẩm
  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      map(() => {
        this.clearCache(); // Clear cache after deleting
      }),
      catchError(error => {
        console.error('Error deleting product:', error);
        throw error;
      })
    );
  }

  // Cache management
  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCachedData(key: string, data: any): void {
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
}