import { Component, Input } from '@angular/core';
import { SmartChartComponent, type ChartDatum, type ChartOptions } from '../../../NEW for implemnet/smart-chart/smart-chart';

@Component({
  selector: 'app-widget-radial-bar-chart',
  standalone: true,
  imports: [SmartChartComponent],
  templateUrl: './widget-radial-bar-chart.html',
  styleUrl: './widget-radial-bar-chart.css',
})
export class WidgetRadialBarChart {
  @Input() series: number[] = [];
  @Input() labels: string[] = [];
  @Input() colors: string[] = [];

  get radialBarData(): ChartDatum[] {
    if (!this.labels?.length) return [];
    return this.labels.map((label, i) => ({ label, value: this.series[i] ?? 0 }));
  }

  get radialBarOptions(): ChartOptions {
    return { max: 100, showLegend: true, height: 220, useFillHeight: true };
  }
}
