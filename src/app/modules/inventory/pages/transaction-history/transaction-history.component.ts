import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService, InventoryTransaction } from '../../services/inventory.service';

@Component({
  selector: 'app-transaction-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './transaction-history.component.html',
  styleUrls: ['./transaction-history.component.css']
})
export class TransactionHistoryComponent implements OnInit {
  transactions: InventoryTransaction[] = [];
  loading = false;
  errorMessage = '';
  private readonly inventoryService = inject(InventoryService);

  ngOnInit(): void {
    this.loadTransactions();
  }

  loadTransactions() {
    this.loading = true;
    this.errorMessage = '';
    this.inventoryService.getTransactions().subscribe({
      next: (data) => {
        this.transactions = data;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Lỗi khi tải lịch sử giao dịch';
        this.loading = false;
      }
    });
  }
}

