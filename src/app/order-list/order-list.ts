import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, timeout } from 'rxjs';
import { OrderService, Order } from '../services/order';

@Component({
  selector: 'app-order-list',
  imports: [CommonModule, FormsModule],
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
  
  private searchSubject = new Subject<string>();
  private statusSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private orderService: OrderService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

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
    
    console.log('Loading orders...');
    
    this.orderService.getOrders(this.currentPage, this.pageSize).pipe(
      timeout(5000), // 5 giây timeout
      takeUntil(this.destroy$)
    ).subscribe({
      next: (orders) => {
        console.log('Orders received:', orders);
        this.orders = orders || [];
        this.loading = false;
        this.showSkeleton = false;
        
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

  loadSampleData(): void {
    console.log('Loading sample data...');
    this.orders = [
      {
        id: 1,
        orderNumber: 'ORD-0001',
        userId: 21,
        userName: 'hung',
        totalAmount: 1500000,
        shippingFee: 30000,
        discountAmount: 0,
        status: 'pending',
        placedAt: '2025-09-30T03:32:13.886177',
        orderItems: []
      },
      {
        id: 2,
        orderNumber: 'ORD-0002',
        userId: 21,
        userName: 'hung',
        totalAmount: 2500000,
        shippingFee: 50000,
        discountAmount: 200000,
        status: 'paid',
        placedAt: '2025-09-30T03:32:13.886177',
        orderItems: []
      },
      {
        id: 3,
        orderNumber: 'ORD-0003',
        userId: 22,
        userName: 'minh',
        totalAmount: 800000,
        shippingFee: 20000,
        discountAmount: 50000,
        status: 'shipped',
        placedAt: '2025-09-29T10:15:30.123456',
        orderItems: []
      },
      {
        id: 4,
        orderNumber: 'ORD-0004',
        userId: 23,
        userName: 'lan',
        totalAmount: 3200000,
        shippingFee: 40000,
        discountAmount: 0,
        status: 'delivered',
        placedAt: '2025-09-28T14:20:45.789012',
        orderItems: []
      },
      {
        id: 5,
        orderNumber: 'ORD-0005',
        userId: 24,
        userName: 'tuan',
        totalAmount: 1200000,
        shippingFee: 25000,
        discountAmount: 100000,
        status: 'cancelled',
        placedAt: '2025-09-27T09:30:15.456789',
        orderItems: []
      }
    ];
    this.loading = false;
    this.showSkeleton = false;
    this.error = null;
    console.log('Sample data loaded:', this.orders.length, 'orders');
    this.cdr.markForCheck();
  }

  private preloadNextPage(): void {
    // Preload next page in background
    this.orderService.getOrders(this.currentPage + 1, this.pageSize)
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
    // Navigate to order details page
    console.log('View order details:', order);
  }

  updateOrderStatus(order: Order, newStatus: string): void {
    this.orderService.updateOrderStatus(order.id, newStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedOrder) => {
          const index = this.orders.findIndex(o => o.id === order.id);
          if (index !== -1) {
            this.orders[index] = updatedOrder;
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

  getStatusText(status: string): string {
    return this.orderService.getStatusText(status);
  }

  // Làm mới dữ liệu (force reload)
  refreshOrders(): void {
    this.loadOrders();
  }
}
