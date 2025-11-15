import { Routes } from '@angular/router';
import { Ecom } from './ecom/ecom';
import { ProductList } from './product-list/product-list';
import { OrderList } from './order-list/order-list';
import { EcommerceComponent } from './dashboard/ecommerce/ecommerce.component';
import { AppLayoutComponent } from './shared/layout/app-layout/app-layout.component';
import { LoginComponent } from './auth/login/login.component';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent,
    title: 'Đăng nhập'
  },
  {
    path: '',
    canActivate: [authGuard],
    component: AppLayoutComponent,
    children: [
      {
        path: 'dashboard',
        component: EcommerceComponent,
        title: 'Dashboard'
      },
      { 
        path: 'ecom', 
        component: Ecom
      },
      { 
        path: 'products', 
        component: ProductList
      },
      { 
        path: 'orders', 
        component: OrderList
      },
      { 
        path: 'inventory', 
        loadChildren: () => import('./modules/inventory/inventory-routing.module').then(m => m.INVENTORY_ROUTES || m.default)
      },
      { 
        path: 'users', 
        loadChildren: () => import('./modules/user/user-routing.module').then(m => m.USER_ROUTES || m.default)
      }
    ]
  },
  { path: '**', redirectTo: '/login' }
];
