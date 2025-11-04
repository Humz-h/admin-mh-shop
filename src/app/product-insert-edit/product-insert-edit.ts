import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, ProductDetail, ProductVariant } from '../services/product';
import { UploadService } from '../services/upload.service';

interface ProductFormData {
  id: number;
  name: string;
  description: string;
  originalPrice?: number;
  salePrice?: number;
  price: number;
  imageUrl: string;
  status: boolean;
  category: string;
  productGroup?: string;
  productCode: string;
  stock: number;
  createdAt?: Date;
  productDetails?: ProductDetail[];
  productVariants?: ProductVariant[];
}

interface ProductCreateUpdateData {
  name: string;
  description: string;
  originalPrice: number;
  salePrice: number;
  price: number;
  imageUrl: string;
  status: boolean;
  category: string;
  productGroup: string;
  productCode: string;
  stock: number;
  productDetails: ProductDetail[];
  productVariants: ProductVariant[];
}

@Component({
  selector: 'app-product-insert-edit',
  imports: [CommonModule, FormsModule],
  templateUrl: './product-insert-edit.html',
  styleUrl: './product-insert-edit.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductInsertEdit implements OnInit, OnChanges {
  @Input() showModal: boolean = false;
  @Input() isEditing: boolean = false;
  @Input() selectedProduct: ProductFormData | null = null;
  @Output() modalClosed = new EventEmitter<void>();
  @Output() productSaved = new EventEmitter<ProductFormData>();

  // Form data
  product: ProductFormData = {
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
    createdAt: new Date()
  };
  productDetails: ProductDetail[] = [];
  productVariants: ProductVariant[] = [];
  discountPercentage: number = 0;
  
  // UI state
  isSaving: boolean = false;
  saveError: string = '';
  saveSuccess: string = '';
  selectedFile: File | null = null;
  previewImageUrl: string = '';
  isUploading: boolean = false;
  uploadError: string = '';

  private readonly productService = inject(ProductService);
  private readonly uploadService = inject(UploadService);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    this.initializeProduct();
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log('ProductInsertEdit ngOnChanges:', changes);
    console.log('Current isEditing:', this.isEditing);
    console.log('Current showModal:', this.showModal);
    console.log('Current selectedProduct:', this.selectedProduct);
    
    if (changes['isEditing']) {
      console.log('isEditing changed from', changes['isEditing'].previousValue, 'to', changes['isEditing'].currentValue);
    }
    
    if (changes['showModal']) {
      console.log('showModal changed from', changes['showModal'].previousValue, 'to', changes['showModal'].currentValue);
    }
    
    if (changes['selectedProduct']) {
      console.log('selectedProduct changed from', changes['selectedProduct'].previousValue, 'to', changes['selectedProduct'].currentValue);
    }
    
    // Load product data when editing
    if (this.isEditing && this.selectedProduct && this.showModal) {
      console.log('Loading product data for editing...');
      this.loadProductData();
    } 
    // Initialize new product when adding
    else if (!this.isEditing && this.showModal) {
      console.log('Initializing new product...');
      this.initializeProduct();
    }
    
    this.cdr.markForCheck();
  }

  // Initialize empty product
  initializeProduct() {
    this.product = {
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
      createdAt: new Date()
    } as ProductFormData;
    
    this.productDetails = [];
    this.productVariants = [];
    this.addProductDetail();
    this.addProductVariant();
    
    this.clearMessages();
  }

  // Load product data for editing
  loadProductData() {
    console.log('=== LOADING PRODUCT DATA FOR EDIT ===');
    console.log('Selected product:', this.selectedProduct);
    
    if (!this.selectedProduct) {
      return;
    }
    
    this.product = {
      id: this.selectedProduct.id || 0,
      name: this.selectedProduct.name || '',
      description: this.selectedProduct.description || '',
      originalPrice: this.selectedProduct.originalPrice || 0,
      salePrice: this.selectedProduct.salePrice || 0,
      price: this.selectedProduct.price || 0,
      imageUrl: this.selectedProduct.imageUrl || '',
      status: this.selectedProduct.status !== undefined ? this.selectedProduct.status : true,
      category: this.selectedProduct.category || 'Điện tử',
      productGroup: this.selectedProduct.productGroup || 'Sản phẩm',
      productCode: this.selectedProduct.productCode || '',
      stock: this.selectedProduct.stock || 0,
      createdAt: this.selectedProduct.createdAt ? (this.selectedProduct.createdAt instanceof Date ? this.selectedProduct.createdAt : new Date(this.selectedProduct.createdAt)) : new Date(),
      productDetails: this.selectedProduct.productDetails,
      productVariants: this.selectedProduct.productVariants
    } as ProductFormData;
    this.productDetails = [...(this.selectedProduct.productDetails || [])];
    this.productVariants = [...(this.selectedProduct.productVariants || [])];
    
    // Set preview image if product has imageUrl
    if (this.product.imageUrl && this.product.imageUrl.trim() !== '') {
      console.log('Product has imageUrl:', this.product.imageUrl);
      
      // Nếu là relative path, tạo full URL
      if (this.product.imageUrl.startsWith('/')) {
        this.previewImageUrl = `http://localhost:5000${this.product.imageUrl}`;
      } else if (this.product.imageUrl.startsWith('http')) {
        this.previewImageUrl = this.product.imageUrl;
      } else {
        this.previewImageUrl = `http://localhost:5000/${this.product.imageUrl}`;
      }
      
      console.log('Set previewImageUrl to:', this.previewImageUrl);
    } else {
      console.log('No imageUrl found, clearing preview');
      this.previewImageUrl = '';
    }
    
    // Calculate discount percentage and sale price from original price and current price
    console.log('=== CALCULATING DISCOUNT PERCENTAGE ===');
    console.log('Raw data - originalPrice:', this.product.originalPrice, 'price:', this.product.price, 'salePrice:', this.product.salePrice);
    
    // Parse values to ensure they are numbers
    const originalPrice = Number(this.product.originalPrice) || 0;
    const currentPrice = Number(this.product.price) || 0;
    const salePrice = Number(this.product.salePrice) || 0;
    
    console.log('Parsed values - originalPrice:', originalPrice, 'currentPrice:', currentPrice, 'salePrice:', salePrice);
    
    // Determine the final selling price
    let finalPrice = 0;
    if (salePrice > 0) {
      finalPrice = salePrice;
      console.log('Using salePrice as final price:', finalPrice);
    } else if (currentPrice > 0) {
      finalPrice = currentPrice;
      console.log('Using current price as final price:', finalPrice);
    } else {
      finalPrice = originalPrice;
      console.log('Using original price as final price:', finalPrice);
    }
    
    console.log('Final price determined:', finalPrice);
    
    // Calculate discount percentage
    if (originalPrice > 0 && finalPrice > 0) {
      if (finalPrice < originalPrice) {
        // There is a discount
        const discountAmount = originalPrice - finalPrice;
        this.discountPercentage = Math.round((discountAmount / originalPrice) * 100 * 100) / 100;
        console.log('Discount found - amount:', discountAmount, 'percentage:', this.discountPercentage);
      } else if (finalPrice === originalPrice) {
        // No discount
        this.discountPercentage = 0;
        console.log('No discount - final price equals original price');
      } else {
        // Final price is higher than original (shouldn't happen but handle it)
        this.discountPercentage = 0;
        console.log('No discount - final price > original price (unusual case)');
      }
      
      // Set the prices
      this.product.salePrice = finalPrice;
      this.product.price = finalPrice;
    } else if (originalPrice > 0) {
      // Only original price available
      this.discountPercentage = 0;
      this.product.salePrice = originalPrice;
      this.product.price = originalPrice;
      console.log('Only original price available - no discount');
    } else {
      // No price data
      this.discountPercentage = 0;
      this.product.salePrice = 0;
      this.product.price = 0;
      console.log('No price data available');
    }
    
    console.log('Final calculated values:');
    console.log('- discountPercentage:', this.discountPercentage);
    console.log('- product.salePrice:', this.product.salePrice);
    console.log('- product.price:', this.product.price);
    
    if (this.productDetails.length === 0) {
      this.addProductDetail();
    }
    if (this.productVariants.length === 0) {
      this.addProductVariant();
    }
    
    this.clearMessages();
    this.cdr.markForCheck();
  }

  // Add ProductDetail
  addProductDetail() {
    const newDetail: ProductDetail = {
      id: 0,
      productId: this.product.id,
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
  }

  // Remove ProductDetail
  removeProductDetail(index: number) {
    if (this.productDetails.length > 1) {
      this.productDetails.splice(index, 1);
    }
  }

  // Add ProductVariant
  addProductVariant() {
    const newVariant: ProductVariant = {
      id: 0,
      productId: this.product.id,
      variantName: '',
      attributes: '',
      price: 0,
      sku: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.productVariants.push(newVariant);
  }

  // Remove ProductVariant
  removeProductVariant(index: number) {
    if (this.productVariants.length > 1) {
      this.productVariants.splice(index, 1);
    }
  }

  // File handling
  triggerFileInput(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const fileInput = document.getElementById('productImage') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      if (!file.type.startsWith('image/')) {
        alert('Vui lòng chọn file ảnh hợp lệ!');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        alert('Kích thước file không được vượt quá 5MB!');
        return;
      }
      
      this.selectedFile = file;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewImageUrl = e.target?.result as string;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(event: Event): void {
    event.stopPropagation();
    this.product.imageUrl = '';
    this.selectedFile = null;
    this.previewImageUrl = '';
    this.cdr.markForCheck();
  }

  // Lấy URL ảnh để hiển thị (ưu tiên preview, sau đó là imageUrl của product)
  getDisplayImageUrl(): string {
    if (this.previewImageUrl) {
      return this.previewImageUrl;
    }
    
    if (this.product.imageUrl && this.product.imageUrl.trim() !== '') {
      // Nếu là relative path, tạo full URL
      if (this.product.imageUrl.startsWith('/')) {
        return `http://localhost:5000${this.product.imageUrl}`;
      } else if (this.product.imageUrl.startsWith('http')) {
        return this.product.imageUrl;
      } else {
        return `http://localhost:5000/${this.product.imageUrl}`;
      }
    }
    
    return '';
  }

  // Xử lý lỗi khi load ảnh
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Form submission
  onSaveProductClick(event: Event) {
    console.log('=== SAVE BUTTON CLICKED IN CHILD ===');
    console.log('Event:', event);
    console.log('Is editing:', this.isEditing);
    console.log('Product data:', this.product);
    
    event.preventDefault();
    event.stopPropagation();
    
    const form = (event.target as HTMLElement).closest('form');
    if (form && !form.checkValidity()) {
      console.log('Form validation failed');
      form.reportValidity();
      return;
    }
    
    console.log('Form validation passed, calling saveProduct()');
    this.saveProduct();
  }

  saveProduct() {
    this.clearMessages();
    
    const validationResult = this.validateProductData();
    
    if (!validationResult.isValid) {
      this.saveError = validationResult.message;
      this.cdr.markForCheck();
      return;
    }
    
    // Nếu có file mới được chọn, upload trước khi save
    if (this.selectedFile) {
      this.uploadAndSave();
      return;
    }
    
    // Nếu không có file mới, save ngay với imageUrl hiện tại
    this.performSave();
  }

  // Upload ảnh và sau đó save sản phẩm
  uploadAndSave() {
    if (!this.selectedFile) {
      this.performSave();
      return;
    }

    this.isSaving = true;
    this.isUploading = true;
    this.uploadError = '';
    this.cdr.markForCheck();

    this.uploadService.uploadProductImage(this.selectedFile).subscribe({
      next: (response) => {
        this.isUploading = false;
        
        // Cập nhật imageUrl từ URL đã upload (API trả về imageUrl)
        const uploadedUrl = response.imageUrl || '';
        
        if (uploadedUrl) {
          // Lưu URL vào product.imageUrl (đảm bảo format đúng)
          let savedUrl = uploadedUrl;
          
          // Nếu là full URL từ localhost, extract relative path
          if (uploadedUrl.startsWith('http://localhost:5000')) {
            savedUrl = uploadedUrl.replace('http://localhost:5000', '');
          }
          
          // Đảm bảo relative path bắt đầu bằng /
          if (savedUrl && !savedUrl.startsWith('http') && !savedUrl.startsWith('/')) {
            savedUrl = '/' + savedUrl;
          }
          
          this.product.imageUrl = savedUrl;
          
          // Cập nhật previewImageUrl để hiển thị (luôn dùng full URL)
          if (uploadedUrl.startsWith('/')) {
            this.previewImageUrl = `http://localhost:5000${uploadedUrl}`;
          } else if (uploadedUrl.startsWith('http')) {
            this.previewImageUrl = uploadedUrl;
          } else {
            this.previewImageUrl = `http://localhost:5000/${uploadedUrl}`;
          }
          
          // Nếu product đã có id (đang edit), tự động lưu imageUrl vào DB trước
          if (this.product.id && this.product.id > 0) {
            this.updateImageUrlInDatabase(savedUrl);
          }
        }
        
        this.selectedFile = null;
        this.cdr.markForCheck();
        
        // Sau khi upload xong, thực hiện save
        this.performSave();
      },
      error: () => {
        this.isUploading = false;
        this.isSaving = false;
        this.uploadError = 'Có lỗi xảy ra khi upload ảnh. Vui lòng thử lại!';
        this.cdr.markForCheck();
      }
    });
  }

  // Thực hiện save sản phẩm
  performSave() {
    try {
      const productData = this.prepareProductData();
      
      // Debug: Kiểm tra imageUrl trước khi save
      if (!productData.imageUrl || productData.imageUrl.trim() === '') {
        // Nếu không có imageUrl nhưng có previewImageUrl, cảnh báo
        if (this.previewImageUrl && !this.previewImageUrl.startsWith('data:')) {
          this.saveError = 'Vui lòng upload ảnh trước khi lưu sản phẩm!';
          this.isSaving = false;
          this.cdr.markForCheck();
          return;
        }
      }
      
      this.isSaving = true;
      this.cdr.markForCheck();
      
      if (this.isEditing) {
        this.updateProduct(productData);
      } else {
        this.createProduct(productData);
      }
    } catch (error) {
      this.saveError = (error as Error).message || 'Có lỗi xảy ra khi chuẩn bị dữ liệu.';
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  // Validation
  validateProductData(): { isValid: boolean; message: string } {
    if (!this.product.name || !this.product.name.trim()) {
      return { isValid: false, message: 'Vui lòng nhập tên sản phẩm!' };
    }

    const name = this.product.name.trim();
    if (name.length < 2) {
      return { isValid: false, message: 'Tên sản phẩm phải có ít nhất 2 ký tự!' };
    }

    if (name.length > 200) {
      return { isValid: false, message: 'Tên sản phẩm không được vượt quá 200 ký tự!' };
    }

    if (this.product.price === null || this.product.price === undefined) {
      return { isValid: false, message: 'Vui lòng nhập giá sản phẩm!' };
    }

    const price = Number(this.product.price);
    if (isNaN(price) || price < 0) {
      return { isValid: false, message: 'Giá sản phẩm phải là số hợp lệ và không được âm!' };
    }

    if (this.product.stock === null || this.product.stock === undefined) {
      return { isValid: false, message: 'Vui lòng nhập số lượng tồn kho!' };
    }

    const stock = Number(this.product.stock);
    if (isNaN(stock) || stock < 0) {
      return { isValid: false, message: 'Số lượng tồn kho phải là số hợp lệ và không được âm!' };
    }

    return { isValid: true, message: '' };
  }

  // Prepare data for API
  prepareProductData(): ProductCreateUpdateData {
    // Đảm bảo imageUrl luôn có giá trị (ưu tiên product.imageUrl)
    let imageUrl = this.product.imageUrl?.trim() || '';
    
    // Nếu imageUrl rỗng và có previewImageUrl từ URL (không phải base64), sử dụng nó
    if (!imageUrl && this.previewImageUrl && !this.previewImageUrl.startsWith('data:')) {
      // Loại bỏ base URL nếu có để lưu relative path
      imageUrl = this.previewImageUrl.replace('http://localhost:5000', '');
    }
    
    // Đảm bảo imageUrl không rỗng khi có ảnh đã upload
    // Nếu imageUrl là full URL, giữ nguyên (API có thể xử lý được)
    // Nếu là relative path, đảm bảo bắt đầu bằng /
    if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
      imageUrl = '/' + imageUrl;
    }
    
    const productData = {
      name: this.product.name?.trim() || '',
      description: this.product.description?.trim() || '',
      originalPrice: Number(this.product.originalPrice) || 0,
      salePrice: Number(this.product.salePrice) || 0,
      price: Number(this.product.price) || 0,
      imageUrl: imageUrl || '',
      status: this.product.status !== undefined ? this.product.status : true,
      category: this.product.category?.trim() || 'Điện tử',
      productGroup: this.product.productGroup?.trim() || 'Sản phẩm',
      productCode: this.product.productCode?.trim() || `PRD-${Date.now()}`,
      stock: Number(this.product.stock) || 0,
      productDetails: this.productDetails,
      productVariants: this.productVariants
    };
    
    return productData;
  }

  // Create product
  createProduct(productData: ProductCreateUpdateData) {
    console.log('=== CREATE PRODUCT CALLED ===');
    console.log('Product data:', productData);
    console.log('Product ID:', this.product.id);
    
    this.productService.createProduct(productData).subscribe({
      next: (newProduct) => {
        console.log('=== PRODUCT CREATED SUCCESSFULLY ===');
        console.log('New product:', newProduct);
        this.saveSuccess = 'Tạo sản phẩm thành công!';
        this.isSaving = false;
        this.cdr.markForCheck();
        
        // Emit event ngay lập tức để component cha xử lý đóng modal và reload
        const productFormData: ProductFormData = {
          id: newProduct.id,
          name: newProduct.name,
          description: newProduct.description,
          originalPrice: newProduct.originalPrice || 0,
          salePrice: newProduct.salePrice || 0,
          price: newProduct.price,
          imageUrl: newProduct.imageUrl,
          status: newProduct.status,
          category: newProduct.category,
          productGroup: newProduct.productGroup || 'Sản phẩm',
          productCode: newProduct.productCode,
          stock: newProduct.stock,
          createdAt: newProduct.createdAt ? (newProduct.createdAt instanceof Date ? newProduct.createdAt : new Date(newProduct.createdAt)) : new Date(),
          productDetails: newProduct.productDetails,
          productVariants: newProduct.productVariants
        };
        this.productSaved.emit(productFormData);
      },
      error: (error) => {
        console.error('=== ERROR CREATING PRODUCT ===');
        console.error('Error:', error);
        this.handleCreateError(error);
      }
    });
  }

  // Update product
  updateProduct(productData: ProductCreateUpdateData) {
    this.productService.updateProduct(this.product.id, productData).subscribe({
      next: (updatedProduct) => {
        this.saveSuccess = 'Cập nhật sản phẩm thành công!';
        this.isSaving = false;
        this.cdr.markForCheck();
        
        // Chuẩn bị dữ liệu để emit event
        const productFormData: ProductFormData = {
          id: updatedProduct.id,
          name: updatedProduct.name,
          description: updatedProduct.description,
          originalPrice: updatedProduct.originalPrice || 0,
          salePrice: updatedProduct.salePrice || 0,
          price: updatedProduct.price,
          imageUrl: updatedProduct.imageUrl,
          status: updatedProduct.status,
          category: updatedProduct.category,
          productGroup: updatedProduct.productGroup || 'Sản phẩm',
          productCode: updatedProduct.productCode,
          stock: updatedProduct.stock,
          createdAt: updatedProduct.createdAt ? (updatedProduct.createdAt instanceof Date ? updatedProduct.createdAt : new Date(updatedProduct.createdAt)) : new Date(),
          productDetails: updatedProduct.productDetails,
          productVariants: updatedProduct.productVariants
        };
        
        // Emit event ngay để component cha xử lý đóng modal và reload
        this.productSaved.emit(productFormData);
      },
      error: (error) => {
        this.handleUpdateError(error);
      }
    });
  }

  // Error handling
  handleCreateError(error: { status?: number; message?: string }) {
    this.isSaving = false;
    let errorMessage = 'Có lỗi xảy ra khi tạo sản phẩm mới.';
    
    if (error.status === 400) {
      errorMessage = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin sản phẩm.';
    } else if (error.status === 401) {
      errorMessage = 'Không có quyền truy cập. Vui lòng đăng nhập lại.';
    } else if (error.status === 500) {
      errorMessage = 'Lỗi server. Vui lòng thử lại sau.';
    }
    
    this.saveError = errorMessage;
    this.cdr.markForCheck();
  }

  handleUpdateError(error: { status?: number; message?: string }) {
    this.isSaving = false;
    let errorMessage = 'Có lỗi xảy ra khi cập nhật sản phẩm.';
    
    if (error.status === 400) {
      errorMessage = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin sản phẩm.';
    } else if (error.status === 404) {
      errorMessage = 'Không tìm thấy sản phẩm cần cập nhật.';
    } else if (error.status === 500) {
      errorMessage = 'Lỗi server. Vui lòng thử lại sau.';
    }
    
    this.saveError = errorMessage;
    this.cdr.markForCheck();
  }

  // Close modal
  closeModal() {
    this.showModal = false;
    this.clearMessages();
    this.modalClosed.emit();
  }

  // Clear messages
  clearMessages() {
    this.saveError = '';
    this.saveSuccess = '';
    this.isSaving = false;
  }

  // Generate product code from product name
  generateProductCode(name: string): string {
    if (!name || name.trim() === '') {
      return '';
    }
    
    // Convert Vietnamese to English-like characters
    const vietnameseMap: { [key: string]: string } = {
      'à': 'a', 'á': 'a', 'ạ': 'a', 'ả': 'a', 'ã': 'a', 'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ậ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ặ': 'a', 'ẳ': 'a', 'ẵ': 'a',
      'è': 'e', 'é': 'e', 'ẹ': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ê': 'e', 'ề': 'e', 'ế': 'e', 'ệ': 'e', 'ể': 'e', 'ễ': 'e',
      'ì': 'i', 'í': 'i', 'ị': 'i', 'ỉ': 'i', 'ĩ': 'i',
      'ò': 'o', 'ó': 'o', 'ọ': 'o', 'ỏ': 'o', 'õ': 'o', 'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ộ': 'o', 'ổ': 'o', 'ỗ': 'o', 'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ợ': 'o', 'ở': 'o', 'ỡ': 'o',
      'ù': 'u', 'ú': 'u', 'ụ': 'u', 'ủ': 'u', 'ũ': 'u', 'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ự': 'u', 'ử': 'u', 'ữ': 'u',
      'ỳ': 'y', 'ý': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y',
      'đ': 'd',
      'À': 'A', 'Á': 'A', 'Ạ': 'A', 'Ả': 'A', 'Ã': 'A', 'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ậ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ặ': 'A', 'Ẳ': 'A', 'Ẵ': 'A',
      'È': 'E', 'É': 'E', 'Ẹ': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ệ': 'E', 'Ể': 'E', 'Ễ': 'E',
      'Ì': 'I', 'Í': 'I', 'Ị': 'I', 'Ỉ': 'I', 'Ĩ': 'I',
      'Ò': 'O', 'Ó': 'O', 'Ọ': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ộ': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ợ': 'O', 'Ở': 'O', 'Ỡ': 'O',
      'Ù': 'U', 'Ú': 'U', 'Ụ': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ự': 'U', 'Ử': 'U', 'Ữ': 'U',
      'Ỳ': 'Y', 'Ý': 'Y', 'Ỵ': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y',
      'Đ': 'D'
    };
    
    // Convert Vietnamese characters to English-like
    let convertedName = name.toLowerCase();
    for (const [vietnamese, english] of Object.entries(vietnameseMap)) {
      convertedName = convertedName.replace(new RegExp(vietnamese, 'g'), english);
    }
    
    // Remove special characters and replace spaces with hyphens
    const cleanName = convertedName
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters except spaces
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    return cleanName;
  }

  // Generate product code when name changes
  generateProductCodeFromName() {
    if (this.product.name && this.product.name.trim() !== '') {
      this.product.productCode = this.generateProductCode(this.product.name);
    } else {
      this.product.productCode = '';
    }
    this.cdr.markForCheck();
  }

  // Upload image to server
  uploadImage() {
    if (!this.selectedFile) {
      this.uploadError = 'Vui lòng chọn ảnh trước khi upload!';
      this.cdr.markForCheck();
      return;
    }

    this.isUploading = true;
    this.uploadError = '';
    this.cdr.markForCheck();

    this.uploadService.uploadProductImage(this.selectedFile).subscribe({
      next: (response) => {
        this.isUploading = false;
        
        // Cập nhật imageUrl từ URL đã upload (API trả về imageUrl)
        const uploadedUrl = response.imageUrl || '';
        
        if (uploadedUrl) {
          // Lưu URL vào product.imageUrl (đảm bảo format đúng)
          let savedUrl = uploadedUrl;
          
          // Nếu là full URL từ localhost, extract relative path
          if (uploadedUrl.startsWith('http://localhost:5000')) {
            savedUrl = uploadedUrl.replace('http://localhost:5000', '');
          }
          
          // Đảm bảo relative path bắt đầu bằng /
          if (savedUrl && !savedUrl.startsWith('http') && !savedUrl.startsWith('/')) {
            savedUrl = '/' + savedUrl;
          }
          
          this.product.imageUrl = savedUrl;
          
          // Cập nhật previewImageUrl để hiển thị (luôn dùng full URL)
          if (uploadedUrl.startsWith('/')) {
            this.previewImageUrl = `http://localhost:5000${uploadedUrl}`;
          } else if (uploadedUrl.startsWith('http')) {
            this.previewImageUrl = uploadedUrl;
          } else {
            this.previewImageUrl = `http://localhost:5000/${uploadedUrl}`;
          }
          
          // Nếu product đã có id (đang edit), tự động lưu imageUrl vào DB
          if (this.product.id && this.product.id > 0) {
            this.updateImageUrlInDatabase(savedUrl);
          }
        }
        
        this.saveSuccess = 'Upload ảnh thành công!';
        this.selectedFile = null;
        this.uploadError = '';
        this.cdr.markForCheck();
        
        // Auto clear success message after 3 seconds
        setTimeout(() => {
          this.saveSuccess = '';
          this.cdr.markForCheck();
        }, 3000);
      },
      error: () => {
        this.isUploading = false;
        this.uploadError = 'Có lỗi xảy ra khi upload ảnh. Vui lòng thử lại!';
        this.cdr.markForCheck();
        
        // Auto clear error message after 5 seconds
        setTimeout(() => {
          this.uploadError = '';
          this.cdr.markForCheck();
        }, 5000);
      }
    });
  }

  // Cập nhật chỉ imageUrl vào DB
  updateImageUrlInDatabase(imageUrl: string) {
    if (!this.product.id || this.product.id <= 0) {
      return;
    }

    // Lấy thông tin product hiện tại và cập nhật chỉ imageUrl
    const updateData = {
      name: this.product.name || '',
      description: this.product.description || '',
      originalPrice: Number(this.product.originalPrice) || 0,
      salePrice: Number(this.product.salePrice) || 0,
      price: Number(this.product.price) || 0,
      imageUrl: imageUrl,
      status: this.product.status !== undefined ? this.product.status : true,
      category: this.product.category || 'Điện tử',
      productGroup: this.product.productGroup || 'Sản phẩm',
      productCode: this.product.productCode || `PRD-${Date.now()}`,
      stock: Number(this.product.stock) || 0,
      productDetails: this.productDetails || [],
      productVariants: this.productVariants || []
    };

    this.productService.updateProduct(this.product.id, updateData).subscribe({
      next: () => {
        // ImageUrl đã được lưu vào DB thành công
        this.cdr.markForCheck();
      },
      error: () => {
        // Không hiển thị lỗi cho user vì upload ảnh đã thành công
        // Chỉ log để debug
        this.cdr.markForCheck();
      }
    });
  }

  // Calculate sale price based on original price and discount percentage
  calculateSalePrice() {
    console.log('=== CALCULATING SALE PRICE ===');
    console.log('originalPrice:', this.product.originalPrice);
    console.log('discountPercentage:', this.discountPercentage);
    
    const originalPrice = Number(this.product.originalPrice) || 0;
    const discount = Number(this.discountPercentage) || 0;
    
    console.log('Parsed originalPrice:', originalPrice);
    console.log('Parsed discount:', discount);
    
    if (originalPrice > 0 && discount >= 0 && discount <= 100) {
      const discountAmount = (originalPrice * discount) / 100;
      this.product.price = Math.round(originalPrice - discountAmount);  // Giá bán cuối cùng
      this.product.salePrice = Math.round(originalPrice - discountAmount);  // SalePrice = giá bán cuối cùng
      console.log('Calculated price:', this.product.price, 'salePrice:', this.product.salePrice);
    } else if (originalPrice > 0 && discount === 0) {
      this.product.price = originalPrice;
      this.product.salePrice = originalPrice;  // SalePrice = originalPrice khi không có discount
      console.log('No discount - price:', this.product.price, 'salePrice:', this.product.salePrice);
    } else {
      this.product.price = 0;
      this.product.salePrice = 0;
      console.log('Zero values - price:', this.product.price, 'salePrice:', this.product.salePrice);
    }
    
    console.log('Final values - price:', this.product.price, 'salePrice:', this.product.salePrice, 'discountPercentage:', this.discountPercentage);
    this.cdr.markForCheck();
  }

  // Track functions
  trackByIndex(index: number): number {
    return index;
  }
}
