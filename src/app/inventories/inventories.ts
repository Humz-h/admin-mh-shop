// Import các module và service cần thiết
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InventoryService, ProcessedInventoryItem } from '../services/inventory';
import { HttpClientModule } from '@angular/common/http';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

// Sử dụng interface từ service
type InventoryItem = ProcessedInventoryItem;

// Component quản lý tồn kho
@Component({
  selector: 'app-inventories',
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './inventories.html',
  styleUrl: './inventories.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Inventories implements OnInit, OnDestroy {
  // Danh sách inventory items
  inventoryItems: InventoryItem[] = [];
  filteredItems: InventoryItem[] = [];
  
  // Các biến tìm kiếm và sắp xếp
  searchTerm: string = '';
  selectedCategory: string = '';
  selectedStatus: string = '';
  sortBy: string = 'productName';
  
  // Trạng thái loading và lỗi
  isLoading: boolean = false;
  error: string = '';
  showSkeleton: boolean = true;
  
  // Performance và lifecycle
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  
  // Phân trang
  currentPage: number = 1;
  itemsPerPage: number = 15;
  totalPages: number = 1;
  
  // Modal cập nhật tồn kho
  showModal: boolean = false;
  selectedItem: InventoryItem | null = null;
  newStock: number = 0;
  updateReason: string = '';
  
  // Math object để sử dụng trong template
  Math = Math;

  // Constructor
  constructor(
    private inventoryService: InventoryService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    // Setup search debouncing
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.searchTerm = searchTerm;
      this.filterItems();
    });
  }

  // Khởi tạo component
  ngOnInit() {
    this.loadInventoryData();
  }

  // Cleanup khi component bị destroy
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Tải dữ liệu tồn kho
  loadInventoryData() {
    this.isLoading = true;
    this.showSkeleton = true;
    this.error = '';
    
    console.log('Loading inventory data from API...');
    
    this.inventoryService.getAllInventoryItems()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          console.log('Inventory data loaded:', items);
          this.inventoryItems = items;
          this.filteredItems = [...this.inventoryItems];
          this.totalPages = Math.ceil(this.filteredItems.length / this.itemsPerPage);
          
          this.isLoading = false;
          this.showSkeleton = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading inventory data:', error);
          this.isLoading = false;
          this.showSkeleton = false;
          this.error = 'Không thể tải dữ liệu tồn kho. Vui lòng thử lại sau.';
          this.cdr.markForCheck();
        }
      });
  }


  // Lọc items theo từ khóa tìm kiếm, danh mục và trạng thái
  filterItems() {
    let filtered = [...this.inventoryItems];

    // Lọc theo từ khóa tìm kiếm
    if (this.searchTerm) {
      filtered = filtered.filter(item => 
        item.productName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    // Lọc theo danh mục
    if (this.selectedCategory) {
      filtered = filtered.filter(item => item.category === this.selectedCategory);
    }

    // Lọc theo trạng thái
    if (this.selectedStatus) {
      filtered = filtered.filter(item => item.status === this.selectedStatus);
    }

    this.filteredItems = filtered;
    this.currentPage = 1;
    this.calculateTotalPages();
    this.cdr.markForCheck();
  }

  // Tìm kiếm với debounce
  onSearchInput() {
    this.searchSubject.next(this.searchTerm);
  }

  // Sắp xếp danh sách
  sortItems() {
    this.filteredItems.sort((a, b) => {
      switch (this.sortBy) {
        case 'productName':
          return a.productName.localeCompare(b.productName);
        case 'currentStock':
          return a.currentStock - b.currentStock;
        case 'totalValue':
          return a.totalValue - b.totalValue;
        case 'lastUpdated':
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        default:
          return 0;
      }
    });
  }

  // Tính tổng số trang
  calculateTotalPages() {
    this.totalPages = Math.ceil(this.filteredItems.length / this.itemsPerPage);
  }

  // Lấy danh sách số trang để hiển thị
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(this.totalPages, this.currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Chuyển đến trang được chỉ định
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  // Lấy danh sách items cho trang hiện tại
  getPaginatedItems(): InventoryItem[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredItems.slice(startIndex, endIndex);
  }

  // Track function cho ngFor
  trackByItemId(index: number, item: InventoryItem): number {
    return item.id;
  }

  // Lấy URL hình ảnh sản phẩm
  getProductImage(item: InventoryItem): string {
    if (item.productImage && item.productImage.trim() !== '') {
      return item.productImage;
    }
    return 'https://via.placeholder.com/100x100?text=No+Image';
  }

  // Xử lý lỗi khi load hình ảnh
  onImageError(event: any): void {
    event.target.src = 'https://via.placeholder.com/100x100?text=No+Image';
  }

  // Format tiền tệ
  formatCurrency(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  // Chuyển đổi mã danh mục thành tên hiển thị
  getCategoryName(category: string): string {
    const categories: { [key: string]: string } = {
      'electronics': 'Điện tử',
      'clothing': 'Thời trang',
      'books': 'Sách',
      'home': 'Gia dụng'
    };
    return categories[category] || category;
  }

  // Chuyển đổi mã trạng thái thành tên hiển thị
  getStatusText(status: string): string {
    const statuses: { [key: string]: string } = {
      'in-stock': 'Còn hàng',
      'low-stock': 'Sắp hết',
      'out-of-stock': 'Hết hàng',
      'overstock': 'Tồn kho cao'
    };
    return statuses[status] || status;
  }

  // Lấy class CSS cho trạng thái
  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  // Mở modal cập nhật tồn kho
  openUpdateModal(item: InventoryItem) {
    this.selectedItem = { ...item };
    this.newStock = item.currentStock;
    this.updateReason = '';
    this.showModal = true;
  }

  // Cập nhật tồn kho
  updateStock() {
    if (!this.selectedItem) return;

    // Validation
    if (this.newStock < 0) {
      alert('Số lượng tồn kho không được âm!');
      return;
    }

    if (!this.updateReason.trim()) {
      alert('Vui lòng nhập lý do cập nhật!');
      return;
    }

    console.log('Updating inventory quantity for product:', this.selectedItem.productId, 'from:', this.selectedItem.currentStock, 'to:', this.newStock);

    // Gọi API để cập nhật quantity trong inventory
    const updateData = {
      productId: this.selectedItem.productId,
      newStock: this.newStock,
      reason: this.updateReason,
      updatedAt: new Date()
    };

    this.inventoryService.updateStock(updateData).subscribe({
      next: (updatedItem) => {
        console.log('Inventory quantity updated successfully:', updatedItem);
        
        // Cập nhật trong danh sách local
        const index = this.inventoryItems.findIndex(item => item.id === this.selectedItem!.id);
        if (index !== -1) {
          this.inventoryItems[index].currentStock = this.newStock;
          this.inventoryItems[index].lastUpdated = new Date();
          this.inventoryItems[index].totalValue = this.inventoryItems[index].unitPrice * this.newStock;
          // Cập nhật status dựa trên số lượng mới
          this.inventoryItems[index].status = this.getStockStatus(this.newStock, this.inventoryItems[index].minStock);
        }

        // Cập nhật filtered items
        this.filterItems();
        
        // Đóng modal
        this.closeModal();
        
        alert('Cập nhật tồn kho thành công!');
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error updating inventory quantity:', error);
        alert('Không thể cập nhật tồn kho. Vui lòng thử lại sau.');
      }
    });
  }

  // Helper method để xác định trạng thái tồn kho
  private getStockStatus(currentStock: number, minStock: number): 'in-stock' | 'low-stock' | 'out-of-stock' | 'overstock' {
    if (currentStock === 0) return 'out-of-stock';
    if (currentStock < minStock) return 'low-stock';
    if (currentStock > minStock * 5) return 'overstock';
    return 'in-stock';
  }

  // Đóng modal
  closeModal() {
    this.showModal = false;
    this.selectedItem = null;
    this.newStock = 0;
    this.updateReason = '';
  }

  // Quay lại dashboard
  goBack() {
    this.router.navigate(['/dashboard']);
  }

  // Làm mới dữ liệu
  refreshData() {
    this.loadInventoryData();
  }

  // Xóa bộ lọc
  clearFilters() {
    this.searchTerm = '';
    this.selectedCategory = '';
    this.selectedStatus = '';
    this.sortBy = 'productName';
    this.currentPage = 1;
    this.filterItems();
  }

  // Lấy thống kê tổng quan
  getInventoryStats() {
    const total = this.inventoryItems.length;
    const inStock = this.inventoryItems.filter(item => item.status === 'in-stock').length;
    const lowStock = this.inventoryItems.filter(item => item.status === 'low-stock').length;
    const outOfStock = this.inventoryItems.filter(item => item.status === 'out-of-stock').length;
    const totalValue = this.inventoryItems.reduce((sum, item) => sum + item.totalValue, 0);

    return {
      total,
      inStock,
      lowStock,
      outOfStock,
      totalValue
    };
  }

  // Kiểm tra xem có sự khác biệt giữa quantity và stock không
  hasStockDifference(item: InventoryItem): boolean {
    // Nếu có thông tin về product stock, so sánh với quantity
    // Hiện tại chúng ta chỉ có quantity từ inventory API
    return false; // Tạm thời return false vì chúng ta đang sử dụng quantity làm source of truth
  }
}
