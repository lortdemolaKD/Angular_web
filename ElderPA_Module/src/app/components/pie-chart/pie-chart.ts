import { Component, AfterViewInit, ElementRef, ViewChild, Input, OnChanges, SimpleChanges } from '@angular/core';
import ApexCharts from 'apexcharts';

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

@Component({
  selector: 'app-pie-chart',
  standalone: true,
  templateUrl: './pie-chart.html',
  styleUrl: './pie-chart.css'
})
export class PieChart implements AfterViewInit, OnChanges {
  @ViewChild('chart', { static: true }) chartRef!: ElementRef;

  private chart: any;

  @Input() series: number[] = [];
  @Input() labels: string[] = [];
  /** Optional: for each segment, list of names to show in tooltip (e.g. staff names per role) */
  @Input() tooltipDetails: string[][] = [];
  @Input() colors_insert: string[] = [];
  @Input() type: string = '';
  @Input() position: string = '';
  @Input() size: any[] = [300,200];

  async ngAfterViewInit() {
    if (typeof window !== 'undefined') {
      const ApexCharts = (await import('apexcharts')).default;

      const colors = this.colors_insert.length ? this.colors_insert : [
        getComputedStyle(document.documentElement).getPropertyValue('--color-accent1')?.trim() || '#9a538e',
        getComputedStyle(document.documentElement).getPropertyValue('--color-accent2')?.trim() || '#00cec1',
        '#484748', '#939393', '#d40909'
      ];

      const options: any = {
        chart: { type: 'donut', height: this.size[0], width: this.size[1] },
        ['series']: this.series,
        ['labels']: this.labels,
        colors: colors,
        legend: { position: this.position,
          horizontalAlign: 'left',
          verticalAlign:'bottom',
          fontSize: '14px',
          show:false,
          markers: { width: 12, height: 12 },
          itemMargin: { vertical: 1 ,horizontal : 50 },
          floating: false,
          formatter: (val: string, opts: any) => ''
        },
        plotOptions: {
          pie: {
            donut: {
              size: '50%',
              background: 'transparent',
              labels: {
                show: true,
                name: { show: true },
                value: { show: true },
                total: {
                  show: true,
                  label: this.type === '%'?'Overall':'Total',
                  formatter: () => {
                    if (this.type === '%') {
                      const total = this.series.reduce((a, b) => a + b, 0);
                      return total ? total/this.series.length+'%' : '0%';
                    } else {
                      return this.series.reduce((a, b) => a + b, 0) + '';
                    }
                  }
                }
              }
            }
          }
        },
        tooltip: {
          custom: (opts: { seriesIndex: number; w: { config: { labels: string[] } } }) => {
            const idx = opts.seriesIndex;
            const label = opts.w.config.labels?.[idx] ?? '';
            const value = this.series[idx] ?? 0;
            const names = this.tooltipDetails?.[idx];
            if (names?.length) {
              const list = names.map((n) => `<span class="apex-tooltip-name">${escapeHtml(n)}</span>`).join('');
              return `<div class="apex-tooltip-title">${escapeHtml(label)}: ${value}</div><div class="apex-tooltip-names">${list}</div>`;
            }
            return `<div class="apex-tooltip-title">${escapeHtml(label)}: ${value}</div>`;
          }
        },
        responsive: [
          { breakpoint: 480, options: { chart: { width: 300 }, legend: { position: 'bottom' } } }
        ]
      };

      this.chart = new ApexCharts(this.chartRef.nativeElement, options);
      this.chart.render();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.chart && (changes['series'] || changes['labels'])) {
      this.chart.updateOptions({
        ['series']: this.series,
        ['labels']: this.labels
      });
    }
  }
}
