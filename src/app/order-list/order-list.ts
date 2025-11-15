import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, timeout } from 'rxjs';
import { OrderService, Order, OrderDetailItem } from '../services/order';
import { BadgeComponent } from '../shared/components/ui/badge/badge.component';

@Component({
  selector: 'app-order-list',
  imports: [CommonModule, FormsModule, BadgeComponent],
  templateUrl: './order-list.html',
  styleUrl: './order-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderList implements OnInit, OnDestroy {
  orders: Order[] = [];
  loading = false;
  error: string | null = null;
  currentPage = 1;
  pageSize = 20;
  totalOrders = 0;
  searchTerm = '';
  selectedStatus = '';
  showSkeleton = true;
  
  // Cache for formatted data
  private formattedOrdersCache = new Map<number, {
    formattedTotalAmount: string;
    formattedShippingFee: string;
    formattedDiscountAmount: string;
    formattedDate: string;
    statusColor: 'primary' | 'success' | 'error' | 'warning' | 'info' | 'light' | 'dark';
    statusText: string;
  }>();
  
  // Order details modal
  showOrderDetailsModal = false;
  selectedOrder: Order | null = null;
  orderDetails: OrderDetailItem[] = [];
  loadingDetails = false;
  detailsError: string | null = null;
  
  private searchSubject = new Subject<string>();
  private statusSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  private readonly orderService = inject(OrderService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.setupDebouncedSearch();
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupDebouncedSearch(): void {
    // Debounce search với 300ms delay
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.searchTerm = searchTerm;
      this.currentPage = 1;
      this.loadOrders();
    });

    // Debounce status filter với 100ms delay
    this.statusSubject.pipe(
      debounceTime(100),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(status => {
      this.selectedStatus = status;
      this.currentPage = 1;
      this.loadOrders();
    });
  }

  loadOrders(): void {
    this.loading = true;
    this.showSkeleton = true;
    this.error = null;
    this.formattedOrdersCache.clear();
    
    console.log('Loading orders...');
    
    this.orderService.getOrders(this.currentPage, this.pageSize, undefined, false).pipe(
      timeout(5000), // 5 giây timeout
      takeUntil(this.destroy$)
    ).subscribe({
      next: (orders) => {
        console.log('Orders received:', orders);
        this.orders = orders || [];
        this.loading = false;
        this.showSkeleton = false;
        
        // Pre-compute formatted values for better performance
        this.precomputeFormattedValues();
        
        // Nếu không có dữ liệu, load sample data
        if (this.orders.length === 0) {
          console.log('No orders found, loading sample data...');
          this.loadSampleData();
        } else {
          // Preload next page for faster navigation
          this.preloadNextPage();
        }
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading orders:', error);
        this.loading = false;
        this.showSkeleton = false;
        
        // Load sample data khi API lỗi hoặc timeout
        this.loadSampleData();
        this.cdr.markForCheck();
      }
    });
  }

  private precomputeFormattedValues(): void {
    this.formattedOrdersCache.clear();
    this.orders.forEach(order => {
      this.formattedOrdersCache.set(order.id, {
        formattedTotalAmount: this.formatCurrency(order.totalAmount),
        formattedShippingFee: this.formatCurrency(order.shippingFee),
        formattedDiscountAmount: this.formatCurrency(order.discountAmount),
        formattedDate: this.formatDate(order.placedAt),
        statusColor: this.getStatusColor(order.status),
        statusText: this.getStatusText(order.status)
      });
    });
  }

  getFormattedOrder(orderId: number) {
    return this.formattedOrdersCache.get(orderId);
  }

  trackByOrderId(index: number, order: Order): number {
    return order.id;
  }

  trackByOrderDetailId(index: number, item: OrderDetailItem): number {
    return item.id;
  }

  loadSampleData(): void {
    console.log('Loading sample data...');
    this.orders = [
      {
        id: 1,
        orderNumber: 'ORD-0001',
        customerId: 21,
        customerName: 'hung',
        totalAmount: 1500000,
        shippingFee: 30000,
        discountAmount: 0,
        status: 'pending',
        placedAt: '2025-09-30T03:32:13.886177',
        phone: '0961876281',
        address: '123 Đường ABC, Phường XYZ, Quận 1, TP.HCM',
        orderItems: []
      },
      {
        id: 2,
        orderNumber: 'ORD-0002',
        customerId: 21,
        customerName: 'hung',
        totalAmount: 2500000,
        shippingFee: 50000,
        discountAmount: 200000,
        status: 'paid',
        placedAt: '2025-09-30T03:32:13.886177',
        phone: '0961876281',
        address: '123 Đường ABC, Phường XYZ, Quận 1, TP.HCM',
        orderItems: []
      },
      {
        id: 3,
        orderNumber: 'ORD-0003',
        customerId: 22,
        customerName: 'minh',
        totalAmount: 800000,
        shippingFee: 20000,
        discountAmount: 50000,
        status: 'shipped',
        placedAt: '2025-09-29T10:15:30.123456',
        phone: '0987654321',
        address: '456 Đường DEF, Phường UVW, Quận 2, TP.HCM',
        orderItems: []
      },
      {
        id: 4,
        orderNumber: 'ORD-0004',
        customerId: 23,
        customerName: 'lan',
        totalAmount: 3200000,
        shippingFee: 40000,
        discountAmount: 0,
        status: 'delivered',
        placedAt: '2025-09-28T14:20:45.789012',
        phone: '0912345678',
        address: '789 Đường GHI, Phường RST, Quận 3, TP.HCM',
        orderItems: []
      },
      {
        id: 5,
        orderNumber: 'ORD-0005',
        customerId: 24,
        customerName: 'tuan',
        totalAmount: 1200000,
        shippingFee: 25000,
        discountAmount: 100000,
        status: 'cancelled',
        placedAt: '2025-09-27T09:30:15.456789',
        phone: '0923456789',
        address: '321 Đường JKL, Phường MNO, Quận 4, TP.HCM',
        orderItems: []
      }
    ];
    this.loading = false;
    this.showSkeleton = false;
    this.error = null;
    this.precomputeFormattedValues();
    console.log('Sample data loaded:', this.orders.length, 'orders');
    this.cdr.markForCheck();
  }

  private preloadNextPage(): void {
    // Preload next page in background
    this.orderService.getOrders(this.currentPage + 1, this.pageSize, undefined, false)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          console.log('Preloaded next page:', orders?.length || 0, 'orders');
        },
        error: (error) => {
          // Ignore preload errors
          console.log('Preload failed:', error);
        }
      });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadOrders();
  }

  onStatusChange(status: string): void {
    this.statusSubject.next(status);
  }

  onSearch(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchSubject.next(target.value);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.currentPage = 1;
    this.loadOrders();
  }

  viewOrderDetails(order: Order): void {
    this.selectedOrder = order;
    this.showOrderDetailsModal = true;
    this.orderDetails = [];
    this.detailsError = null;
    this.loadingDetails = true; // Set to true to show loading for order details
    document.body.style.overflow = 'hidden';
    this.cdr.markForCheck();
    
    // Load order details in background
    this.orderService.getOrderDetails(order.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (details) => {
        this.orderDetails = details || [];
        this.loadingDetails = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingDetails = false;
        this.detailsError = 'Không thể tải chi tiết đơn hàng. Vui lòng thử lại.';
        this.cdr.markForCheck();
      }
    });
  }

  closeOrderDetailsModal(): void {
    this.showOrderDetailsModal = false;
    this.selectedOrder = null;
    this.orderDetails = [];
    this.detailsError = null;
    document.body.style.overflow = '';
    this.cdr.markForCheck();
  }

  getProductImage(imageUrl: string | null | undefined, productName?: string, productGroup?: string): string {
    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
      const firstLetter = productName ? productName.charAt(0).toUpperCase() : '?';
      const category = productGroup || 'electronics';
      return this.getPlaceholderImage(firstLetter, category);
    }

    const trimmedUrl = imageUrl.trim();

    // Bỏ qua placeholder URLs
    if (trimmedUrl.includes('placeholder.com') || trimmedUrl.includes('via.placeholder.com')) {
      const firstLetter = productName ? productName.charAt(0).toUpperCase() : '?';
      const category = productGroup || 'electronics';
      return this.getPlaceholderImage(firstLetter, category);
    }

    // Xử lý data URLs (base64 images)
    if (trimmedUrl.startsWith('data:')) {
      return trimmedUrl;
    }

    // Xử lý full URLs (http/https)
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl;
    }

    // Xử lý relative paths với leading slash
    if (trimmedUrl.startsWith('/')) {
      return `http://localhost:5000${trimmedUrl}`;
    }

    // Xử lý relative paths không có leading slash
    if (trimmedUrl.length > 0) {
      return `http://localhost:5000/${trimmedUrl}`;
    }

    const firstLetter = productName ? productName.charAt(0).toUpperCase() : '?';
    const category = productGroup || 'electronics';
    return this.getPlaceholderImage(firstLetter, category);
  }

  onImageError(event: Event, productName?: string, productGroup?: string): void {
    const img = event.target as HTMLImageElement;
    const firstLetter = productName ? productName.charAt(0).toUpperCase() : '?';
    const category = productGroup || 'electronics';
    img.src = this.getPlaceholderImage(firstLetter, category);
  }

  getPlaceholderImage(firstLetter: string = '?', category: string = 'electronics'): string {
    const colors: Record<string, string> = {
      'electronics': '#4F46E5',
      'clothing': '#EC4899',
      'books': '#10B981',
      'home': '#F59E0B',
      'Điện tử': '#4F46E5',
      'Thời trang': '#EC4899',
      'Sách': '#10B981',
      'Điện gia dụng': '#F59E0B',
      'Thiết bị bếp': '#F59E0B',
      'Gaming': '#8B5CF6',
      'Laptop': '#6366F1'
    };

    const color = colors[category] || '#6B7280';

    const svgContent = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="${color}" opacity="0.1"/>
      <rect width="100" height="100" fill="none" stroke="${color}" stroke-width="2"/>
      <text x="50" y="50" text-anchor="middle" dy=".3em" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${color}">
        ${firstLetter}
      </text>
    </svg>`;

    return `data:image/svg+xml;base64,${btoa(svgContent)}`;
  }

  getTotalProductAmount(): number {
    return this.orderDetails.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  updateOrderStatus(order: Order, newStatus: string): void {
    this.orderService.updateOrderStatus(order.id, newStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedOrder) => {
          const index = this.orders.findIndex(o => o.id === order.id);
          if (index !== -1) {
            this.orders[index] = updatedOrder;
            // Update cache for this order
            this.formattedOrdersCache.set(updatedOrder.id, {
              formattedTotalAmount: this.formatCurrency(updatedOrder.totalAmount),
              formattedShippingFee: this.formatCurrency(updatedOrder.shippingFee),
              formattedDiscountAmount: this.formatCurrency(updatedOrder.discountAmount),
              formattedDate: this.formatDate(updatedOrder.placedAt),
              statusColor: this.getStatusColor(updatedOrder.status),
              statusText: this.getStatusText(updatedOrder.status)
            });
            this.cdr.markForCheck();
          }
        },
        error: (error) => {
          console.error('Error updating order status:', error);
          alert('Không thể cập nhật trạng thái đơn hàng');
        }
      });
  }

  onOrderStatusChange(order: Order, event: Event): void {
    event.stopPropagation(); // Ngăn event bubble up
    const target = event.target as HTMLSelectElement;
    const newStatus = target.value;
    
    // Chỉ cập nhật nếu status thực sự thay đổi
    if (newStatus !== order.status) {
      console.log(`Updating order ${order.orderNumber} from ${order.status} to ${newStatus}`);
      this.updateOrderStatus(order, newStatus);
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  formatCurrency(amount: number): string {
    return this.orderService.formatCurrency(amount);
  }

  formatDate(dateString: string): string {
    return this.orderService.formatDate(dateString);
  }

  getStatusBadgeClass(status: string): string {
    return this.orderService.getStatusBadgeClass(status);
  }

  getStatusColor(status: string): 'primary' | 'success' | 'error' | 'warning' | 'info' | 'light' | 'dark' {
    switch(status) {
      case 'pending': return 'warning';
      case 'paid': return 'info';
      case 'shipped': return 'info';
      case 'delivered': return 'success';
      case 'cancelled': return 'error';
      default: return 'light';
    }
  }

  getStatusText(status: string): string {
    return this.orderService.getStatusText(status);
  }

  // Làm mới dữ liệu (force reload)
  refreshOrders(): void {
    this.loadOrders();
  }

  // Lấy danh sách đơn hàng theo trạng thái
  getOrdersByStatus(status: string): Order[] {
    return this.orders.filter(order => order.status === status);
  }

  // Tính tổng doanh thu
  getTotalRevenue(): number {
    return this.orders
      .filter(order => order.status === 'delivered' || order.status === 'paid')
      .reduce((total, order) => total + order.totalAmount, 0);
  }
}
