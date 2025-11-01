import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-ecom',
  imports: [RouterLink],
  templateUrl: './ecom.html',
  styleUrl: './ecom.scss'
})
export class Ecom {
  private readonly router = inject(Router);

  navigateToProducts() {
    this.router.navigate(['/products']);
  }

  navigateToOrders() {
    this.router.navigate(['/orders']);
  }

  navigateToInventories() {
    this.router.navigate(['/inventory']);
  }

  navigateToUsers() {
    this.router.navigate(['/users']);
  }
}

