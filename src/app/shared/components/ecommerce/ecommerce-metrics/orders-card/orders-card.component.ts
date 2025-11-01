import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { BadgeComponent } from '../../../ui/badge/badge.component';
import { SafeHtmlPipe } from '../../../../pipe/safe-html.pipe';

@Component({
  selector: 'app-orders-card',
  standalone: true,
  imports: [
    CommonModule,
    BadgeComponent,
    SafeHtmlPipe,
  ],
  templateUrl: './orders-card.component.html'
})
export class OrdersCardComponent {
  public arrowDownIcon = `<svg class="fill-current" width="1em" height="1em" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.93538 10.3761C6.79807 10.5293 6.59865 10.6257 6.37671 10.6257C6.3764 10.6257 6.37609 10.6257 6.37578 10.6257C6.18369 10.6259 5.99155 10.5527 5.84495 10.4062L2.84495 7.4082C2.55195 7.11541 2.55172 6.64054 2.84451 6.34754C3.13727 6.05454 3.61215 6.05438 3.90514 6.34717L5.62671 8.06753L5.62671 1.875C5.62671 1.46079 5.96249 1.125 6.37671 1.125C6.79092 1.125 7.12671 1.46079 7.12671 1.875L7.12671 8.06422L8.84484 6.34719C9.13782 6.05439 9.6127 6.05454 9.9055 6.34752C10.1983 6.64051 10.1982 7.11538 9.90516 7.40818L6.93538 10.3761Z" fill=""></path></svg>`;
  
  public ordersIcon = `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M8.25 4.5C7.2835 4.5 6.5 5.2835 6.5 6.25V7.5H17.5V6.25C17.5 5.2835 16.7165 4.5 15.75 4.5H8.25ZM5 6.25C5 4.45507 6.45507 3 8.25 3H15.75C17.5449 3 19 4.45507 19 6.25V18.25C19 20.0449 17.5449 21.5 15.75 21.5H8.25C6.45507 21.5 5 20.0449 5 18.25V6.25ZM6.5 9V18.25C6.5 19.2165 7.2835 20 8.25 20H15.75C16.7165 20 17.5 19.2165 17.5 18.25V9H6.5Z" fill="currentColor"></path></svg>`;
}

