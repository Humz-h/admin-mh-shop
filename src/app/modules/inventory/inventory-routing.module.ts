import { Routes } from '@angular/router';
import { InventoryListComponent } from './pages/inventory-list/inventory-list.component';
import { TransactionHistoryComponent } from './pages/transaction-history/transaction-history.component';

export const INVENTORY_ROUTES: Routes = [
  { path: '', component: InventoryListComponent },
  { path: 'transactions', component: TransactionHistoryComponent }
];

export default INVENTORY_ROUTES;

