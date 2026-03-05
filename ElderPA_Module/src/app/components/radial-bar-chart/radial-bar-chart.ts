import { Component, AfterViewInit, ElementRef, ViewChild, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-radial-bar-chart',
  standalone: true,
  template: `<div #chart></div>`,
  styleUrls: ['./radial-bar-chart.css']
})
export class RadialBarChart implements AfterViewInit, OnChanges {
  @ViewChild('chart', { static: true }) chartRef!: ElementRef;
  private chart: any;

  @Input() series: number[] = [];
  @Input() labels: string[] = [];
  @Input() colors: string[] = [];

  async ngAfterViewInit() {
    if (typeof window !== 'undefined') {
      const ApexCharts = (await import('apexcharts')).default;

    const defaultColors = [
      '#9a538e', '#00cec1', '#484748', '#939393', '#420a67'
    ];
    const chartColors = this.colors.length ? this.colors : defaultColors;

    const options: any = {
      chart: { type: 'radialBar', height: 300 },
      series: this.series,
      colors: chartColors,
      legend: { position: 'bottom',
        horizontalAlign: 'left',
        verticalAlign:'center',
        fontSize: '14px',
        show:true,
        markers: { width: 12, height: 12 },
        itemMargin: { vertical: 1 ,horizontal : 50 },
        floating: false,
        formatter: (val: string, opts: any) => {
          const i = opts.seriesIndex;
          const v = opts.w.config.series[i] as number;
          return `${val}: ${Number(v).toFixed(1)}%`;
        },

      },
      plotOptions: {
        radialBar: {
          dataLabels: {
            name: { show: false },
            value: {offsetY: 22,fontWeight: 600, show: true , formatter: (v: number) => `${Number(v).toFixed(1)}%`},

            total: {
              show: true,
              label: '',

              formatter: () => {
                const total = this.series.reduce((a, b) => a + b, 0);
                const avg = this.series.length ? (total / this.series.length).toFixed(1) : '0';
                return `${Number(avg).toFixed(1)}%`;
              }
            }
          },
          hollow: {

            size: '30%'
          },
          track: {
            background: '#cccccc',
            strokeWidth: '100%'
          }
        }
      },
      bar: {columnWidth: '100%',},
      stroke: {

        lineCap: 'round'  ,
        width: 2
      },
      labels: this.labels
    };

    this.chart = new ApexCharts(this.chartRef.nativeElement, options);
    this.chart.render();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.chart && (changes['series'] || changes['labels'] || changes['colors'])) {
      this.chart.updateOptions({
        series: this.series,
        labels: this.labels,
        colors: this.colors
      });
    }
  }
}
