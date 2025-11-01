import { Routes } from '@angular/router';
import { Dashboard } from './dashboard1/dashboard';
import { Ecom } from './ecom/ecom';
import { ProductList } from './product-list/product-list';
import { OrderList } from './order-list/order-list';
import { EcommerceComponent } from './dashboard/ecommerce/ecommerce.component';
import { AppLayoutComponent } from './shared/layout/app-layout/app-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      {
        path: '',
        component: EcommerceComponent,
        pathMatch: 'full',
        title: 'Dashboard'
      },
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
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
