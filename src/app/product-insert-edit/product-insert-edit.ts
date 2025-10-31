import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, Product, ProductDetail, ProductVariant } from '../services/product';
import { UploadService } from '../services/upload.service';

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
  @Input() selectedProduct: any = null;
  @Output() modalClosed = new EventEmitter<void>();
  @Output() productSaved = new EventEmitter<any>();

  // Form data
  product: any = {};
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

  constructor(
    private productService: ProductService,
    private uploadService: UploadService,
    private cdr: ChangeDetectorRef
  ) {}

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
    };
    
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
    
    this.product = { ...this.selectedProduct };
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
    
    const form = (event.target as any).closest('form');
    if (form && !form.checkValidity()) {
      console.log('Form validation failed');
      form.reportValidity();
      return;
    }
    
    console.log('Form validation passed, calling saveProduct()');
    this.saveProduct();
  }

  saveProduct() {
    console.log('=== SAVE PRODUCT CALLED IN CHILD ===');
    console.log('Is editing:', this.isEditing);
    console.log('Product:', this.product);
    
    this.clearMessages();
    
    const validationResult = this.validateProductData();
    console.log('Validation result:', validationResult);
    
    if (!validationResult.isValid) {
      console.log('Validation failed:', validationResult.message);
      this.saveError = validationResult.message;
      this.cdr.markForCheck();
      return;
    }
    
    try {
      const productData = this.prepareProductData();
      console.log('Prepared product data:', productData);
      
      this.isSaving = true;
      this.cdr.markForCheck();
      
      if (this.isEditing) {
        console.log('Calling updateProduct...');
        this.updateProduct(productData);
      } else {
        console.log('Calling createProduct...');
        this.createProduct(productData);
      }
    } catch (error) {
      console.error('Error in saveProduct:', error);
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
  prepareProductData() {
    const productData = {
      name: this.product.name?.trim() || '',
      description: this.product.description?.trim() || '',
      originalPrice: Number(this.product.originalPrice) || 0,
      salePrice: Number(this.product.salePrice) || 0,
      price: Number(this.product.price) || 0,
      imageUrl: this.product.imageUrl?.trim() || '',
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
  createProduct(productData: any) {
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
        
        setTimeout(() => {
          this.productSaved.emit(newProduct);
          this.closeModal();
        }, 1500);
      },
      error: (error) => {
        console.error('=== ERROR CREATING PRODUCT ===');
        console.error('Error:', error);
        this.handleCreateError(error);
      }
    });
  }

  // Update product
  updateProduct(productData: any) {
    console.log('=== UPDATE PRODUCT CALLED ===');
    console.log('Product ID:', this.product.id);
    console.log('Product data:', productData);
    
    this.productService.updateProduct(this.product.id, productData).subscribe({
      next: (updatedProduct) => {
        console.log('=== PRODUCT UPDATED SUCCESSFULLY ===');
        console.log('Updated product:', updatedProduct);
        this.saveSuccess = 'Cập nhật sản phẩm thành công!';
        this.isSaving = false;
        this.cdr.markForCheck();
        
        setTimeout(() => {
          this.productSaved.emit(updatedProduct);
          this.closeModal();
        }, 1000);
      },
      error: (error) => {
        console.error('=== ERROR UPDATING PRODUCT ===');
        console.error('Error:', error);
        this.handleUpdateError(error);
      }
    });
  }

  // Error handling
  handleCreateError(error: any) {
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

  handleUpdateError(error: any) {
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
        this.product.imageUrl = response.imageUrl;
        this.saveSuccess = 'Upload ảnh thành công!';
        this.cdr.markForCheck();
        
        // Auto clear success message after 3 seconds
        setTimeout(() => {
          this.saveSuccess = '';
          this.cdr.markForCheck();
        }, 3000);
      },
      error: (error) => {
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
  trackByIndex(index: number, item: any): number {
    return index;
  }
}
