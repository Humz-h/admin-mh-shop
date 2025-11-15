import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DropdownComponent } from '../../ui/dropdown/dropdown.component';
import { DropdownItemComponent } from '../../ui/dropdown/dropdown-item/dropdown-item.component';
import { AuthService, AuthUser } from '../../../../services/auth.service';

@Component({
  selector: 'app-user-dropdown',
  standalone: true,
  imports: [CommonModule, RouterModule, DropdownComponent, DropdownItemComponent],
  templateUrl: './user-dropdown.component.html'
})
export class UserDropdownComponent implements OnInit {
  private readonly authService: AuthService = inject(AuthService);
  
  isOpen = false;
  currentUser: AuthUser | null = null;

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
  }

  toggleDropdown() {
    this.isOpen = !this.isOpen;
  }

  closeDropdown() {
    this.isOpen = false;
  }

  logout() {
    this.closeDropdown();
    this.authService.logout();
  }

  getInitials(): string {
    if (!this.currentUser?.fullName) {
      return this.currentUser?.username?.charAt(0).toUpperCase() || 'A';
    }
    const names = this.currentUser.fullName.split(' ');
    if (names.length >= 2) {
      return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    }
    return this.currentUser.fullName.charAt(0).toUpperCase();
  }
}



