import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
  productCode?: string;
  product_code?: string;
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

export interface Inventory {
  id: number;
  productId: number;
  quantity: number;
  lastImportDate?: string;
  status: boolean;
  daysInStock: number;
  productName?: string;
  productCode?: string;
  product?: {
    name?: string;
    productName?: string;
    productCode?: string;
    salePrice?: number;
    stock: number;
  };
}

export interface InventoryTransaction {
  id: number;
  productId: number;
  transactionType: 'Import' | 'Export';
  quantity: number;
  transactionDate: string;
  note?: string;
  product?: {
    name: string;
    productCode: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private apiUrl = 'http://localhost:5000/api/Inventory';
  private transactionUrl = 'http://localhost:5000/api/InventoryTransaction';

  constructor(private http: HttpClient) {}

  getInventories(): Observable<Inventory[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(response => {
        if (!response) {
          return [];
        }
        
        let items: any[] = [];
        
        if (Array.isArray(response)) {
          items = response;
        } else if (response.success && Array.isArray(response.data)) {
          items = response.data;
        } else if (response.data && Array.isArray(response.data)) {
          items = response.data;
        } else if (typeof response === 'object' && !Array.isArray(response)) {
          items = [response];
        }
        
        if (items.length === 0) {
          return [];
        }
        
        return items.map((item: any) => this.mapToInventory(item)).filter(item => item !== null && item !== undefined);
      }),
      catchError(error => {
        throw error;
      })
    );
  }

  private mapToInventory(item: any): Inventory {
    if (!item || typeof item !== 'object') {
      return null as any;
    }

    const dateValue = item.lastUpdated || item.lastImportDate;
    let daysInStock = 0;
    
    if (dateValue) {
      try {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          daysInStock = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
          daysInStock = Math.max(0, daysInStock);
        }
      } catch (e) {
        daysInStock = item.daysInStock || 0;
      }
    } else {
      daysInStock = item.daysInStock || 0;
    }

    const product = item.product || {};
    const productName = item.productName || product.productName || product.name || item.product?.name || '';
    const productCode = item.productCode || product.productCode || product.product_code || item.product?.productCode || `PRD-${item.productId || item.id || ''}`;

    const quantity = Number(item.quantity) || 0;
    const productId = item.productId || item.id;

    return {
      id: item.id || 0,
      productId: productId,
      quantity: quantity,
      lastImportDate: dateValue || undefined,
      status: item.status !== undefined ? Boolean(item.status) : (quantity > 0),
      daysInStock: daysInStock,
      productName: productName,
      productCode: productCode,
      product: product && Object.keys(product).length > 0 ? {
        name: productName || product.name,
        productName: productName,
        productCode: productCode,
        salePrice: Number(product.price || product.salePrice || 0),
        stock: Number(product.stock || quantity)
      } : undefined
    };
  }

  importStock(productId: number, quantity: number): Observable<Inventory> {
    return this.http.post<Inventory>(`${this.apiUrl}/import?productId=${productId}&quantity=${quantity}`, {});
  }

  exportStock(productId: number, quantity: number): Observable<Inventory> {
    return this.http.post<Inventory>(`${this.apiUrl}/export?productId=${productId}&quantity=${quantity}`, {});
  }

  getTransactions(): Observable<InventoryTransaction[]> {
    return this.http.get<InventoryTransaction[]>(this.transactionUrl);
  }
}

