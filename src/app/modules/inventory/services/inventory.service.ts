import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

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

interface RawInventoryItem {
  id?: number;
  productId?: number;
  quantity?: number | string;
  lastUpdated?: string;
  lastImportDate?: string;
  status?: boolean;
  daysInStock?: number;
  productName?: string;
  productCode?: string;
  product?: {
    id?: number;
    name?: string;
    productName?: string;
    productCode?: string;
    product_code?: string;
    price?: number;
    salePrice?: number;
    stock?: number;
  };
}

interface InventoryApiResponse {
  success?: boolean;
  data?: RawInventoryItem[] | RawInventoryItem;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private apiUrl = 'http://localhost:5000/api/Inventory';
  private transactionUrl = 'http://localhost:5000/api/InventoryTransaction';
  private readonly http = inject(HttpClient);

  getInventories(): Observable<Inventory[]> {
    return this.http.get<InventoryApiResponse | RawInventoryItem[] | RawInventoryItem>(this.apiUrl).pipe(
      map(response => {
        if (!response) {
          return [];
        }
        
        let items: RawInventoryItem[] = [];
        
        if (Array.isArray(response)) {
          items = response;
        } else if ('success' in response && response.success && Array.isArray(response.data)) {
          items = response.data as RawInventoryItem[];
        } else if ('data' in response && Array.isArray(response.data)) {
          items = response.data as RawInventoryItem[];
        } else if (typeof response === 'object' && !Array.isArray(response) && !('success' in response)) {
          items = [response as RawInventoryItem];
        }
        
        if (items.length === 0) {
          return [];
        }
        
        return items.map((item: RawInventoryItem) => this.mapToInventory(item)).filter((item): item is Inventory => item !== null);
      }),
      catchError(error => {
        throw error;
      })
    );
  }

  private mapToInventory(item: RawInventoryItem): Inventory | null {
    if (!item || typeof item !== 'object') {
      return null;
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
    const productId = item.productId || item.id || 0;

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

