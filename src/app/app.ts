import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('admin-mh-shop');
  private readonly router = inject(Router);

  navigateToProducts() {
    this.router.navigate(['/products']);
  }
}
