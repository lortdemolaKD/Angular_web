import { Component, Input } from '@angular/core';
import { SmartChartComponent, type ChartDatum } from '../../../NEW for implemnet/smart-chart/smart-chart';

@Component({
  selector: 'app-widget-piechart',
  standalone: true,
  imports: [SmartChartComponent],
  templateUrl: './widget-piechart.html',
  styleUrl: './widget-piechart.css',
})
export class WidgetPiechart {
  @Input() series: number[] = [];
  @Input() labels: string[] = [];
  @Input() colors_insert: string[] = [];
  @Input() type = '';
  @Input() position = '';

  get pieChartData(): ChartDatum[] {
    if (!this.labels?.length) return [];
    return this.labels.map((label, i) => ({ label, value: this.series[i] ?? 0 }));
  }
}
