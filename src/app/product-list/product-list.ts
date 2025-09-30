// Import các module và service cần thiết
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService, Product } from '../services/product';
import { HttpClientModule } from '@angular/common/http';

// Interface mở rộng Product với các thuộc tính bổ sung
interface ProductWithExtras extends Product {
  sku?: string;           // Mã SKU sản phẩm
  category?: string;      // Danh mục sản phẩm
  status?: 'active' | 'inactive' | 'draft';  // Trạng thái sản phẩm
  createdAt?: Date;       // Ngày tạo sản phẩm
}

// Component quản lý danh sách sản phẩm
@Component({
  selector: 'app-product-list',
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './product-list.html',
  styleUrl: './product-list.scss'
})
export class ProductList implements OnInit {
  // Danh sách sản phẩm gốc và đã lọc
  products: ProductWithExtras[] = [];
  filteredProducts: ProductWithExtras[] = [];
  
  // Các biến tìm kiếm và sắp xếp
  searchTerm: string = '';        // Từ khóa tìm kiếm
  selectedCategory: string = '';  // Danh mục được chọn
  sortBy: string = 'name';        // Tiêu chí sắp xếp
  
  // Trạng thái loading và lỗi
  isLoading: boolean = false;     // Đang tải dữ liệu
  error: string = '';             // Thông báo lỗi
  
  // Cache và performance
  private productsCache: ProductWithExtras[] | null = null;
  private lastLoadTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 phút
  private searchTimeout: any = null;
  
  // Phân trang
  currentPage: number = 1;        // Trang hiện tại
  itemsPerPage: number = 10;      // Số sản phẩm mỗi trang
  totalPages: number = 1;         // Tổng số trang
  
  // Modal thêm/sửa sản phẩm
  showModal: boolean = false;     // Hiển thị modal
  isEditing: boolean = false;     // Đang chỉnh sửa hay thêm mới
  selectedProduct: ProductWithExtras = this.getEmptyProduct(); // Sản phẩm được chọn
  
  // Math object để sử dụng trong template
  Math = Math;

  // Constructor - inject ProductService và Router
  constructor(
    private productService: ProductService,
    private router: Router
  ) {}

  // Khởi tạo component - tải danh sách sản phẩm
  ngOnInit() {
    this.loadProducts();
  }

  // Tải danh sách sản phẩm từ API với cache
  loadProducts(forceReload: boolean = false) {
    // Kiểm tra cache trước
    if (!forceReload && this.isCacheValid()) {
      this.products = this.productsCache!;
      this.filterProducts();
      return;
    }

    this.isLoading = true;
    this.error = '';
    
    this.productService.getAllProducts().subscribe({
      next: (products) => {
        // Map dữ liệu sản phẩm và thêm các thuộc tính bổ sung
        this.products = products.map(product => ({
          ...product,
          sku: `SKU-${product.id.toString().padStart(3, '0')}`,  // Tạo mã SKU
          category: this.getCategoryFromName(product.name),      // Phân loại theo tên
          status: product.stock > 0 ? 'active' : 'inactive',    // Trạng thái theo tồn kho
          createdAt: new Date()                                  // Ngày tạo
        }));
        
        // Lưu vào cache
        this.productsCache = [...this.products];
        this.lastLoadTime = Date.now();
        
        this.filterProducts();  // Áp dụng bộ lọc hiện tại
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.error = 'Không thể tải danh sách sản phẩm. Vui lòng thử lại sau.';
        this.isLoading = false;
      }
    });
  }

  // Kiểm tra cache có còn hiệu lực không
  private isCacheValid(): boolean {
    if (!this.productsCache || this.productsCache.length === 0) {
      return false;
    }
    return (Date.now() - this.lastLoadTime) < this.CACHE_DURATION;
  }

  // Phân loại sản phẩm dựa trên tên sản phẩm
  getCategoryFromName(name: string): string {
    const nameLower = name.toLowerCase();
    
    // Kiểm tra các từ khóa để phân loại
    if (nameLower.includes('điện thoại') || nameLower.includes('iphone') || nameLower.includes('samsung') || nameLower.includes('máy tính')) {
      return 'electronics';  // Điện tử
    } else if (nameLower.includes('áo') || nameLower.includes('quần') || nameLower.includes('thời trang')) {
      return 'clothing';     // Thời trang
    } else if (nameLower.includes('sách') || nameLower.includes('book')) {
      return 'books';        // Sách
    } else if (nameLower.includes('máy') || nameLower.includes('điều hòa') || nameLower.includes('giặt')) {
      return 'home';         // Gia dụng
    }
    return 'electronics';    // Danh mục mặc định
  }

