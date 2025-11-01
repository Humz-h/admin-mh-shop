import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';

export interface Customer {
  id: number;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  fullName: string;
  phone: string | null;
  updatedAt: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private apiUrl = 'http://localhost:5000/api/Customers';
  private readonly http = inject(HttpClient);

  getCustomers(page: number = 1, pageSize: number = 20): Observable<Customer[]> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    return this.http.get<Customer[]>(this.apiUrl, { params }).pipe(
      timeout(10000),
      map(customers => {
        if (Array.isArray(customers)) {
          return customers.map(customer => ({
            ...customer,
            phone: customer.phone || null,
            updatedAt: customer.updatedAt || null
          }));
        }
        return [];
      }),
      catchError(error => {
        throw error;
      })
    );
  }

  createCustomer(customer: Partial<Customer> & { password?: string }): Observable<Customer> {
    const customerData = {
      username: customer.username || '',
      email: customer.email || '',
      fullName: customer.fullName || '',
      phone: customer.phone || null,
      role: customer.role || 'customer',
      password: customer.password || ''
    };

    return this.http.post<Customer>(this.apiUrl, customerData).pipe(
      timeout(10000),
      catchError(error => {
        throw error;
      })
    );
  }

  updateCustomer(id: number, customer: Partial<Customer>): Observable<Customer> {
    const updateData = {
      username: customer.username,
      email: customer.email,
      fullName: customer.fullName,
      phone: customer.phone || null,
      role: customer.role
    };

    return this.http.put<Customer>(`${this.apiUrl}/${id}`, updateData).pipe(
      timeout(10000),
      catchError(error => {
        throw error;
      })
    );  
  }

  deleteCustomer(id: number): Observable<{ success: boolean }> {
    // API might return success message, empty response, or 204 No Content
    // Accept any response type for flexibility
    return this.http.delete(`${this.apiUrl}/${id}`, { observe: 'response' }).pipe(
      timeout(10000),
      map(response => {
        // Return success for any successful response (200, 204, etc.)
        // Even if response body is empty, status 200/204 means success
        if (response.status === 200 || response.status === 204) {
          return { success: true };
        }
        return (response.body as { success: boolean }) || { success: true };
      }),
      catchError(error => {
        throw error;
      })
    );
  }
}

