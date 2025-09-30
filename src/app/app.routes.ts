import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { ProductList } from './product-list/product-list';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: Dashboard },
  { path: 'products', component: ProductList },
  { path: '**', redirectTo: '/dashboard' }
];
