import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';

@Component({
  selector: 'app-bar-chart-markers',
  imports: [],
  templateUrl: './bar-chart-markers.html',
  styleUrl: './bar-chart-markers.css',
})
export class BarChartMarkers implements AfterViewInit, OnDestroy ,OnChanges {
  @ViewChild('chartRef', {static: true}) chartRef!: ElementRef<HTMLDivElement>;

  @Input() series: number[] = [];
  @Input() categories: string[] = [];
  @Input() targets: number[] | null = null;

  @Input() markerIndices: number[] = [];

  private chart: any | null = null;
  private themeObserver: MutationObserver | null = null;

  /** Fallbacks when theme vars are missing or too light (ApexCharts doesn't resolve CSS variables). */
  private static readonly BAR_FALLBACK = '#00897B';
  private static readonly LINE_FALLBACK = '#00695C';

  /** Resolve theme colors from CSS variables so bar chart matches current theme. */
  private getChartColors(): [string, string] {
    if (typeof document === 'undefined') return [BarChartMarkers.BAR_FALLBACK, BarChartMarkers.LINE_FALLBACK];
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const barRaw = (style.getPropertyValue('--chart-bar-color').trim() || style.getPropertyValue('--color-accent2').trim()).trim();
    const lineRaw = (style.getPropertyValue('--chart-line-color').trim() || style.getPropertyValue('--color-accent1').trim()).trim();
    const barColor = this.resolveCssColor(barRaw, BarChartMarkers.BAR_FALLBACK);
    const lineColor = this.resolveCssColor(lineRaw, BarChartMarkers.LINE_FALLBACK);
    return [barColor, lineColor];
  }

  /** Theme text color and chart background for axis labels and chart.background. */
  private getThemeTextAndSurface(): { text: string; surface: string } {
    if (typeof document === 'undefined') return { text: '#333333', surface: 'transparent' };
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const textRaw = (style.getPropertyValue('--color-text').trim() || style.getPropertyValue('--color-on-surface').trim() || '#333333').trim();
    const surfaceRaw = (style.getPropertyValue('--color-surface').trim() || style.getPropertyValue('--color-background').trim() || '').trim();
    const text = this.resolveCssColor(textRaw, '#333333');
    const surface = surfaceRaw && surfaceRaw !== 'transparent' ? this.resolveCssColor(surfaceRaw, 'transparent') : 'transparent';
    return { text, surface: surface || 'transparent' };
  }

  private resolveCssColor(value: string, fallback: string): string {
    if (!value) return fallback;
    value = value.trim();
    let hex: string | null = null;
    if (/^#[0-9A-Fa-f]{3}$/.test(value)) {
      const r = value[1]! + value[1];
      const g = value[2]! + value[2];
      const b = value[3]! + value[3];
      hex = '#' + r + g + b;
    } else if (/^#[0-9A-Fa-f]{6,8}$/.test(value)) {
      hex = value.slice(0, 7);
    } else {
      const rgb = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (rgb) {
        const r = parseInt(rgb[1], 10);
        const g = parseInt(rgb[2], 10);
        const b = parseInt(rgb[3], 10);
        hex = '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
      }
    }
    if (hex && !this.isTooLight(hex)) return hex;
    return fallback;
  }

  /** Format category for x-axis: "2026-01" → "Jan"; "2026-02-07" → "7 Feb"; year "2025" stays. */
  private formatCategoryLabel(val: string): string {
    const dayMatch = val.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (dayMatch) {
      const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = parseInt(dayMatch[1], 10) - 1;
      const day = parseInt(dayMatch[2], 10);
      if (monthIdx >= 0 && monthIdx < 12) return `${day} ${shortMonths[monthIdx]}`;
    }
    const m = val.match(/^\d{4}-(\d{2})$/);
    if (m) {
      const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = parseInt(m[1], 10) - 1;
      return monthIdx >= 0 && monthIdx < 12 ? shortMonths[monthIdx]! : val;
    }
    return val.length > 10 ? val.slice(0, 10) + '…' : val;
  }

