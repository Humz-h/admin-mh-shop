import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
}

export interface InventoryItem {
  id: number;
  productId: number;
  variantId: number;
  quantity: number;
  lastUpdated: string;
  product: Product;
}

export interface InventoryResponse {
  success: boolean;
  data: InventoryItem[];
}

export interface ProcessedInventoryItem {
  id: number;
  productId: number;
  variantId: number;
  productName: string;
  productImage: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  lastUpdated: Date;
  status: 'in-stock' | 'low-stock' | 'out-of-stock' | 'overstock';
  category: string;
  sku: string;
  unitPrice: number;
  totalValue: number;
  description: string;
}

export interface InventoryUpdate {
  productId: number;
  newStock: number;
  reason: string;
  updatedBy?: string;
  updatedAt: Date;
}

export interface InventoryStats {
  total: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  overstock: number;
  totalValue: number;
  averageStock: number;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private apiUrl = 'http://localhost:5000/api/Inventories';
  private readonly http = inject(HttpClient);

  // Lấy tất cả inventory items
  getAllInventoryItems(): Observable<ProcessedInventoryItem[]> {
    return this.http.get<InventoryResponse>(this.apiUrl).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data.map(item => this.processInventoryItem(item));
        }
        return [];
      }),
      catchError(error => {
        console.error('Error loading inventory items:', error);
        return of([]);
      })
    );
  }

  // Xử lý dữ liệu inventory item từ API
  private processInventoryItem(item: InventoryItem): ProcessedInventoryItem {
    // Sử dụng quantity từ inventory API thay vì stock từ product
    const currentStock = item.quantity; // Đây là số lượng tồn kho thực tế
    const minStock = Math.max(1, Math.floor(currentStock * 0.1));
    const maxStock = Math.max(currentStock * 2, 100);
    
    console.log(`Processing inventory item ${item.productId}: quantity=${item.quantity}, product.stock=${item.product.stock}`);
    
    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      productName: item.product.name,
      productImage: item.product.imageUrl,
      currentStock: currentStock, // Sử dụng quantity từ inventory
      minStock: minStock,
      maxStock: maxStock,
      lastUpdated: new Date(item.lastUpdated),
      status: this.getStockStatus(currentStock, minStock),
      category: this.getCategoryFromName(item.product.name),
      sku: `SKU-${item.productId.toString().padStart(3, '0')}`,
      unitPrice: item.product.price,
      totalValue: item.product.price * currentStock, // Tính theo quantity thực tế
      description: item.product.description
    };
  }

  // Xác định trạng thái tồn kho
  private getStockStatus(currentStock: number, minStock: number): 'in-stock' | 'low-stock' | 'out-of-stock' | 'overstock' {
    if (currentStock === 0) return 'out-of-stock';
    if (currentStock < minStock) return 'low-stock';
    if (currentStock > minStock * 5) return 'overstock';
    return 'in-stock';
  }

  // Phân loại sản phẩm dựa trên tên
  private getCategoryFromName(name: string): string {
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('điện thoại') || nameLower.includes('iphone') || nameLower.includes('samsung')) {
      return 'electronics';
    } else if (nameLower.includes('áo') || nameLower.includes('quần') || nameLower.includes('thời trang')) {
      return 'clothing';
    } else if (nameLower.includes('sách') || nameLower.includes('book')) {
      return 'books';
    } else if (nameLower.includes('máy') || nameLower.includes('điều hòa') || nameLower.includes('giặt')) {
      return 'home';
    }
    return 'electronics';
  }

  // Lấy inventory item theo ID
  getInventoryItemById(id: number): Observable<ProcessedInventoryItem> {
    return this.http.get<InventoryItem>(`${this.apiUrl}/${id}`).pipe(
      map(item => this.processInventoryItem(item)),
      catchError(error => {
        console.error('Error loading inventory item:', error);
        return of({} as ProcessedInventoryItem);
      })
    );
  }

  // Cập nhật tồn kho
  updateStock(update: InventoryUpdate): Observable<ProcessedInventoryItem> {
    // Cập nhật quantity trong inventory, không phải stock trong product
    const updatePayload = {
      quantity: update.newStock,
      reason: update.reason,
      updatedAt: update.updatedAt
    };
    
    console.log('Updating inventory quantity:', updatePayload);
    
    return this.http.put<InventoryItem>(`${this.apiUrl}/${update.productId}/quantity`, updatePayload).pipe(
      map(item => this.processInventoryItem(item)),
      catchError(error => {
        console.error('Error updating inventory quantity:', error);
        throw error;
      })
    );
  }

  // Lấy thống kê tồn kho
  getInventoryStats(): Observable<InventoryStats> {
    return this.http.get<InventoryStats>(`${this.apiUrl}/stats`).pipe(
      catchError(error => {
        console.error('Error loading inventory stats:', error);
        return of({
          total: 0,
          inStock: 0,
          lowStock: 0,
          outOfStock: 0,
          overstock: 0,
          totalValue: 0,
          averageStock: 0
        });
      })
    );
  }

  // Lấy danh sách sản phẩm sắp hết hàng
  getLowStockItems(threshold?: number): Observable<ProcessedInventoryItem[]> {
    const params = threshold ? `?threshold=${threshold}` : '';
    return this.http.get<InventoryItem[]>(`${this.apiUrl}/low-stock${params}`).pipe(
      map(items => items.map(item => this.processInventoryItem(item))),
      catchError(error => {
        console.error('Error loading low stock items:', error);
        return of([]);
      })
    );
  }

  // Lấy danh sách sản phẩm hết hàng
  getOutOfStockItems(): Observable<ProcessedInventoryItem[]> {
    return this.http.get<InventoryItem[]>(`${this.apiUrl}/out-of-stock`).pipe(
      map(items => items.map(item => this.processInventoryItem(item))),
      catchError(error => {
        console.error('Error loading out of stock items:', error);
        return of([]);
      })
    );
  }

  // Lấy lịch sử cập nhật tồn kho
  getStockHistory(productId: number): Observable<InventoryUpdate[]> {
    return this.http.get<InventoryUpdate[]>(`${this.apiUrl}/${productId}/history`).pipe(
      map(updates => updates.map(update => ({
        ...update,
        updatedAt: new Date(update.updatedAt)
      }))),
      catchError(error => {
        console.error('Error loading stock history:', error);
        return of([]);
      })
    );
  }

  // Tạo báo cáo tồn kho
  generateInventoryReport(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/report`, { responseType: 'blob' }).pipe(
      catchError(error => {
        console.error('Error generating inventory report:', error);
        throw error;
      })
    );
  }

  // Kiểm tra kết nối API
  checkConnection(): Observable<boolean> {
    return this.http.get(`${this.apiUrl}/health`, { 
      observe: 'response',
      timeout: 5000 
    }).pipe(
      map(response => response.status === 200),
      catchError(() => of(false))
    );
  }
}
