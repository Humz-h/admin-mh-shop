import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Customer, CustomerService } from '../../../../services/customer.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-user-insert-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-insert-edit.component.html',
  styleUrls: ['./user-insert-edit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserInsertEditComponent implements OnInit, OnChanges, AfterViewChecked {
  @Input() showModal: boolean = false;
  @Input() isEditing: boolean = false;
  @Input() selectedCustomer: Customer | null = null;
  @Output() modalClosed = new EventEmitter<void>();
  @Output() customerSaved = new EventEmitter<Customer>();

  customer: any = {
    id: 0,
    username: '',
    email: '',
    fullName: '',
    phone: '',
    role: 'customer',
    password: '',
    confirmPassword: ''
  };
  isSaving: boolean = false;
  saveError: string = '';
  saveSuccess: string = '';
  private dataLoaded: boolean = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private customerService: CustomerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Always start with empty form
    this.initializeCustomer();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Handle when modal opens or closes
    if (changes['showModal']) {
      if (this.showModal) {
        // Modal is opening
        this.dataLoaded = false;
        
        // CRITICAL: If NOT editing, reset form ONCE when modal opens
        // But ONLY when modal first opens, not during user typing
        if (!this.isEditing || !this.selectedCustomer) {
          // Adding mode: Reset form ONCE when opening modal
          this.forceResetForm();
          this.cdr.markForCheck();
        } else if (this.isEditing && this.selectedCustomer) {
          // Editing mode: load customer data after a brief delay
          setTimeout(() => {
            this.loadCustomerData();
            this.cdr.markForCheck();
          }, 0);
        }
      } else {
        // Modal is closing - ALWAYS reset form completely
        this.resetForm();
        this.dataLoaded = false;
        this.cdr.markForCheck();
      }
    }
    
    // Handle when editing state changes
    if (changes['isEditing']) {
      this.dataLoaded = false;
      
      if (this.showModal) {
        setTimeout(() => {
          if (this.isEditing && this.selectedCustomer) {
            this.loadCustomerData();
        } else {
          // Switching to add mode - FORCE reset form
          this.forceResetForm();
        }
          this.cdr.markForCheck();
        }, 0);
      }
    }
    
    // Handle when selected customer changes
    if (changes['selectedCustomer']) {
      if (this.showModal && this.isEditing && this.selectedCustomer) {
        this.dataLoaded = false;
        setTimeout(() => {
          this.loadCustomerData();
          this.cdr.markForCheck();
        }, 0);
      } else if (this.showModal && !this.isEditing) {
        // Not editing - FORCE ensure form is completely empty
        this.forceResetForm();
        this.cdr.markForCheck();
      }
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewChecked() {
    // Only handle edit mode - NEVER reset form in add mode once initialized
    // This allows users to type freely without interruption
    if (this.showModal && this.isEditing && this.selectedCustomer && !this.dataLoaded) {
      // Verify data is actually loaded, if not, load it
      if (!this.customer.id || this.customer.username !== this.selectedCustomer.username) {
        this.loadCustomerData();
      } else {
        this.dataLoaded = true;
      }
    } else if (!this.showModal) {
      this.dataLoaded = false;
    }
    // DO NOT reset form in add mode here - let users type!
  }

  initializeCustomer() {
    // COMPLETELY reset customer object - create new object to break all references
    this.forceResetForm();
  }
  
  forceResetForm() {
    // FORCE reset - create completely new object reference
    this.customer = {
      id: 0,
      username: '',
      email: '',
      fullName: '',
      phone: '',
      role: 'customer',
      password: '',
      confirmPassword: ''
    };
    
    // Reset flag when initializing empty form
    this.dataLoaded = false;
    this.clearMessages();
    
    // Force change detection immediately
    this.cdr.markForCheck();
  }
  
  resetForm() {
    // COMPLETELY reset everything when modal closes - use force reset
    this.forceResetForm();
    this.isSaving = false;
  }

  loadCustomerData() {
    if (this.selectedCustomer) {
      // Create a new object to ensure change detection triggers
      const newCustomer = {
        id: this.selectedCustomer.id || 0,
        username: this.selectedCustomer.username || '',
        email: this.selectedCustomer.email || '',
        fullName: this.selectedCustomer.fullName || '',
        phone: this.selectedCustomer.phone || '',
        role: this.selectedCustomer.role || 'customer',
        password: '', // Don't load password when editing
        confirmPassword: '' // Don't load confirm password when editing
      };
      
      // Assign new object reference to trigger change detection
      this.customer = { ...newCustomer };
      this.dataLoaded = true;
      this.clearMessages();
      
      // Force multiple change detection cycles to ensure form binds
      this.cdr.markForCheck();
      setTimeout(() => {
        this.cdr.detectChanges();
        // Double check after another tick
        setTimeout(() => {
          if (this.showModal && this.isEditing) {
            // Re-check and reload if still not bound
            if (!this.customer.username || this.customer.username !== this.selectedCustomer?.username) {
              this.customer = { ...newCustomer };
              this.cdr.detectChanges();
            }
          }
        }, 50);
      }, 0);
    }
  }

  closeModal() {
    this.showModal = false;
    this.resetForm();
    this.modalClosed.emit();
  }

  clearMessages() {
    this.saveError = '';
    this.saveSuccess = '';
    this.cdr.markForCheck();
  }

  onSaveCustomer(event: Event) {
    event.preventDefault();
    
    if (!this.isFormValid()) {
      return;
    }

    this.isSaving = true;
    this.saveError = '';
    this.saveSuccess = '';

    if (this.isEditing) {
      this.updateCustomer();
    } else {
      this.createCustomer();
    }
  }

  isFormValid(): boolean {
    if (!this.customer.username || this.customer.username.trim().length < 3) {
      this.saveError = 'Tên đăng nhập phải có ít nhất 3 ký tự';
      this.cdr.markForCheck();
      return false;
    }

    if (!this.customer.email || !this.isValidEmail(this.customer.email)) {
      this.saveError = 'Email không hợp lệ';
      this.cdr.markForCheck();
      return false;
    }

    if (!this.isEditing && (!this.customer.password || this.customer.password.length < 6)) {
      this.saveError = 'Mật khẩu phải có ít nhất 6 ký tự';
      this.cdr.markForCheck();
      return false;
    }

    if (!this.isEditing && this.customer.password !== this.customer.confirmPassword) {
      this.saveError = 'Mật khẩu xác nhận không khớp';
      this.cdr.markForCheck();
      return false;
    }

    return true;
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  createCustomer() {
    const customerData = {
      username: this.customer.username.trim(),
      email: this.customer.email.trim(),
      fullName: this.customer.fullName?.trim() || '',
      phone: this.customer.phone?.trim() || null,
      role: this.customer.role || 'customer',
      password: this.customer.password
    };

    this.customerService.createCustomer(customerData).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (customer) => {
        this.saveSuccess = 'Tạo tài khoản thành công!';
        this.isSaving = false;
        this.cdr.markForCheck();
        
        // Show success message briefly, then close modal and emit event
        setTimeout(() => {
          this.closeModal();
          // Emit event immediately after closing modal
          this.customerSaved.emit(customer);
        }, 1000);
      },
      error: (error) => {
        this.isSaving = false;
        this.saveError = error.error?.message || error.message || 'Lỗi khi tạo tài khoản';
        this.cdr.markForCheck();
      }
    });
  }

  updateCustomer() {
    if (!this.selectedCustomer?.id) {
      this.saveError = 'Không tìm thấy ID người dùng';
      this.isSaving = false;
      this.cdr.markForCheck();
      return;
    }

    const updateData = {
      username: this.customer.username.trim(),
      email: this.customer.email.trim(),
      fullName: this.customer.fullName?.trim() || '',
      phone: this.customer.phone?.trim() || null,
      role: this.customer.role || 'customer'
    };

    this.customerService.updateCustomer(this.selectedCustomer.id, updateData).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (customer) => {
        this.saveSuccess = 'Cập nhật tài khoản thành công!';
        this.isSaving = false;
        this.cdr.markForCheck();
        
        // Show success message briefly, then close modal and emit event
        // Same behavior as create customer
        setTimeout(() => {
          this.closeModal();
          // Emit event immediately after closing modal to trigger reload
          this.customerSaved.emit(customer);
        }, 1000);
      },
      error: (error) => {
        this.isSaving = false;
        this.saveError = error.error?.message || error.message || 'Lỗi khi cập nhật tài khoản';
        this.cdr.markForCheck();
      }
    });
  }
}