  /** Use fallback only for near-white so theme colors (red, teal, gold) are used. */
  private isTooLight(hex: string): boolean {
    const m = hex.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/);
    if (!m) return true;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.9;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.chart && (changes['series'] || changes['categories'] || changes['targets'] || changes['markerIndices'])) {
      this.updateChart();
    }
  }

  private async updateChart() {
    if (!this.chart) return;

    let targetSeries: number[] | null = null;

    if (this.targets?.length) {
      if (this.targets.length === this.series.length) {
        targetSeries = this.targets;
      } else if (this.targets.length === 1) {
        const t = this.targets[0]!;
        targetSeries = this.series.map(() => t);
      }
    }

    // Prepare Breach scatter points
    const breachPoints = this.markerIndices
      .filter(idx => idx >= 0 && idx < this.series.length)
      .map(idx => ({
        x: this.categories[idx],         // use numeric index, not category string
        y: this.series[idx],
        marker: {size: 5, fillColor: '#ff003b', strokeColor: '#e60000', radius: 3},
        label: {style: {color: '#fff', background: '#e60000', fontSize: '11px'}}
      }));

    const [barColor, lineColor] = this.getChartColors();
    const { text: themeText, surface: themeSurface } = this.getThemeTextAndSurface();
    const chartSeries = [
      { name: 'Actual', type: 'column', data: this.series, color: barColor },
      ...(targetSeries ? [{ name: 'Target', type: 'line', data: targetSeries, color: lineColor }] : [])
    ];

    await this.chart.updateOptions({
      chart: { background: themeSurface },
      series: chartSeries,
      colors: [barColor, lineColor],
      dataLabels: { enabled: false },
      yaxis: {
        forceNiceScale: true,
        tickAmount: 4,
        labels: {
          formatter: (val: string) => `${val}`,
          style: { colors: themeText, fontSize: '12px' }
        }
      },
      xaxis: {
        categories: this.categories,
        labels: {
          rotate: 0,
          rotateAlways: true,
          trim: false,
          formatter: (val: string) => this.formatCategoryLabel(val),
          hideOverlappingLabels: false,
          style: { colors: themeText, fontSize: '12px' }
        }
      },
      plotOptions: { bar: { horizontal: false, borderRadius: 4, columnWidth: '60%' } },
      annotations: { points: breachPoints },
      stroke: { width: [0, 3] },
      tooltip: { shared: true, intersect: false },
      legend: { show: false }
    }, false, true);

    await this.chart.updateSeries(chartSeries);
  }


  async ngAfterViewInit() {
    if (typeof window === 'undefined') return;

    const ApexCharts = (await import('apexcharts')).default;

    this.chart = new ApexCharts(this.chartRef.nativeElement, this.buildOptions());
    await this.chart.render();
    await this.updateChart();

    this.themeObserver = new MutationObserver(() => this.updateChart());
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  ngOnDestroy() {
    this.themeObserver?.disconnect();
    this.themeObserver = null;
    if (this.chart) this.chart.destroy();
  }

  private buildOptions() {
    // Prepare target series
    let targetSeries: number[] | null = null;
    if (this.targets && this.targets.length > 0) {
      if (this.targets.length === this.series.length) {
        targetSeries = this.targets;
      } else if (this.targets.length === 1) {
        const t = this.targets[0]!;
        targetSeries = this.series.map(() => t);
      }
    }

    // Breach scatter series
    // Breach annotations
    const breachPoints = this.markerIndices
      .filter(idx => idx >= 0 && idx < this.series.length)
      .map(idx => ({
        x: this.categories[idx],         // use numeric index, not category string
        y: this.series[idx],
        marker: {size: 5, fillColor: '#ff003b', strokeColor: '#e60000', radius: 3},
        label: {style: {color: '#fff', background: '#e60000', fontSize: '11px'}}
      }));

    const [barColor, lineColor] = this.getChartColors();
    const { text: themeText, surface: themeSurface } = this.getThemeTextAndSurface();
    const chartSeries = [
      { name: 'Actual', type: 'column', data: this.series, color: barColor },
      ...(targetSeries ? [{ name: 'Target', type: 'line', data: targetSeries, color: lineColor }] : [])
    ];

    return {
      chart: { type: 'bar', height: 210, toolbar: { show: false }, background: themeSurface },
      series: chartSeries,
      colors: [barColor, lineColor],
      dataLabels: { enabled: false },
      yaxis: {
        forceNiceScale: true,
        tickAmount: 4,
        labels: {
          formatter: (val: string) => `${val}`,
          style: { colors: themeText, fontSize: '12px' }
        }
      },
      xaxis: {
        categories: this.categories,
        labels: {
          rotate: 0,
          rotateAlways: true,
          trim: false,
          formatter: (val: string) => this.formatCategoryLabel(val),
          hideOverlappingLabels: false,
          style: { colors: themeText, fontSize: '12px' }
        }
      },
      plotOptions: { bar: { horizontal: false, borderRadius: 4, columnWidth: '60%' } },
      annotations: { points: breachPoints },
      stroke: { width: [0, 3] },
      tooltip: { shared: true, intersect: false },
      legend: { show: false }
    };
  }
}
