import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
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
  phone?: string;
  address?: string;
}

export interface OrderResponse {
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrderDetailApiResponse {
  id?: number;
  productId?: number;
  productName?: string;
  quantity?: number;
  price?: number;
}

export interface OrderDetailItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: number;
  order: null;
  product: {
    id: number;
    name: string;
    productCode: string;
    originalPrice: number;
    productGroup: string;
    discountPercent: number;
    salePrice: number;
    stock: number;
    imageUrl: string;
    description: string;
    status: boolean;
    createdAt: string;
    productDetails: unknown[];
    productVariants: unknown[];
    inventories: null;
  };
}

export interface OrderApiResponse {
  id: number;
  userId: number;
  totalPrice: number;
  paymentMethod: string;
  status: string;
  address: string;
  phone: string;
  createdAt: string;
  orderDetails: OrderDetailApiResponse[];
}

interface CacheEntry {
  data: Order[] | Order;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = 'http://localhost:5000/api/Orders';
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 phút
  private loadingStates = new Map<string, Observable<Order[]>>();
  private readonly http = inject(HttpClient);

  // Lấy tất cả đơn hàng với pagination
  getOrders(page: number = 1, pageSize: number = 20, customerId?: number, includeItems: boolean = false): Observable<Order[]> {
    const cacheKey = `orders_page_${page}_pageSize_${pageSize}_customerId_${customerId || 'all'}_includeItems_${includeItems}`;
    const cached = this.getCachedOrders(cacheKey);
    
    if (cached) {
      return of(cached);
    }

    // Kiểm tra xem có request đang loading không
    if (this.loadingStates.has(cacheKey)) {
      return this.loadingStates.get(cacheKey)!;
    }

    const headers = new HttpHeaders({
      'accept': 'text/plain'
    });

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString())
      .set('includeItems', includeItems.toString());
    
    if (customerId) {
      params = params.set('customerId', customerId.toString());
    }

    const request$ = this.http.get<OrderApiResponse[]>(this.apiUrl, { params, headers }).pipe(
      map(apiOrders => {
        const orders = (apiOrders || []).map(apiOrder => this.mapApiOrderToOrder(apiOrder));
        this.setCachedData(cacheKey, orders);
        this.loadingStates.delete(cacheKey);
        return orders;
      }),
      shareReplay(1),
      catchError(() => {
        this.loadingStates.delete(cacheKey);
        return of([]);
      })
    );

    this.loadingStates.set(cacheKey, request$);
    return request$;
  }

  // Map dữ liệu từ API response sang Order interface
  private mapApiOrderToOrder(apiOrder: OrderApiResponse): Order {
    const status = this.normalizeStatus(apiOrder.status);
    
    return {
      id: apiOrder.id,
      orderNumber: `ORD-${String(apiOrder.id).padStart(4, '0')}`,
      customerId: apiOrder.userId,
      customerName: `Khách hàng #${apiOrder.userId}`,
      totalAmount: apiOrder.totalPrice,
      shippingFee: 0,
      discountAmount: 0,
      status: status as 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled',
      placedAt: apiOrder.createdAt,
      phone: apiOrder.phone || '',
      address: apiOrder.address || '',
      orderItems: (apiOrder.orderDetails || []).map((detail, index) => ({
        id: detail.id || index + 1,
        productId: detail.productId || 0,
        productName: detail.productName || 'Sản phẩm không xác định',
        quantity: detail.quantity || 1,
        price: detail.price || 0,
        totalPrice: (detail.quantity || 1) * (detail.price || 0)
      }))
    };
  }

  // Chuẩn hóa status từ API (có thể là "Pending", "Pending", v.v.) về lowercase
  private normalizeStatus(status: string): string {
    if (!status) return 'pending';
    const normalized = status.toLowerCase();
    const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
    return validStatuses.includes(normalized) ? normalized : 'pending';
  }

  // Lấy đơn hàng theo ID
  getOrderById(id: number): Observable<Order> {
    const cacheKey = `order_${id}`;
    const cached = this.getCachedSingleOrder(cacheKey);
    
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
  private getCachedOrders(key: string): Order[] | null {
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

  private getCachedSingleOrder(key: string): Order | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      const data = cached.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return data as Order;
      }
    }
    this.cache.delete(key);
    return null;
  }

  private setCachedData(key: string, data: Order[] | Order): void {
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

  // Lấy chi tiết đơn hàng theo orderId
  getOrderDetails(orderId: number): Observable<OrderDetailItem[]> {
    return this.http.get<OrderDetailItem[]>(`http://localhost:5000/api/order-details/order/${orderId}`).pipe(
      catchError(error => {
        throw error;
      })
    );
  }
}
