import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { ProductList } from './product-list/product-list';
import { OrderList } from './order-list/order-list';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: Dashboard },
  { path: 'products', component: ProductList },
  { path: 'orders', component: OrderList },
  { path: '**', redirectTo: '/dashboard' }
];
