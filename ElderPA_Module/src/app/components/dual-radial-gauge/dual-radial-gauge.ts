import { Component, AfterViewInit, ElementRef, ViewChild, Input, OnChanges, SimpleChanges } from '@angular/core';


@Component({
  selector: 'app-dual-radial-gauge',
  imports: [],
  templateUrl: './dual-radial-gauge.html',
  styleUrl: './dual-radial-gauge.css',
})
export class DualRadialGauge implements AfterViewInit, OnChanges {
  @ViewChild('chart', { static: true }) chartRef!: ElementRef;
  private chart: any;

  /** Current value */
  @Input() current: number = 0;

  /** Maximum value */
  @Input() max: number = 100;
  @Input() height = 150;
  /** Optional label below value */
  @Input() label: string = '';
  @Input() fontsize: string = '12px';

  /** Calculate percentage of current/max */
  private get percentage(): number {
    return this.max > 0 ? Math.min((this.current / this.max) * 100, 100) : 0;
  }

  async ngAfterViewInit() {
    if (typeof window !== 'undefined') {
      const ApexCharts = (await import('apexcharts')).default;

      const colors = [
        getComputedStyle(document.documentElement).getPropertyValue('--color-accent2')?.trim() || '#00cec1'
      ];

      const options: any = {
        chart: { type: 'radialBar', height: this.height },
        series: [this.percentage],
        labels: [this.label],
        colors: colors,
        plotOptions: {
          radialBar: {
            startAngle: 0,
            endAngle: 360,
            hollow: { size: '65%', background: 'transparent' },
            dataLabels: {
              name: { show: true ,fontSize: this.fontsize,},
              value: {
                show: true,
                fontSize: this.fontsize,
                fontWeight: 600,
                color: getComputedStyle(document.documentElement).getPropertyValue('--color-text'),
                formatter: () => this.current > 1000?`${this.current} / ${this.max}` :`${this.current} / ${this.max}`
              },
              total: { show: false }
            }
          }
        },
        legend: { show: false },
        responsive: [
          { breakpoint: 480, options: { chart: { height: 150 } } }
        ]
      };

      this.chart = new ApexCharts(this.chartRef.nativeElement, options);
      this.chart.render();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.chart && (changes['current'] || changes['max'])) {
      this.chart.updateOptions({
        series: [this.percentage],
        dataLabels: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--color-text'),
          value: {
            formatter: () => `${this.current} / ${this.max}`
          }
        }
      });
    }
  }
}
