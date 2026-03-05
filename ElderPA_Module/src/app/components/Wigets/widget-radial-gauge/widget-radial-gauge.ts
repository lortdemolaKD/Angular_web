import { Component, Input } from '@angular/core';
import { SmartChartComponent, type ChartDatum, type ChartOptions } from '../../../NEW for implemnet/smart-chart/smart-chart';

@Component({
  selector: 'app-widget-radial-gauge',
  standalone: true,
  imports: [SmartChartComponent],
  templateUrl: './widget-radial-gauge.html',
  styleUrl: './widget-radial-gauge.css',
})
export class WidgetRadialGauge {
  @Input() current = 0;
  @Input() max = 100;
  @Input() label = '';

  get gaugeData(): ChartDatum[] {
    return [{ label: this.label || 'Value', value: this.current }];
  }

  get gaugeOptions(): ChartOptions {
    const max = this.max > 0 ? this.max : 100;
    return { max, showLegend: false, height: 180, useFillHeight: true };
  }
}
