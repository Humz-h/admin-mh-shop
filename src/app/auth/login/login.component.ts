import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, LoginCredentials } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  credentials: LoginCredentials = {
    username: '',
    password: ''
  };

  isLoading = false;
  errorMessage = '';
  showPassword = false;

  ngOnInit(): void {
    // Không tự động redirect, luôn hiển thị trang login
    // User phải đăng nhập lại mỗi lần mở ứng dụng
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    // Reset error
    this.errorMessage = '';
    
    // Validation
    if (!this.credentials.username.trim()) {
      this.errorMessage = 'Vui lòng nhập tên đăng nhập';
      return;
    }

    if (!this.credentials.password.trim()) {
      this.errorMessage = 'Vui lòng nhập mật khẩu';
      return;
    }

    this.isLoading = true;

    this.authService.login(this.credentials).subscribe({
      next: () => {
        this.isLoading = false;
        // Redirect về dashboard
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
      }
    });
  }
}

