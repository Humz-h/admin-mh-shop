// Import các module và service cần thiết
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService, Product, ProductResponse, ProductDetail, ProductVariant } from '../services/product';
import { HttpClientModule } from '@angular/common/http';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { ProductInsertEdit } from '../product-insert-edit/product-insert-edit';

// Interface mở rộng Product với các thuộc tính bổ sung
interface ProductWithExtras extends Product {
  sku?: string;           // Mã SKU sản phẩm
  originalPrice?: number; // Giá gốc
  salePrice?: number;     // Giá khuyến mãi
  productDetails?: ProductDetail[]; // Chi tiết sản phẩm
  productVariants?: ProductVariant[]; // Biến thể sản phẩm
}

// Component quản lý danh sách sản phẩm
@Component({
  selector: 'app-product-list',
  imports: [CommonModule, FormsModule, HttpClientModule, ProductInsertEdit],
  templateUrl: './product-list.html',
  styleUrl: './product-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductList implements OnInit, OnDestroy {
  // Danh sách sản phẩm gốc và đã lọc
  products: ProductWithExtras[] = [];
  filteredProducts: ProductWithExtras[] = [];
  
  // Các biến tìm kiếm và sắp xếp
  searchTerm: string = '';        // Từ khóa tìm kiếm
  selectedCategory: string = '';  // Danh mục được chọn
  sortBy: string = 'name';        // Tiêu chí sắp xếp
  
  // Trạng thái loading và lỗi
  isLoading: boolean = false;     // Đang tải dữ liệu
  isLoadingMore: boolean = false; // Đang tải thêm dữ liệu
  isSaving: boolean = false;      // Đang lưu sản phẩm
  error: string = '';             // Thông báo lỗi
  showSkeleton: boolean = true;   // Hiển thị skeleton loading
  saveError: string = '';         // Lỗi khi lưu sản phẩm
  saveSuccess: string = '';       // Thông báo thành công
  
  // Performance và lifecycle
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  
  // Phân trang
  currentPage: number = 1;        // Trang hiện tại
  itemsPerPage: number = 10;      // Số sản phẩm mỗi trang
  totalPages: number = 1;         // Tổng số trang
  
  // Modal thêm/sửa sản phẩm
  showModal: boolean = false;     // Hiển thị modal
  isEditing: boolean = false;     // Đang chỉnh sửa hay thêm mới
  selectedProduct: ProductWithExtras = this.getEmptyProduct(); // Sản phẩm được chọn
  selectedFile: File | null = null; // File ảnh được chọn
  previewImageUrl: string = '';   // URL preview ảnh (Base64)
  
  // Quản lý ProductDetails và ProductVariants
  productDetails: ProductDetail[] = [];
  productVariants: ProductVariant[] = [];
  
  // Math object để sử dụng trong template
  Math = Math;

  // Constructor - inject ProductService và Router
  constructor(
    private productService: ProductService,
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
      this.filterProducts();
    });
  }

  // Khởi tạo component - tải danh sách sản phẩm
  ngOnInit() {
    this.loadProducts();
  }

  // Cleanup khi component bị destroy
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Tải danh sách sản phẩm từ API với cache
  loadProducts(forceReload: boolean = false) {
    this.isLoading = true;
    this.showSkeleton = true;
    this.error = '';
    
    console.log('Loading products...');
    
    // Sử dụng getAllProducts để load nhanh hơn
    this.productService.getAllProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          console.log('Products received:', products.length);
          // Map dữ liệu sản phẩm và thêm các thuộc tính bổ sung
          this.products = products.map(product => ({
            ...product,
            sku: product.productCode || `SKU-${product.id.toString().padStart(3, '0')}`,  // Sử dụng productCode từ API hoặc tạo SKU
            category: product.category || this.getCategoryFromName(product.name),      // Sử dụng category từ API hoặc phân loại theo tên
            status: product.status !== undefined ? product.status : (product.stock > 0),    // Sử dụng status từ API hoặc theo tồn kho
            createdAt: product.createdAt ? new Date(product.createdAt) : new Date()      // Parse createdAt từ API
          }));
          
          this.totalPages = Math.ceil(this.products.length / this.itemsPerPage);
          this.filteredProducts = [...this.products];
          
          this.isLoading = false;
          this.showSkeleton = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading products:', error);
          this.isLoading = false;
          this.showSkeleton = false;
          this.error = 'Không thể tải danh sách sản phẩm. Vui lòng thử lại sau.';
          
          // Load sample data khi API lỗi
          this.loadSampleProducts();
          this.cdr.markForCheck();
        }
      });
  }

  // Load sample products khi API lỗi
  private loadSampleProducts() {
    console.log('Loading sample products...');
    const sampleProducts: ProductWithExtras[] = [
      {
        id: 1,
        name: 'iPhone 15 Pro',
        description: 'Điện thoại thông minh cao cấp',
        price: 25000000,
        imageUrl: 'https://via.placeholder.com/300x300?text=iPhone+15+Pro',
        stock: 50,
        sku: 'SKU-001',
        category: 'Điện thoại',
        productGroup: 'Điện tử',
        productCode: 'IP15P',
        status: true,
        createdAt: new Date()
      },
      {
        id: 2,
        name: 'Samsung Galaxy S24',
        description: 'Điện thoại Android flagship',
        price: 22000000,
        imageUrl: 'https://via.placeholder.com/300x300?text=Galaxy+S24',
        stock: 30,
        sku: 'SKU-002',
        category: 'Điện thoại',
        productGroup: 'Điện tử',
        productCode: 'SGS24',
        status: true,
        createdAt: new Date()
      },
      {
        id: 3,
        name: 'MacBook Pro M3',
        description: 'Laptop cao cấp cho công việc',
        price: 45000000,
        imageUrl: 'https://via.placeholder.com/300x300?text=MacBook+Pro',
        stock: 15,
        sku: 'SKU-003',
        category: 'Laptop',
        productGroup: 'Điện tử',
        productCode: 'MBPM3',
        status: true,
        createdAt: new Date()
      }
    ];
    
    this.products = sampleProducts;
    this.filteredProducts = [...this.products];
    this.totalPages = Math.ceil(this.products.length / this.itemsPerPage);
    this.cdr.markForCheck();
  }

  // Fallback method để load tất cả sản phẩm
  private loadAllProducts() {
    this.productService.getAllProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          // Map dữ liệu sản phẩm và thêm các thuộc tính bổ sung
          this.products = products.map(product => ({
            ...product,
        sku: `SKU-${product.id.toString().padStart(3, '0')}`,  // Tạo mã SKU
        category: this.getCategoryFromName(product.name),      // Phân loại theo tên
        status: product.stock > 0,    // Trạng thái theo tồn kho
        createdAt: new Date()                                  // Ngày tạo
          }));
          
          this.filterProducts();  // Áp dụng bộ lọc hiện tại
          this.isLoading = false;
          this.showSkeleton = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading products:', error);
          this.error = 'Không thể tải danh sách sản phẩm. Vui lòng thử lại sau.';
          this.isLoading = false;
          this.showSkeleton = false;
          this.cdr.markForCheck();
        }
      });
  }


  // Phân loại sản phẩm dựa trên tên sản phẩm
  getCategoryFromName(name: string): string {
    const nameLower = name.toLowerCase();
    
    // Kiểm tra các từ khóa để phân loại
    if (nameLower.includes('điện thoại') || nameLower.includes('iphone') || nameLower.includes('samsung') || nameLower.includes('máy tính') || nameLower.includes('tivi')) {
      return 'Điện tử';  // Điện tử
    } else if (nameLower.includes('áo') || nameLower.includes('quần') || nameLower.includes('thời trang')) {
      return 'Thời trang';     // Thời trang
    } else if (nameLower.includes('sách') || nameLower.includes('book')) {
      return 'Sách';        // Sách
    } else if (nameLower.includes('máy') || nameLower.includes('điều hòa') || nameLower.includes('giặt') || nameLower.includes('tủ lạnh')) {
      return 'Điện gia dụng';         // Điện gia dụng
    }
    return 'Điện tử';    // Danh mục mặc định
  }

  // Tạo SKU tự động
  generateSKU(): string {
    const timestamp = Date.now().toString().slice(-6); // 6 số cuối của timestamp
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0'); // 3 số ngẫu nhiên
    return `SKU-${timestamp}-${random}`;
  }

  // Tạo object sản phẩm rỗng cho form thêm mới
  getEmptyProduct(): ProductWithExtras {
    const emptyProduct = {
      id: 0,
      name: '',
      description: '',
      originalPrice: 0,
      salePrice: 0,
      price: 0,
      imageUrl: '',
      status: true,
      category: 'Điện tử',
      productGroup: 'Sản phẩm',
      productCode: `PRD-${Date.now()}`,
      stock: 0,
      createdAt: new Date(),
      sku: this.generateSKU(),
      productDetails: [],
      productVariants: []
    };
    
    // Khởi tạo arrays
    this.productDetails = [];
    this.productVariants = [];
    
    return emptyProduct;
  }

  // Lọc sản phẩm theo từ khóa tìm kiếm và danh mục
  filterProducts() {
    let filtered = [...this.products];

    // Lọc theo từ khóa tìm kiếm (tên sản phẩm hoặc SKU)
    if (this.searchTerm) {
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (product.sku && product.sku.toLowerCase().includes(this.searchTerm.toLowerCase()))
      );
    }

    // Lọc theo danh mục được chọn
    if (this.selectedCategory) {
      filtered = filtered.filter(product => product.category === this.selectedCategory);
    }

    this.filteredProducts = filtered;
    this.currentPage = 1;  // Reset về trang đầu
    this.calculateTotalPages();
    this.cdr.markForCheck();
  }

  // Tìm kiếm với debounce để tối ưu performance
  onSearchInput() {
    this.searchSubject.next(this.searchTerm);
  }

  // Sắp xếp danh sách sản phẩm theo tiêu chí được chọn
  sortProducts() {
    this.filteredProducts.sort((a, b) => {
      switch (this.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);  // Sắp xếp theo tên A-Z
        case 'price':
          return a.price - b.price;             // Sắp xếp theo giá tăng dần
        case 'stock':
          return a.stock - b.stock;             // Sắp xếp theo tồn kho tăng dần
        case 'date':
          return new Date(b.createdAt || new Date()).getTime() - new Date(a.createdAt || new Date()).getTime(); // Sắp xếp theo ngày tạo mới nhất
        default:
          return 0;
      }
    });
  }

  // Tính tổng số trang dựa trên số sản phẩm đã lọc
  calculateTotalPages() {
    this.totalPages = Math.ceil(this.filteredProducts.length / this.itemsPerPage);
  }

  // Lấy danh sách số trang để hiển thị (chỉ hiển thị 5 trang xung quanh trang hiện tại)
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const startPage = Math.max(1, this.currentPage - 2);  // Trang bắt đầu
    const endPage = Math.min(this.totalPages, this.currentPage + 2);  // Trang kết thúc
    
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

  // Lấy danh sách sản phẩm cho trang hiện tại (phân trang)
  getPaginatedProducts(): Product[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredProducts.slice(startIndex, endIndex);
  }

  // Load more products (infinite scroll)
  loadMoreProducts() {
    if (this.isLoadingMore || this.currentPage >= this.totalPages) {
      return;
    }

    this.isLoadingMore = true;
    this.currentPage++;
    
    this.productService.getProductsPaginated(this.currentPage, this.itemsPerPage, this.searchTerm)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const newProducts: ProductWithExtras[] = response.data.map(product => ({
            ...product,
            sku: `SKU-${product.id.toString().padStart(3, '0')}`,
            category: this.getCategoryFromName(product.name),
            status: product.stock > 0,
            createdAt: new Date()
          }));
          
          this.products = [...this.products, ...newProducts];
          this.filteredProducts = [...this.filteredProducts, ...newProducts];
          this.isLoadingMore = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading more products:', error);
          this.isLoadingMore = false;
          this.currentPage--; // Revert page increment
          this.cdr.markForCheck();
        }
      });
  }

  // Track function cho ngFor để tối ưu performance
  trackByProductId(index: number, product: ProductWithExtras): number {
    return product.id;
  }

  // Track function cho index
  trackByIndex(index: number, item: any): number {
    return index;
  }

  // Lấy URL hình ảnh sản phẩm với fallback
  getProductImage(product: ProductWithExtras): string {
    if (product.imageUrl && product.imageUrl.trim() !== '') {
      return product.imageUrl;
    }
    
    // Tạo hình ảnh placeholder dựa trên danh mục sản phẩm
    const category = product.category || 'electronics';
    const colors = {
      'electronics': '4F46E5', // Indigo
      'clothing': 'EC4899',    // Pink
      'books': '10B981',       // Emerald
      'home': 'F59E0B'         // Amber
    };
    
    const color = colors[category as keyof typeof colors] || '6B7280';
    return `https://via.placeholder.com/100x100/${color}/FFFFFF?text=${encodeURIComponent(product.name.charAt(0).toUpperCase())}`;
  }

  // Xử lý lỗi khi load hình ảnh
  onImageError(event: any): void {
    event.target.src = 'https://via.placeholder.com/100x100?text=No+Image';
  }

  // Trigger file input
  triggerFileInput(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const fileInput = document.getElementById('productImage') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  // Xử lý khi chọn file ảnh
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validate file
      if (!file.type.startsWith('image/')) {
        alert('Vui lòng chọn file ảnh hợp lệ!');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) { // 5MB
        alert('Kích thước file không được vượt quá 5MB!');
        return;
      }
      
      this.selectedFile = file;
      
      // Tạo preview URL (chỉ để hiển thị, không lưu vào selectedProduct.imageUrl)
      const reader = new FileReader();
      reader.onload = (e) => {
        // Tạo một property riêng cho preview
        this.previewImageUrl = e.target?.result as string;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    }
  }

  // Xóa hình ảnh
  removeImage(event: Event): void {
    event.stopPropagation();
    this.selectedProduct.imageUrl = '';
    this.selectedFile = null;
    this.previewImageUrl = '';
    this.cdr.markForCheck();
  }

  // Format kích thước file
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Format tiền tệ theo định dạng Việt Nam
  formatCurrency(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  // Chuyển đổi mã danh mục thành tên hiển thị tiếng Việt
  getCategoryName(category: string | undefined): string {
    if (!category) return 'Chưa phân loại';
    return category; // API đã trả về tên tiếng Việt
  }

  // Chuyển đổi mã trạng thái thành tên hiển thị tiếng Việt
  getStatusText(status: boolean | undefined): string {
    if (status === undefined || status === null) return 'Chưa xác định';
    return status ? 'Hoạt động' : 'Không hoạt động';
  }

  // Mở modal thêm sản phẩm mới
  openAddProductModal() {
    console.log('=== ADD PRODUCT MODAL OPENED ===');
    console.log('Add product clicked');
    console.log('Current showModal state:', this.showModal);
    
    this.isEditing = false;
    this.selectedProduct = this.getEmptyProduct();
    this.showModal = true;
    this.previewImageUrl = '';
    this.selectedFile = null;
    this.saveError = '';
    this.saveSuccess = '';
    
    // Thêm ít nhất một ProductDetail và ProductVariant mặc định
    this.addProductDetail();
    this.addProductVariant();
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    
    console.log('Modal opened, selectedProduct:', this.selectedProduct);
    console.log('Is editing:', this.isEditing);
    console.log('ShowModal after set:', this.showModal);
    
    // Force change detection
    this.cdr.detectChanges();
    
    // Double check after a tick
    setTimeout(() => {
      console.log('Modal state after timeout:', this.showModal);
      this.cdr.markForCheck();
    }, 100);
  }

  // Tạo SKU mới
  generateNewSKU() {
    this.selectedProduct.sku = this.generateSKU();
  }

  // Thêm ProductDetail mới
  addProductDetail() {
    const newDetail: ProductDetail = {
      id: 0,
      productId: this.selectedProduct.id,
      brand: '',
      origin: '',
      warranty: '',
      specifications: '',
      features: '',
      additionalInfo: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.productDetails.push(newDetail);
    this.selectedProduct.productDetails = [...this.productDetails];
  }

  // Xóa ProductDetail
  removeProductDetail(index: number) {
    this.productDetails.splice(index, 1);
    this.selectedProduct.productDetails = [...this.productDetails];
  }

  // Thêm ProductVariant mới
  addProductVariant() {
    const newVariant: ProductVariant = {
      id: 0,
      productId: this.selectedProduct.id,
      variantName: '',
      attributes: '',
      price: 0,
      sku: this.generateSKU(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.productVariants.push(newVariant);
    this.selectedProduct.productVariants = [...this.productVariants];
  }

  // Xóa ProductVariant
  removeProductVariant(index: number) {
    this.productVariants.splice(index, 1);
    this.selectedProduct.productVariants = [...this.productVariants];
  }

  // Mở modal chỉnh sửa sản phẩm
  editProduct(product: ProductWithExtras) {
    console.log('=== EDIT PRODUCT CLICKED ===');
    console.log('Original product:', product);
    console.log('Current showModal state:', this.showModal);
    
    this.isEditing = true;
    
    // Deep copy sản phẩm để tránh thay đổi dữ liệu gốc
    this.selectedProduct = {
      id: product.id,
      name: product.name || '',
      description: product.description || '',
      originalPrice: product.originalPrice || 0,
      salePrice: product.salePrice || 0,
      price: Number(product.price) || 0,
      imageUrl: product.imageUrl || '',
      status: product.status !== undefined ? product.status : true,
      category: product.category || 'Điện tử',
      productGroup: product.productGroup || 'Sản phẩm',
      productCode: product.productCode || `PRD-${Date.now()}`,
      stock: Number(product.stock) || 0,
      createdAt: product.createdAt || new Date(),
      sku: product.sku || this.generateSKU(),
      productDetails: product.productDetails || [],
      productVariants: product.productVariants || []
    };
    
    // Khởi tạo arrays từ selectedProduct
    this.productDetails = [...(product.productDetails || [])];
    this.productVariants = [...(product.productVariants || [])];
    
    // Nếu không có details/variants, tạo một cái mặc định
    if (this.productDetails.length === 0) {
      this.addProductDetail();
    }
    if (this.productVariants.length === 0) {
      this.addProductVariant();
    }
    
    console.log('Copied selectedProduct:', this.selectedProduct);
    console.log('Data types:', {
      id: typeof this.selectedProduct.id,
      name: typeof this.selectedProduct.name,
      price: typeof this.selectedProduct.price,
      stock: typeof this.selectedProduct.stock
    });
    
    this.showModal = true;
    this.previewImageUrl = '';
    this.selectedFile = null;
    this.saveError = '';
    this.saveSuccess = '';
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    
    console.log('Modal opened for editing');
    console.log('ShowModal after set:', this.showModal);
    
    // Force change detection
    this.cdr.detectChanges();
    
    // Double check after a tick
    setTimeout(() => {
      console.log('Modal state after timeout:', this.showModal);
      this.cdr.markForCheck();
    }, 100);
  }

  // Xem chi tiết sản phẩm (chức năng tạm thời)
  viewProduct(product: ProductWithExtras) {
    // TODO: Implement view product functionality
    console.log('View product:', product);
    alert(`Xem chi tiết sản phẩm: ${product.name}`);
  }

  // Xóa sản phẩm với xác nhận
  deleteProduct(product: ProductWithExtras) {
    console.log('=== DELETE PRODUCT CLICKED ===');
    console.log('Product to delete:', product);
    
    if (confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${product.name}"?`)) {
      console.log('User confirmed deletion, proceeding...');
      
      this.productService.deleteProduct(product.id).subscribe({
        next: () => {
          console.log('Product deleted successfully');
          // Xóa khỏi danh sách hiện tại
          this.products = this.products.filter(p => p.id !== product.id);
          this.filterProducts(); // Cập nhật danh sách đã lọc
          this.cdr.markForCheck();
          
          // Hiển thị thông báo thành công
          alert('Xóa sản phẩm thành công!');
        },
        error: (error) => {
          console.error('Error deleting product:', error);
          console.error('Error details:', {
            status: error.status,
            message: error.message,
            error: error.error
          });
          
          let errorMessage = 'Không thể xóa sản phẩm. Vui lòng thử lại sau.';
          if (error.status === 404) {
            errorMessage = 'Sản phẩm không tồn tại.';
          } else if (error.status === 403) {
            errorMessage = 'Bạn không có quyền xóa sản phẩm này.';
          } else if (error.status === 500) {
            errorMessage = 'Lỗi server. Vui lòng thử lại sau.';
          }
          
          alert(errorMessage);
        }
      });
    } else {
      console.log('User cancelled deletion');
    }
  }

  // Xử lý sự kiện click nút lưu
  onSaveProductClick(event: Event) {
    console.log('=== SAVE BUTTON CLICKED ===');
    console.log('Event:', event);
    console.log('Is editing:', this.isEditing);
    console.log('Selected product:', this.selectedProduct);
    
    // Ngăn form submit mặc định
    event.preventDefault();
    event.stopPropagation();
    
    // Kiểm tra form validation
    const form = (event.target as any).closest('form');
    if (form && !form.checkValidity()) {
      console.log('Form is invalid, showing validation errors');
      form.reportValidity();
      return;
    }
    
    console.log('Form is valid, proceeding with save');
    this.saveProduct();
  }

  // Lưu sản phẩm (thêm mới hoặc cập nhật)
  saveProduct() {
    console.log('=== SAVE PRODUCT CALLED ===');
    console.log('Is editing:', this.isEditing);
    console.log('Selected product:', this.selectedProduct);
    console.log('Product ID:', this.selectedProduct.id);
    console.log('Product name:', this.selectedProduct.name);
    console.log('Product price:', this.selectedProduct.price);
    console.log('Product stock:', this.selectedProduct.stock);
    console.log('Product description:', this.selectedProduct.description);
    console.log('Product imageUrl:', this.selectedProduct.imageUrl);
    
    // Bỏ qua hình ảnh, chỉ lưu dữ liệu cơ bản
    this.saveProductData();
  }

  // Hàm riêng để lưu product với validation và error handling cải tiến
  private saveProductData() {
    console.log('saveProductData() called');
    console.log('Is editing:', this.isEditing);
    
    // Clear previous messages
    this.saveError = '';
    this.saveSuccess = '';
    
    // Enhanced validation với thông báo chi tiết
    const validationResult = this.validateProductData();
    if (!validationResult.isValid) {
      this.saveError = validationResult.message;
      this.cdr.markForCheck();
      return;
    }
    
    console.log('Validation passed');

    // Chuẩn bị dữ liệu để gửi lên server với data cleaning
    try {
      const productData = this.prepareProductData();
      
      console.log('Product data to send:', productData);
      console.log('Data types:', {
        name: typeof productData.name,
        description: typeof productData.description,
        price: typeof productData.price,
        stock: typeof productData.stock,
        imageUrl: typeof productData.imageUrl
      });

      if (this.isEditing) {
        this.updateExistingProduct(productData);
      } else {
        this.createNewProduct(productData);
      }
    } catch (error) {
      console.error('Error preparing product data:', error);
      this.saveError = (error as Error).message || 'Có lỗi xảy ra khi chuẩn bị dữ liệu.';
      this.cdr.markForCheck();
    }
  }

  // Validation cải tiến cho dữ liệu sản phẩm
  private validateProductData(): { isValid: boolean; message: string } {
    console.log('=== VALIDATING PRODUCT DATA ===');
    console.log('Selected product:', this.selectedProduct);
    
    // Validate tên sản phẩm
    if (!this.selectedProduct.name || !this.selectedProduct.name.trim()) {
      return { isValid: false, message: 'Vui lòng nhập tên sản phẩm!' };
    }

    const name = this.selectedProduct.name.trim();
    if (name.length < 2) {
      return { isValid: false, message: 'Tên sản phẩm phải có ít nhất 2 ký tự!' };
    }

    if (name.length > 200) {
      return { isValid: false, message: 'Tên sản phẩm không được vượt quá 200 ký tự!' };
    }

    // Validate giá sản phẩm
    if (this.selectedProduct.price === null || this.selectedProduct.price === undefined) {
      return { isValid: false, message: 'Vui lòng nhập giá sản phẩm!' };
    }

    const price = Number(this.selectedProduct.price);
    if (isNaN(price)) {
      return { isValid: false, message: 'Giá sản phẩm phải là số hợp lệ!' };
    }

    if (price < 0) {
      return { isValid: false, message: 'Giá sản phẩm không được âm!' };
    }

    if (price > 1000000000) { // 1 tỷ VND
      return { isValid: false, message: 'Giá sản phẩm không được vượt quá 1 tỷ VND!' };
    }

    // Validate số lượng tồn kho
    if (this.selectedProduct.stock === null || this.selectedProduct.stock === undefined) {
      return { isValid: false, message: 'Vui lòng nhập số lượng tồn kho!' };
    }

    const stock = Number(this.selectedProduct.stock);
    if (isNaN(stock)) {
      return { isValid: false, message: 'Số lượng tồn kho phải là số hợp lệ!' };
    }

    if (stock < 0) {
      return { isValid: false, message: 'Số lượng tồn kho không được âm!' };
    }

    if (stock > 100000) {
      return { isValid: false, message: 'Số lượng tồn kho không được vượt quá 100,000!' };
    }

    // Validate mô tả (optional nhưng nếu có thì phải hợp lệ)
    if (this.selectedProduct.description && this.selectedProduct.description.trim().length > 1000) {
      return { isValid: false, message: 'Mô tả sản phẩm không được vượt quá 1000 ký tự!' };
    }

    console.log('Validation passed for:', {
      name: name,
      price: price,
      stock: stock,
      description: this.selectedProduct.description?.trim() || ''
    });

    return { isValid: true, message: '' };
  }

  // Chuẩn bị dữ liệu sản phẩm để gửi lên server
  private prepareProductData() {
    // Đảm bảo dữ liệu được chuẩn hóa trước khi gửi
    const name = this.selectedProduct.name?.trim() || '';
    const description = this.selectedProduct.description?.trim() || '';
    const price = Number(this.selectedProduct.price) || 0;
    const originalPrice = Number(this.selectedProduct.originalPrice) || 0;
    const salePrice = Number(this.selectedProduct.salePrice) || 0;
    const stock = Number(this.selectedProduct.stock) || 0;
    const imageUrl = this.selectedProduct.imageUrl?.trim() || 'https://via.placeholder.com/300x300?text=No+Image';
    const category = this.selectedProduct.category?.trim() || 'Điện tử';
    const productGroup = this.selectedProduct.productGroup?.trim() || 'Sản phẩm';
    const productCode = this.selectedProduct.productCode?.trim() || `PRD-${Date.now()}`;
    const status = this.selectedProduct.status !== undefined ? this.selectedProduct.status : true;
    
    const productData = {
      name: name,
      description: description,
      originalPrice: originalPrice,
      salePrice: salePrice,
      price: price,
      imageUrl: imageUrl,
      status: status,
      category: category,
      productGroup: productGroup,
      productCode: productCode,
      stock: stock,
      productDetails: this.productDetails,
      productVariants: this.productVariants
    };
    
    console.log('=== PREPARED PRODUCT DATA ===');
    console.log('Raw selectedProduct:', this.selectedProduct);
    console.log('Prepared data:', productData);
    console.log('Data types:', {
      name: typeof productData.name,
      description: typeof productData.description,
      price: typeof productData.price,
      stock: typeof productData.stock,
      imageUrl: typeof productData.imageUrl
    });
    console.log('Data values:', {
      name: productData.name,
      description: productData.description,
      price: productData.price,
      stock: productData.stock,
      imageUrl: productData.imageUrl
    });
    
    // Validate dữ liệu trước khi return - linh hoạt hơn
    if (!name) {
      throw new Error('Tên sản phẩm không được để trống');
    }
    if (price < 0) {
      throw new Error('Giá sản phẩm không được âm');
    }
    if (stock < 0) {
      throw new Error('Số lượng tồn kho không được âm');
    }
    
    return productData;
  }

  // Cập nhật sản phẩm hiện có
  private updateExistingProduct(productData: any) {
    console.log('=== UPDATE EXISTING PRODUCT ===');
    console.log('Product ID:', this.selectedProduct.id);
    console.log('Update data:', productData);
    
    this.isSaving = true;
    this.saveError = '';
    this.saveSuccess = '';
    this.cdr.markForCheck();
    
    // Thực hiện update trực tiếp
    this.performUpdate(productData);
  }

  // Thực hiện update sản phẩm
  private performUpdate(productData: any) {
    console.log('=== PERFORMING UPDATE ===');
    console.log('Product ID:', this.selectedProduct.id);
    console.log('Update data:', productData);
    
    this.productService.updateProduct(this.selectedProduct.id, productData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedProduct) => {
          console.log('=== UPDATE SUCCESSFUL ===');
          console.log('Updated product:', updatedProduct);
          
          // Cập nhật trong danh sách
          this.updateProductInList(updatedProduct, productData);
          this.filterProducts();
          
          this.saveSuccess = 'Cập nhật sản phẩm thành công!';
          this.isSaving = false;
          
          // Đóng modal sau 1 giây
          setTimeout(() => {
            this.closeModal();
            this.refreshProducts();
          }, 1000);
          
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('=== UPDATE ERROR ===');
          console.error('Error details:', {
            status: error.status,
            message: error.message,
            originalError: error.originalError,
            error: error.error
          });
          this.isSaving = false;
          this.handleUpdateError(error);
          this.cdr.markForCheck();
        }
      });
  }

  // Tạo sản phẩm mới với error handling cải tiến
  private createNewProduct(productData: any) {
    console.log('=== CREATING NEW PRODUCT ===');
    console.log('Product data:', productData);
    
    // Set loading state và clear previous messages
    this.isSaving = true;
    this.saveError = '';
    this.saveSuccess = '';
    this.cdr.markForCheck();
    
    // Kiểm tra dữ liệu trước khi gửi
    if (!productData.name || productData.price === undefined || productData.stock === undefined) {
      this.isSaving = false;
      this.saveError = 'Vui lòng điền đầy đủ thông tin bắt buộc.';
      this.cdr.markForCheck();
      return;
    }
    
    console.log('Calling productService.createProduct...');
    this.productService.createProduct(productData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newProduct) => {
          console.log('=== PRODUCT CREATED SUCCESSFULLY ===');
          console.log('New product:', newProduct);
          
          // Thêm vào danh sách hiện tại
          this.addProductToList(newProduct);
          
          // Refresh filtered products
          this.filterProducts();
          
          // Show success message
          this.saveSuccess = 'Tạo sản phẩm thành công!';
          this.saveError = '';
          this.isSaving = false;
          
          // Auto close modal after 1.5 seconds
          setTimeout(() => {
            this.closeModal();
            this.refreshProducts();
          }, 1500);
          
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('=== ERROR CREATING PRODUCT ===');
          console.error('Error details:', error);
          this.isSaving = false;
          
          // Enhanced error handling
          this.handleCreateError(error);
          this.cdr.markForCheck();
        }
      });
  }

  // Cập nhật sản phẩm trong danh sách
  private updateProductInList(updatedProduct: Product, productData: any) {
    const index = this.products.findIndex(p => p.id === this.selectedProduct.id);
    if (index !== -1) {
      // Cập nhật tất cả các field và giữ lại các field bổ sung
      this.products[index] = { 
        ...this.products[index], 
        name: productData.name,
        description: productData.description,
        price: productData.price,
        stock: productData.stock,
        imageUrl: productData.imageUrl,
        status: productData.stock > 0 // Update status based on stock
      };
      console.log('Updated product in list at index:', index);
    }
  }

  // Thêm sản phẩm mới vào danh sách
  private addProductToList(newProduct: Product) {
    const productWithExtras: ProductWithExtras = {
      ...newProduct,
      sku: this.selectedProduct.sku, // Sử dụng SKU đã tạo
      category: newProduct.category || this.getCategoryFromName(newProduct.name),
      status: newProduct.status !== undefined ? newProduct.status : (newProduct.stock > 0),
      createdAt: newProduct.createdAt ? new Date(newProduct.createdAt) : new Date(),
      imageUrl: this.selectedProduct.imageUrl || 'https://via.placeholder.com/300x300?text=No+Image'
    };
    this.products.push(productWithExtras);
  }

  // Xử lý lỗi khi update sản phẩm
  private handleUpdateError(error: any) {
    let errorMessage = '';
    
    console.log('Handle update error:', error);
    
    // Xử lý các loại lỗi khác nhau
    if (error.status === 400) {
      errorMessage = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin sản phẩm.';
    } else if (error.status === 401) {
      errorMessage = 'Không có quyền truy cập. Vui lòng đăng nhập lại hoặc liên hệ quản trị viên.';
    } else if (error.status === 403) {
      errorMessage = 'Bạn không có quyền thực hiện thao tác này.';
    } else if (error.status === 404) {
      errorMessage = 'Không tìm thấy sản phẩm cần cập nhật.';
    } else if (error.status === 500) {
      errorMessage = 'Lỗi server. Vui lòng thử lại sau.';
    } else if (error.status === 0) {
      errorMessage = 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.';
    } else if (error.message) {
      errorMessage = error.message;
    } else {
      errorMessage = 'Có lỗi xảy ra khi cập nhật sản phẩm.';
    }
    
    // Set error message for UI display
    this.saveError = errorMessage;
    this.saveSuccess = '';
    
    // Auto clear error message after 5 seconds
    setTimeout(() => {
      this.saveError = '';
      this.cdr.markForCheck();
    }, 5000);
  }

  // Xử lý lỗi khi tạo sản phẩm mới
  private handleCreateError(error: any) {
    let errorMessage = '';
    
    console.log('Handle create error:', error);
    console.log('Error status:', error.status);
    console.log('Error message:', error.message);
    console.log('Original error:', error.originalError);
    
    // Xử lý các loại lỗi khác nhau
    if (error.status === 400) {
      errorMessage = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin sản phẩm.';
    } else if (error.status === 401) {
      errorMessage = 'Không có quyền truy cập. Vui lòng đăng nhập lại hoặc liên hệ quản trị viên.';
    } else if (error.status === 403) {
      errorMessage = 'Bạn không có quyền thực hiện thao tác này.';
    } else if (error.status === 500) {
      errorMessage = 'Lỗi server. Vui lòng thử lại sau.';
    } else if (error.status === 0) {
      errorMessage = 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.';
    } else if (error.originalError && error.originalError.error) {
      // Hiển thị lỗi chi tiết từ server
      const serverError = error.originalError.error;
      if (typeof serverError === 'string') {
        errorMessage = serverError;
      } else if (serverError.message) {
        errorMessage = serverError.message;
      } else if (serverError.error) {
        errorMessage = serverError.error;
      } else {
        errorMessage = 'Có lỗi xảy ra khi tạo sản phẩm mới.';
      }
    } else if (error.message) {
      errorMessage = error.message;
    } else {
      errorMessage = 'Có lỗi xảy ra khi tạo sản phẩm mới.';
    }
    
    // Set error message for UI display
    this.saveError = errorMessage;
    this.saveSuccess = '';
    
    // Auto clear error message after 5 seconds
    setTimeout(() => {
      this.saveError = '';
      this.cdr.markForCheck();
    }, 5000);
  }

  // Hiển thị thông báo thành công
  private showSuccessMessage(message: string) {
    console.log('Success message:', message);
    // Có thể thay thế alert bằng toast notification trong tương lai
    alert(message);
  }

  // Hiển thị thông báo lỗi
  private showErrorMessage(message: string) {
    console.error('Error message:', message);
    alert(message);
  }

  // Xử lý khi sản phẩm được lưu thành công từ component con
  onProductSaved(savedProduct: any) {
    console.log('Product saved from child component:', savedProduct);
    
    if (this.isEditing) {
      // Cập nhật sản phẩm trong danh sách
      const index = this.products.findIndex(p => p.id === savedProduct.id);
      if (index !== -1) {
        this.products[index] = { ...this.products[index], ...savedProduct };
        this.filteredProducts = [...this.products];
        this.cdr.markForCheck();
      }
    } else {
      // Thêm sản phẩm mới vào danh sách
      this.products.unshift(savedProduct);
      this.filteredProducts = [...this.products];
      this.cdr.markForCheck();
    }
    
    // Đóng modal
    this.closeModal();
  }

  // Đóng modal và reset dữ liệu
  closeModal() {
    console.log('=== CLOSING MODAL ===');
    this.showModal = false;
    this.selectedProduct = this.getEmptyProduct();
    this.selectedFile = null;
    this.previewImageUrl = '';
    this.isSaving = false;
    this.saveError = '';
    this.saveSuccess = '';
    this.isEditing = false;
    
    // Restore body scroll when modal is closed
    document.body.style.overflow = '';
    this.cdr.markForCheck();
  }

  // Quay lại trang Dashboard
  goBack() {
    this.router.navigate(['/dashboard']);
  }

  // Làm mới dữ liệu (force reload)
  refreshProducts() {
    this.loadProducts(true); // Force reload từ API
  }



}