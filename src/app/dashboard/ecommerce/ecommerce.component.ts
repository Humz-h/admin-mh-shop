import { Component } from '@angular/core';
import { CustomersCardComponent } from '../../shared/components/ecommerce/ecommerce-metrics/customers-card/customers-card.component';
import { OrdersCardComponent } from '../../shared/components/ecommerce/ecommerce-metrics/orders-card/orders-card.component';
import { MonthlySalesChartComponent } from '../../shared/components/ecommerce/ecommerce-metrics/monthly-sales-chart/monthly-sales-chart.component';
import { MonthlyTargetComponent } from '../../shared/components/ecommerce/ecommerce-metrics/monthly-target/monthly-target.component';
import { StatisticsChartComponent } from '../../shared/components/ecommerce/ecommerce-metrics/statics-chart/statics-chart.component';

@Component({
  selector: 'app-ecommerce',
  standalone: true,
  imports: [
    CustomersCardComponent,
    OrdersCardComponent,
    MonthlySalesChartComponent,
    MonthlyTargetComponent,
    StatisticsChartComponent,
  ],
  templateUrl: './ecommerce.component.html',
  styleUrls: ['./ecommerce.component.scss'],
})
export class EcommerceComponent {}
