import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  totalPrice: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  placedAt: string;
  orderItems: OrderItem[];
}

export interface OrderResponse {
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = 'http://localhost:5000/api/Orders';
  private cache = new Map<string, any>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 phút
  private loadingStates = new Map<string, Observable<Order[]>>();

  constructor(private http: HttpClient) { }

  // Lấy tất cả đơn hàng với pagination
  getOrders(page: number = 1, pageSize: number = 20, customerId?: number): Observable<Order[]> {
    const cacheKey = `orders_page_${page}_pageSize_${pageSize}_customerId_${customerId || 'all'}`;
    const cached = this.getCachedData(cacheKey);
    
    if (cached) {
      return of(cached);
    }

    // Kiểm tra xem có request đang loading không
    if (this.loadingStates.has(cacheKey)) {
      return this.loadingStates.get(cacheKey)!;
    }

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    
    if (customerId) {
      params = params.set('customerId', customerId.toString());
    }

    const request$ = this.http.get<Order[]>(this.apiUrl, { params }).pipe(
      map(orders => {
        this.setCachedData(cacheKey, orders);
        this.loadingStates.delete(cacheKey);
        return orders || [];
      }),
      shareReplay(1),
      catchError(error => {
        console.error('Error loading orders:', error);
        this.loadingStates.delete(cacheKey);
        return of([]);
      })
    );

    this.loadingStates.set(cacheKey, request$);
    return request$;
  }

  // Lấy đơn hàng theo ID
  getOrderById(id: number): Observable<Order> {
    const cacheKey = `order_${id}`;
    const cached = this.getCachedData(cacheKey);
    
    if (cached) {
      return of(cached);
    }

    return this.http.get<Order>(`${this.apiUrl}/${id}`).pipe(
      map(order => {
        this.setCachedData(cacheKey, order);
        return order;
      }),
      shareReplay(1),
      catchError(error => {
        console.error('Error loading order:', error);
        return of({} as Order);
      })
    );
  }

  // Cập nhật trạng thái đơn hàng
  updateOrderStatus(id: number, status: string): Observable<Order> {
    return this.http.put<Order>(`${this.apiUrl}/${id}/status`, { status }).pipe(
      map(updatedOrder => {
        this.clearCache(); // Clear cache after updating
        return updatedOrder;
      }),
      catchError(error => {
        console.error('Error updating order status:', error);
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
  clearOrderCache(id?: number): void {
    if (id) {
      this.cache.delete(`order_${id}`);
    } else {
      this.clearCache();
    }
  }

  // Format currency
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  }

  // Format date
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Get status badge class
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'pending': return 'badge-warning';
      case 'paid': return 'badge-info';
      case 'shipped': return 'badge-primary';
      case 'delivered': return 'badge-success';
      case 'cancelled': return 'badge-danger';
      default: return 'badge-secondary';
    }
  }

  // Get status text in Vietnamese
  getStatusText(status: string): string {
    switch (status) {
      case 'pending': return 'Chờ xử lý';
      case 'paid': return 'Đã thanh toán';
      case 'shipped': return 'Đang giao';
      case 'delivered': return 'Đã giao';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  }
}
