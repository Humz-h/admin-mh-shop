import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-ecom',
  imports: [RouterLink],
  templateUrl: './ecom.html',
  styleUrl: './ecom.scss'
})
export class Ecom {
  constructor(private router: Router) {}

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

