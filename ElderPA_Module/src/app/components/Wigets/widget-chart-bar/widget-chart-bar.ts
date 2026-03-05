import { Component, Input } from '@angular/core';
import { SmartChartComponent, type ChartDatum, type ChartOptions } from '../../../NEW for implemnet/smart-chart/smart-chart';

@Component({
  selector: 'app-widget-chart-bar',
  standalone: true,
  imports: [SmartChartComponent],
  templateUrl: './widget-chart-bar.html',
  styleUrl: './widget-chart-bar.css',
})
export class WidgetChartBar {
  @Input() series: number[] = [];
  @Input() labels: string[] = [];
  @Input() targets: number[] | null = null;
  @Input() chartTitle = '';
  @Input() indicatorName = '';
  @Input() markerIndices: number[] = [];

  get barChartData(): ChartDatum[] {
    if (!this.labels?.length || !Array.isArray(this.series)) return [];
    const targetVal = this.targets?.length ? (this.targets[0] ?? this.targets[this.series.length - 1]) : undefined;
    const max = Math.max(...this.series.map(v => v ?? 0), targetVal ?? 0, 1);
    return this.labels.map((label, i) => {
      const value = this.series[i] ?? 0;
      const rowTarget = this.targets?.length === this.series.length ? this.targets[i] : targetVal;
      return {
        label,
        value,
        target: rowTarget != null && max > 0 ? (rowTarget / max) * 100 : undefined,
      };
    });
  }

  get barChartOptions(): ChartOptions {
    if (!this.series?.length) return { showAxis: true, showLegend: false, height: 200, useFillHeight: true };
    const targetVal = this.targets?.length ? this.targets[0] : undefined;
    const max = Math.max(...this.series.map(v => v ?? 0), targetVal ?? 0, 1);
    return { max, showAxis: true, showLegend: false, height: 200, useFillHeight: true };
  }
}
