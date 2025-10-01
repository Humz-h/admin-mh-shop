import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OrderService, Order } from '../services/order';

@Component({
  selector: 'app-order-list',
  imports: [CommonModule, FormsModule],
  templateUrl: './order-list.html',
  styleUrl: './order-list.scss'
})
export class OrderList implements OnInit {
  orders: Order[] = [];
  loading = false;
  error: string | null = null;
  currentPage = 1;
  pageSize = 20;
  totalOrders = 0;
  searchTerm = '';
  selectedStatus = '';

  constructor(
    private orderService: OrderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.error = null;
    
    this.orderService.getOrders(this.currentPage, this.pageSize).subscribe({
      next: (orders) => {
        this.orders = orders;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Không thể tải danh sách đơn hàng';
        this.loading = false;
        console.error('Error loading orders:', error);
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadOrders();
  }

  onStatusChange(status: string): void {
    this.selectedStatus = status;
    this.currentPage = 1;
    this.loadOrders();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadOrders();
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
    this.orderService.updateOrderStatus(order.id, newStatus).subscribe({
      next: (updatedOrder) => {
        const index = this.orders.findIndex(o => o.id === order.id);
        if (index !== -1) {
          this.orders[index] = updatedOrder;
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
}
