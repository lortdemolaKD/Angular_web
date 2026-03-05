import { Component, AfterViewInit, ElementRef, ViewChild, Input, OnChanges, SimpleChanges } from '@angular/core';


@Component({
  selector: 'app-radial-gauge',
  imports: [],
  templateUrl: './radial-gauge.html',
  styleUrl: './radial-gauge.css',
})
export class RadialGauge implements AfterViewInit, OnChanges {
  @ViewChild('chart', { static: true }) chartRef!: ElementRef;

  private chart: any;


  @Input() current: number = 0;
  @Input() max: number = 1;
  @Input() label: string = '';
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
        chart: { type: 'radialBar', height: 200 },
        ['series']: [this.percentage],
        ['labels']: [this.label],
        colors: colors,
        plotOptions: {
          radialBar: {
            startAngle: 0,
            endAngle: 360,
            hollow: {
              size: '50%',
              background: 'transparent'
            },
            dataLabels: {
              show: true,
              name: { show: false },
              value: {
                show: true,
                fontSize: '44px',
                fontWeight: 600,
                color: getComputedStyle(document.documentElement).getPropertyValue('--color-text') || '#484748',
                formatter: (val: number) => `${Math.round(val)}%`
              },
              total: { show: false }
            }
          }
        },
        responsive: [
          {
            breakpoint: 480,
            options: {
              chart: { height: 150 }
            }
          }
        ]
      };

      this.chart = new ApexCharts(this.chartRef.nativeElement, options);
      this.chart.render();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.chart && (changes['current'] || changes['max'])) {
      this.chart.updateOptions({
        series: [this.percentage]
      });
    }
  }
}
