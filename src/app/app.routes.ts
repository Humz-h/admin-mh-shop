import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { Ecom } from './ecom/ecom';
import { ProductList } from './product-list/product-list';
import { OrderList } from './order-list/order-list';

export const routes: Routes = [
  { path: '', redirectTo: '/ecom', pathMatch: 'full' },
  { path: 'dashboard', component: Dashboard },
  { path: 'ecom', component: Ecom },
  { path: 'products', component: ProductList },
  { path: 'orders', component: OrderList },
  { 
    path: 'inventory', 
    loadChildren: () => import('./modules/inventory/inventory-routing.module').then(m => m.INVENTORY_ROUTES || m.default)
  },
  { 
    path: 'users', 
    loadChildren: () => import('./modules/user/user-routing.module').then(m => m.USER_ROUTES || m.default)
  },
  { path: '**', redirectTo: '/ecom' }
];
