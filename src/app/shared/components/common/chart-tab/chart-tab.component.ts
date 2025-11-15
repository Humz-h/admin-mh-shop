import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-chart-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chart-tab.component.html'
})
export class ChartTabComponent {
  @Input() tabs: string[] = [];
  @Input() activeTab: string = '';
  @Output() tabChange = new EventEmitter<string>();

  selectTab(tab: string): void {
    this.activeTab = tab;
    this.tabChange.emit(tab);
  }
}









