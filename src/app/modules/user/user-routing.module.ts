import { Routes } from '@angular/router';
import { UserListComponent } from './pages/user-list/user-list.component';

export const USER_ROUTES: Routes = [
  { path: '', component: UserListComponent }
];

export default USER_ROUTES;