  // Tạo object sản phẩm rỗng cho form thêm mới
  getEmptyProduct(): ProductWithExtras {
    return {
      id: 0,
      name: '',
      description: '',
      price: 0,
      imageUrl: '',
      stock: 0,
      sku: '',
      category: 'electronics',
      status: 'active',
      createdAt: new Date()
    };
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
  }

  // Tìm kiếm với debounce để tối ưu performance
  onSearchInput() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.searchTimeout = setTimeout(() => {
      this.filterProducts();
    }, 300); // Delay 300ms
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

  // Track function cho ngFor để tối ưu performance
  trackByProductId(index: number, product: ProductWithExtras): number {
    return product.id;
  }

  // Chuyển đổi mã danh mục thành tên hiển thị tiếng Việt
  getCategoryName(category: string | undefined): string {
    if (!category) return 'Chưa phân loại';
    const categories: { [key: string]: string } = {
      'electronics': 'Điện tử',
      'clothing': 'Thời trang',
      'books': 'Sách',
      'home': 'Gia dụng'
    };
    return categories[category] || category;
  }

  // Chuyển đổi mã trạng thái thành tên hiển thị tiếng Việt
  getStatusText(status: string | undefined): string {
    if (!status) return 'Chưa xác định';
    const statuses: { [key: string]: string } = {
      'active': 'Hoạt động',
      'inactive': 'Không hoạt động',
      'draft': 'Bản nháp'
    };
    return statuses[status] || status;
  }

  // Mở modal thêm sản phẩm mới
  openAddProductModal() {
    this.isEditing = false;
    this.selectedProduct = this.getEmptyProduct();
    this.showModal = true;
  }

  // Mở modal chỉnh sửa sản phẩm
  editProduct(product: ProductWithExtras) {
    this.isEditing = true;
    this.selectedProduct = { ...product };  // Copy sản phẩm để tránh thay đổi dữ liệu gốc
    this.showModal = true;
  }

  // Xem chi tiết sản phẩm (chức năng tạm thời)
  viewProduct(product: ProductWithExtras) {
    // TODO: Implement view product functionality
    console.log('View product:', product);
    alert(`Xem chi tiết sản phẩm: ${product.name}`);
  }

  // Xóa sản phẩm với xác nhận
  deleteProduct(product: ProductWithExtras) {
    if (confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${product.name}"?`)) {
      this.productService.deleteProduct(product.id).subscribe({
        next: () => {
          // Xóa khỏi cache và danh sách hiện tại
          this.products = this.products.filter(p => p.id !== product.id);
          this.productsCache = this.productsCache?.filter(p => p.id !== product.id) || null;
          this.filterProducts(); // Cập nhật danh sách đã lọc
        },
        error: (error) => {
          console.error('Error deleting product:', error);
          alert('Không thể xóa sản phẩm. Vui lòng thử lại sau.');
        }
      });
    }
  }

  // Lưu sản phẩm (thêm mới hoặc cập nhật)
  saveProduct() {
    // Chuẩn bị dữ liệu sản phẩm để gửi lên server
    const productData = {
      name: this.selectedProduct.name,
      description: this.selectedProduct.description,
      price: this.selectedProduct.price,
      imageUrl: this.selectedProduct.imageUrl,
      stock: this.selectedProduct.stock
    };

    if (this.isEditing) {
      // Cập nhật sản phẩm hiện có
      this.productService.updateProduct(this.selectedProduct.id, productData).subscribe({
        next: (updatedProduct) => {
          // Cập nhật trong danh sách hiện tại
          const index = this.products.findIndex(p => p.id === this.selectedProduct.id);
          if (index !== -1) {
            this.products[index] = { ...this.products[index], ...productData };
            this.productsCache = [...this.products];
          }
          this.filterProducts(); // Cập nhật danh sách đã lọc
          this.closeModal();
        },
        error: (error) => {
          console.error('Error updating product:', error);
          alert('Không thể cập nhật sản phẩm. Vui lòng thử lại sau.');
        }
      });
    } else {
      // Thêm sản phẩm mới
      this.productService.createProduct(productData).subscribe({
        next: (newProduct) => {
          // Thêm vào danh sách hiện tại
          const productWithExtras: ProductWithExtras = {
            ...newProduct,
            sku: `SKU-${newProduct.id.toString().padStart(3, '0')}`,
            category: this.getCategoryFromName(newProduct.name),
            status: newProduct.stock > 0 ? 'active' : 'inactive',
            createdAt: new Date()
          };
          this.products.push(productWithExtras);
          this.productsCache = [...this.products];
          this.filterProducts(); // Cập nhật danh sách đã lọc
          this.closeModal();
        },
        error: (error) => {
          console.error('Error creating product:', error);
          alert('Không thể tạo sản phẩm mới. Vui lòng thử lại sau.');
        }
      });
    }
  }

  // Đóng modal và reset dữ liệu
  closeModal() {
    this.showModal = false;
    this.selectedProduct = this.getEmptyProduct();
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