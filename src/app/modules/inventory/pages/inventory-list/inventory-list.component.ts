import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Inventory, InventoryService } from '../../services/inventory.service';
import { catchError, timeout } from 'rxjs/operators';
import { Subject, takeUntil } from 'rxjs';
import { of } from 'rxjs';
import { BadgeComponent } from '../../../../shared/components/ui/badge/badge.component';

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [CommonModule, BadgeComponent],
  templateUrl: './inventory-list.component.html',
  styleUrls: ['./inventory-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryListComponent implements OnInit, OnDestroy {
  inventories: Inventory[] = [];
  loading = false;
  errorMessage = '';
  showSkeleton = true;
  
  private destroy$ = new Subject<void>();
  private readonly inventoryService = inject(InventoryService);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.loadInventories();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadInventories() {
    this.loading = true;
    this.showSkeleton = true;
    this.errorMessage = '';
    this.inventories = [];
    
    this.inventoryService.getInventories().pipe(
      timeout(10000),
      takeUntil(this.destroy$),
      catchError((error) => {
        this.loading = false;
        this.showSkeleton = false;
        if (error.name === 'TimeoutError') {
          this.errorMessage = 'Yêu cầu quá thời gian chờ. Vui lòng kiểm tra kết nối mạng và thử lại.';
        } else if (error.status === 404) {
          this.errorMessage = `Endpoint không tồn tại (404). Kiểm tra endpoint API tại http://localhost:5000/api/Inventory hoặc http://localhost:5000/api/Inventories`;
        } else if (error.status === 0) {
          this.errorMessage = 'Không thể kết nối đến server. Vui lòng đảm bảo server đang chạy tại http://localhost:5000';
        } else {
          this.errorMessage = `Lỗi khi tải dữ liệu: ${error.status || error.message || 'Lỗi không xác định'}`;
        }
        this.inventories = [];
        this.cdr.markForCheck();
        return of([]);
      })
    ).subscribe({
      next: (data) => {
        if (!data || (Array.isArray(data) && data.length === 0)) {
          this.inventories = [];
        } else if (Array.isArray(data)) {
          this.inventories = data
            .filter(item => item != null && typeof item === 'object')
            .map((item: Inventory) => ({
              ...item,
              quantity: Number(item.quantity) || 0,
              daysInStock: Number(item.daysInStock) || 0,
              productId: item.productId || item.id || 0
            }));
        } else if (data && typeof data === 'object' && !Array.isArray(data)) {
          const inventoryData = data as Inventory;
          this.inventories = [{
            ...inventoryData,
            quantity: Number(inventoryData.quantity) || 0,
            daysInStock: Number(inventoryData.daysInStock) || 0,
            productId: inventoryData.productId || inventoryData.id || 0
          }];
        } else {
          this.inventories = [];
        }
        
        this.loading = false;
        this.showSkeleton = false;
        this.errorMessage = '';
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.loading = false;
        this.showSkeleton = false;
        this.errorMessage = 'Lỗi không xác định khi tải dữ liệu: ' + (error.message || 'Lỗi không xác định');
        this.inventories = [];
        this.cdr.markForCheck();
      }
    });
  }

  importStock(productId: number) {
    const quantity = prompt('Nhập số lượng nhập kho:');
    if (!quantity || isNaN(+quantity)) return;

    this.inventoryService.importStock(productId, +quantity).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        alert('Nhập hàng thành công');
        this.loadInventories();
      },
      error: () => {
        alert('Lỗi khi nhập hàng');
        this.cdr.markForCheck();
      }
    });
  }

  exportStock(productId: number) {
    const quantity = prompt('Nhập số lượng xuất kho:');
    if (!quantity || isNaN(+quantity)) return;

    this.inventoryService.exportStock(productId, +quantity).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        alert('Xuất hàng thành công');
        this.loadInventories();
      },
      error: () => {
        alert('Lỗi khi xuất hàng');
        this.cdr.markForCheck();
      }
    });
  }

  goBack() {
    window.history.back();
  }

  refreshInventories() {
    this.loadInventories();
  }

  trackByProductId(index: number, item: Inventory): number {
    return item.id || item.productId || index;
  }

  getProductName(item: Inventory): string {
    return item.productName || item.product?.name || item.product?.productName || 'N/A';
  }

  getProductCode(item: Inventory): string {
    return item.productCode || item.product?.productCode || 'N/A';
  }

  getQuantity(item: Inventory): number {
    return item.quantity || 0;
  }

  getDaysInStock(item: Inventory): number {
    return item.daysInStock || 0;
  }

  getProductId(item: Inventory): number {
    return item.productId || item.id || 0;
  }
}

