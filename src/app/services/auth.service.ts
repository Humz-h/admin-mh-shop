import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import { Customer } from './customer.service';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: string;
  fullName: string;
  phone: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:5000/api/Customers';
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly AUTH_KEY = 'admin_auth_user';
  private readonly AUTH_TOKEN_KEY = 'admin_auth_token';

  // Đăng nhập
  login(credentials: LoginCredentials): Observable<AuthUser> {
    const params = new HttpParams()
      .set('page', '1')
      .set('pageSize', '1000');

    return this.http.get<Customer[]>(this.apiUrl, { params }).pipe(
      timeout(10000),
      map(customers => {
        // Tìm user theo username
        const user = customers.find(c => c.username === credentials.username);
        
        if (!user) {
          throw new Error('Tên đăng nhập không tồn tại');
        }

        // Kiểm tra role phải là admin
        if (user.role !== 'admin') {
          throw new Error('Chỉ quyền admin mới có thể đăng nhập vào trang quản trị');
        }

        // Lưu thông tin user (trong thực tế nên có API login riêng với password verification)
        const authUser: AuthUser = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
          phone: user.phone
        };

        // Lưu vào localStorage
        this.setAuthUser(authUser);
        this.setAuthToken(`admin_token_${user.id}_${Date.now()}`);

        return authUser;
      }),
      catchError(error => {
        if (error.message) {
          return throwError(() => new Error(error.message));
        }
        return throwError(() => new Error('Đăng nhập thất bại. Vui lòng thử lại.'));
      })
    );
  }

  // Đăng xuất
  logout(): void {
    this.clearAuth();
    this.router.navigate(['/login']);
  }

  // Kiểm tra đã đăng nhập chưa
  isAuthenticated(): boolean {
    const user = this.getAuthUser();
    return !!user && !!user.role;
  }

  // Lấy thông tin user hiện tại
  getCurrentUser(): AuthUser | null {
    return this.getAuthUser();
  }

  // Kiểm tra có phải admin không
  isAdmin(): boolean {
    const user = this.getAuthUser();
    return user?.role === 'admin' || false;
  }

  // Lưu thông tin user vào localStorage
  private setAuthUser(user: AuthUser): void {
    localStorage.setItem(this.AUTH_KEY, JSON.stringify(user));
  }

  // Lấy thông tin user từ localStorage
  private getAuthUser(): AuthUser | null {
    const userStr = localStorage.getItem(this.AUTH_KEY);
    if (!userStr) {
      return null;
    }
    try {
      return JSON.parse(userStr) as AuthUser;
    } catch {
      return null;
    }
  }

  // Lưu token
  private setAuthToken(token: string): void {
    localStorage.setItem(this.AUTH_TOKEN_KEY, token);
  }

  // Lấy token
  getAuthToken(): string | null {
    return localStorage.getItem(this.AUTH_TOKEN_KEY);
  }

  // Xóa thông tin auth
  private clearAuth(): void {
    localStorage.removeItem(this.AUTH_KEY);
    localStorage.removeItem(this.AUTH_TOKEN_KEY);
  }
}

