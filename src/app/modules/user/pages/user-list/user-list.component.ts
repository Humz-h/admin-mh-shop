import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Customer, CustomerService } from '../../../../services/customer.service';
import { UserInsertEditComponent } from '../user-insert-edit/user-insert-edit.component';
import { catchError, timeout } from 'rxjs/operators';
import { Subject, takeUntil } from 'rxjs';
import { of } from 'rxjs';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, UserInsertEditComponent],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserListComponent implements OnInit, OnDestroy {
  customers: Customer[] = [];
  loading = false;
  errorMessage = '';
  showSkeleton = true;
  
  // Modal state
  showModal = false;
  isEditing = false;
  selectedCustomer: Customer | null = null;
  
  private destroy$ = new Subject<void>();
  private readonly customerService = inject(CustomerService);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.loadCustomers();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCustomers() {
    this.loading = true;
    this.showSkeleton = true;
    this.errorMessage = '';
    this.customers = [];
    
    this.customerService.getCustomers(1, 100).pipe(
      timeout(10000),
      takeUntil(this.destroy$),
      catchError((error) => {
        this.loading = false;
        this.showSkeleton = false;
        if (error.name === 'TimeoutError') {
          this.errorMessage = 'Yêu cầu quá thời gian chờ. Vui lòng kiểm tra kết nối mạng và thử lại.';
        } else if (error.status === 404) {
          this.errorMessage = `Endpoint không tồn tại (404). Kiểm tra endpoint API tại http://localhost:5000/api/Customers`;
        } else if (error.status === 0) {
          this.errorMessage = 'Không thể kết nối đến server. Vui lòng đảm bảo server đang chạy tại http://localhost:5000';
        } else {
          this.errorMessage = `Lỗi khi tải dữ liệu: ${error.status || error.message || 'Unknown error'}`;
        }
        this.customers = [];
        this.cdr.markForCheck();
        return of([]);
      })
    ).subscribe({
      next: (data) => {
        if (Array.isArray(data)) {
          // Create completely new array to trigger change detection
          const newCustomers = data.map((customer: Customer) => ({
            id: customer.id,
            username: customer.username || '',
            email: customer.email || '',
            fullName: customer.fullName || '',
            phone: customer.phone || null,
            role: customer.role || 'customer',
            createdAt: customer.createdAt || '',
            updatedAt: customer.updatedAt || null
          }));
          
          // Assign new array directly with new reference to trigger change detection
          this.customers = [...newCustomers];
          this.loading = false;
          this.showSkeleton = false;
          this.errorMessage = '';
          
          // Force change detection
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        } else {
          this.customers = [];
          this.loading = false;
          this.showSkeleton = false;
          this.errorMessage = '';
          this.cdr.markForCheck();
        }
      },
      error: (error) => {
        this.loading = false;
        this.showSkeleton = false;
        this.errorMessage = 'Lỗi không xác định khi tải dữ liệu: ' + (error.message || 'Unknown');
        this.customers = [];
        this.cdr.markForCheck();
      }
    });
  }

  goBack() {
    window.history.back();
  }

  refreshUsers() {
    // Force clear existing data before reload
    this.customers = [];
    this.errorMessage = '';
    this.cdr.markForCheck();
    
    // Reload from server
    this.loadCustomers();
  }

  trackByUserId(index: number, item: Customer): number {
    return item.id || index;
  }

  getRoleText(role: string): string {
    const roles: { [key: string]: string } = {
      'customer': 'Khách hàng',
      'admin': 'Quản trị viên',
      'staff': 'Nhân viên'
    };
    return roles[role] || role;
  }

  getRoleClass(role: string): string {
    return `role-${role}`;
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  }

  openAddUserModal() {
    // ALWAYS close and reset modal state first
    this.showModal = false;
    this.isEditing = false;
    this.selectedCustomer = null;
    this.cdr.markForCheck();
    
    // Wait a moment to ensure clean state, then open modal
    setTimeout(() => {
      // Double-check: ensure we're still in add mode
      this.isEditing = false;
      this.selectedCustomer = null;
      this.showModal = true;
      this.cdr.markForCheck();
    }, 100);
  }

  editUser(customer: Customer) {
    // Reset modal state first
    this.showModal = false;
    this.isEditing = false;
    this.selectedCustomer = null;
    this.cdr.markForCheck();
    
    // Then set editing state with a small delay to ensure clean state
    setTimeout(() => {
      this.isEditing = true;
      // Create a deep copy to ensure all properties are available
      this.selectedCustomer = {
        id: customer.id,
        username: customer.username || '',
        email: customer.email || '',
        fullName: customer.fullName || '',
        phone: customer.phone || null,
        role: customer.role || 'customer',
        createdAt: customer.createdAt || '',
        updatedAt: customer.updatedAt || null
      };
      this.showModal = true;
      this.cdr.markForCheck();
    }, 50);
  }

  deleteUser(customer: Customer) {
    if (!confirm(`Bạn có chắc chắn muốn xóa người dùng "${customer.username}"?`)) {
      return;
    }

    // Store original list for error recovery
    const originalCustomers = [...this.customers];
    
    // Optimistic update: Remove from UI immediately
    this.customers = this.customers.filter(c => c.id !== customer.id);
    this.errorMessage = '';
    this.cdr.markForCheck();
    this.cdr.detectChanges();

    this.customerService.deleteCustomer(customer.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        // Success: Reload from server to ensure data consistency
        this.loadCustomers();
      },
      error: (error) => {
        // Error: Restore original list and show error
        this.customers = [...originalCustomers];
        this.errorMessage = `Lỗi khi xóa người dùng: ${error.error?.message || error.message || 'Unknown error'}`;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
        
        alert('Lỗi khi xóa người dùng: ' + (error.error?.message || error.message || 'Unknown error'));
        
        // Reload to get current state from server
        setTimeout(() => {
          this.loadCustomers();
        }, 500);
      }
    });
  }

  onModalClosed() {
    this.showModal = false;
    this.selectedCustomer = null;
    this.cdr.markForCheck();
  }

  onCustomerSaved(): void {
    // Ensure modal state is reset
    this.showModal = false;
    this.isEditing = false;
    this.selectedCustomer = null;
    this.cdr.markForCheck();
    
    // Force reload customers immediately - same as add user
    this.loadCustomers();
    
    // Force change detection after reload
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 100);
  }
}

