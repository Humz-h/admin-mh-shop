import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { 
  NgApexchartsModule, 
  ApexAxisChartSeries, 
  ApexChart, 
  ApexXAxis, 
  ApexPlotOptions, 
  ApexDataLabels, 
  ApexStroke, 
  ApexLegend, 
  ApexYAxis, 
  ApexGrid, 
  ApexFill, 
  ApexTooltip 
} from 'ng-apexcharts';
import { BadgeComponent } from '../../../ui/badge/badge.component';
import { SafeHtmlPipe } from '../../../../pipe/safe-html.pipe';

@Component({
  selector: 'app-orders-chart',
  standalone: true,
  imports: [
    CommonModule,
    NgApexchartsModule,
    BadgeComponent,
    SafeHtmlPipe,
  ],
  templateUrl: './orders-chart.component.html'
})
export class OrdersChartComponent {
  public arrowUpIcon = `<svg class="fill-current" width="1em" height="1em" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.06462 1.62393C6.20193 1.47072 6.40135 1.37432 6.62329 1.37432C6.6236 1.37432 6.62391 1.37432 6.62422 1.37432C6.81631 1.37415 7.00845 1.44731 7.15505 1.5938L10.1551 4.5918C10.4481 4.88459 10.4483 5.35946 10.1555 5.65246C9.86273 5.94546 9.38785 5.94562 9.09486 5.65283L7.37329 3.93247L7.37329 10.125C7.37329 10.5392 7.03751 10.875 6.62329 10.875C6.20908 10.875 5.87329 10.5392 5.87329 10.125L5.87329 3.93578L4.15516 5.65281C3.86218 5.94561 3.3873 5.94546 3.0945 5.65248C2.8017 5.35949 2.80185 4.88462 3.09484 4.59182L6.06462 1.62393Z" fill=""></path></svg>`;

  public series: ApexAxisChartSeries = [
    {
      name: 'Orders',
      data: [168, 385, 201, 298, 187, 195, 291, 110],
    },
  ];
  public chart: ApexChart = {
    fontFamily: 'Outfit, sans-serif',
    type: 'bar',
    height: 180,
    toolbar: { show: false },
  };
  public xaxis: ApexXAxis = {
    categories: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: {
      style: {
        fontWeight: 400
      }
    }
  };
  public plotOptions: ApexPlotOptions = {
    bar: {
      horizontal: false,
      columnWidth: '39%',
      borderRadius: 5,
      borderRadiusApplication: 'end',
    },
  };
  public dataLabels: ApexDataLabels = { enabled: false };
  public stroke: ApexStroke = {
    show: true,
    width: 4,
    colors: ['transparent'],
  };
  public legend: ApexLegend = {
    show: false,
  };
  public yaxis: ApexYAxis = {
    title: { text: undefined },
    labels: {
      style: {
        fontWeight: 400
      }
    }
  };
  public grid: ApexGrid = { yaxis: { lines: { show: true } } };
  public fill: ApexFill = { opacity: 1 };
  public tooltip: ApexTooltip = {
    x: { show: false },
    y: { formatter: (val: number) => `${val}` },
  };
  public colors: string[] = ['#465fff'];
}

