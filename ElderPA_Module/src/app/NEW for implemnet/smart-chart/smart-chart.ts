import { Component, Input, input, computed, signal, OnChanges, SimpleChanges, OnInit, Inject, HostBinding } from '@angular/core';
import { DOCUMENT, DecimalPipe, NgClass } from '@angular/common';

export type ChartType =
  | 'bar-vertical'       // basic vertical
  | 'bar-horizontal'     // basic horizontal
  | 'bar-grouped'
  | 'bar-stacked'
  | 'bar-stacked-100'
  | 'bar-grouped-stacked' // grouped + stacked (e.g. two stacked bars per category)
  | 'bar-diverging'      // negative values / diverging
  | 'bar-with-markers'   // bar with target marker
  | 'bar-reversed'       // reversed axis
  | 'mixed-bar-line'
  | 'mixed-overlay'      // e.g. target + current two bars
  | 'lollipop'
  | 'heatmap'
  | 'area-bar'
  | 'range-area'
  | 'timeline-range'
  | 'funnel'
  | 'waterfall'
  | 'slope'
  | 'radial-bar'             // basic: single arc, center label + value%
  | 'radial-bar-multiple'    // concentric full-circle arcs
  | 'radial-bar-custom-angle' // concentric arcs in custom angle range + legend
  | 'radial-bar-custom-angle-360'  // preset: full circle
  | 'radial-bar-custom-angle-270'
  | 'radial-bar-custom-angle-170'
  | 'radial-bar-custom-angle-100'
  | 'radial-bar-custom-angle-50'
  | 'pie'              // simple full pie
  | 'pie-donut'        // donut (hole in center), flat colors
  | 'pie-monochrome'   // full pie, shades of one color
  | 'pie-donut-gradient' // donut with gradient/shadow effect
  | 'scatter'
  | 'bubble'
  | 'boxplot'
  | 'treemap'
  | 'candlestick'
  | 'broken-scale-bar'
  | 'bar-3d'
  | 'slope-grouped'
  | 'gradient-bar';

export interface ChartDatum {
  label: string;
  value?: number;
  value2?: number;
  series?: string;
  /** For grouped-stacked: which group (e.g. year) this bar belongs to */
  group?: string;
  color?: string;
  target?: number;

  lineValue?: number; // for mixed bar+line
  start?: number;     // for timeline/range
  end?: number;       // for timeline/range

  // NEW for scatter/bubble/boxplot/candlestick
  x?: number;        // scatter x-coordinate
  y?: number;        // scatter y-coordinate
  r?: number;        // bubble radius
  q1?: number;       // boxplot Q1
  q3?: number;       // boxplot Q3
  median?: number;   // boxplot median
  min?: number;      // boxplot min
  max?: number;      // boxplot max
  open?: number;     // candlestick open
  high?: number;     // candlestick high
  low?: number;      // candlestick low
  close?: number;    // candlestick close
  /** Waterfall: true = full bar from baseline (start/subtotal/end), false/undefined = delta */
  isTotal?: boolean;
}

export interface ChartOptions {
  showAxis?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  showDataLabels?: boolean;
  height?: number;
  max?: number;
  min?: number;
  /** Bar orientation for types that support both */
  orientation?: 'vertical' | 'horizontal';
  /** Reversed axis (e.g. high to low on x) */
  reversed?: boolean;
  /** Basic slope: left/right X axis labels */
  slopeLeftLabel?: string;
  slopeRightLabel?: string;
  /** Radial custom angle: start/end in degrees (0 = 12 o'clock, clockwise) */
  startAngle?: number;
  endAngle?: number;
  /** Broken-scale bar: value at which Y-axis breaks (e.g. 140). Lower segment 0–scaleBreakAt, upper segment scaleBreakAt–max */
  scaleBreakAt?: number;
  /** Broken-scale: optional scale label (e.g. "Scale: 1 cm = 20 employees") */
  scaleLabel?: string;
  /** Radial custom angle (and similar): legend position */
  legendPosition?: 'left' | 'right' | 'top' | 'bottom';
  /** When true, chart wrapper uses height 100% so it grows with the parent (e.g. resizable widget). */
  useFillHeight?: boolean;
}

@Component({
  selector: 'app-smart-chart',
  standalone: true,
  templateUrl: './smart-chart.html',
  imports: [DecimalPipe, ],
  styleUrls: ['./smart-chart.css']
})
export class SmartChartComponent implements OnInit, OnChanges {
  constructor(@Inject(DOCUMENT) private doc: Document) {}

  /** Used in template so signal is read directly and CD tracks it */
  readonly typeSignal = signal<ChartType>('bar-vertical');

  /** Chart kind: bind as [chartType]="chartType" */
  @Input() chartType: ChartType = 'bar-vertical';

  get currentType(): ChartType {
    return this.typeSignal();
  }

  readonly data = input<ChartDatum[]>([]);
  readonly options = input<ChartOptions>({});
  @Input() seriesOrder: string[] = [];

  readonly internalHeight = signal(260);

  /** When useFillHeight is true, host fills parent so inner 100% height resolves (flex-based fill). */
  @HostBinding('style.height') get hostHeight(): string | null {
    return this.options().useFillHeight ? '100%' : null;
  }
  @HostBinding('style.min-height') get hostMinHeight(): string | null {
    return this.options().useFillHeight ? '0' : null;
  }
  @HostBinding('style.display') get hostDisplay(): string | null {
    return this.options().useFillHeight ? 'flex' : null;
  }
  @HostBinding('style.flex-direction') get hostFlexDirection(): string | null {
    return this.options().useFillHeight ? 'column' : null;
  }

  /** Bar/row index currently hovered (for tooltips). */
  readonly hoveredBarIndex = signal<number | null>(null);
  /** Segment index within row (for stacked/grouped bars). */
  readonly hoveredSegmentIndex = signal<number | null>(null);

  /** Cursor position for tooltip placement (viewport coordinates). */
  readonly tooltipPosition = signal({ x: 0, y: 0 });
  /** Offset in px from cursor so tooltip doesn't sit under the pointer (used in template). */
  readonly tooltipOffset = 12;

  updateTooltipPosition(event: MouseEvent): void {
    this.tooltipPosition.set({ x: event.clientX, y: event.clientY });
  }

  clearHover(): void {
    this.hoveredBarIndex.set(null);
    this.hoveredSegmentIndex.set(null);
  }

  /** Decode group index from encoded hoveredSegmentIndex (bar-grouped-stacked: gi * 100 + si). */
  getGroupedStackedGroupIndex(): number {
    const seg = this.hoveredSegmentIndex();
    return seg != null ? Math.floor(seg / 100) : 0;
  }

  /** Decode segment index from encoded hoveredSegmentIndex (bar-grouped-stacked: gi * 100 + si). */
  getGroupedStackedSegmentIndex(): number {
    const seg = this.hoveredSegmentIndex();
    return seg != null ? seg % 100 : 0;
  }

  ngOnInit(): void {
    this.typeSignal.set((this.chartType ?? 'bar-vertical') as ChartType);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chartType']) {
      this.typeSignal.set((this.chartType ?? 'bar-vertical') as ChartType);
    }
  }

  readonly normalizedData = computed(() => {
    const data = this.data();
    const type = this.typeSignal();
    const options = this.options();
    if (!data?.length) return [];

    if (type === 'bar-diverging') {
      const values = data.map(d => d.value ?? 0);
      const min = options.min ?? Math.min(...values, 0);
      const max = options.max ?? Math.max(...values, 0);
      return data.map(d => ({
        ...d,
        _value: d.value ?? 0,
        _min: min,
        _max: max
      }));
    }

    if (type === 'bar-stacked' || type === 'bar-stacked-100') {
      const grouped = new Map<string, ChartDatum[]>();
      for (const d of data) {
        const key = d.label;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(d);
      }
      const rowSums = Array.from(grouped.values()).map(items =>
        items.reduce((s, d) => s + (d.value ?? 0), 0)
      );
      const globalMax = type === 'bar-stacked-100'
        ? 1
        : (options.max ?? Math.max(...rowSums, 1));
      const result: any[] = [];
      grouped.forEach((items, label) => {
        const sum = items.reduce((s, d) => s + (d.value ?? 0), 0);
        const den = type === 'bar-stacked-100' ? (sum || 1) : globalMax;
        result.push({
          label,
          seriesItems: items.map(d => ({
            ...d,
            _ratio: (d.value ?? 0) / den
          }))
        });
      });
      return result;
    }

    if (type === 'heatmap') {
      const max = options.max ?? Math.max(...data.map(d => d.value ?? 0), 1);
      return data.map(d => ({
        ...d,
        _ratio: (d.value ?? 0) / max
      }));
    }

    // GROUPED / CLUSTERED BAR (group by label, separate series)
    if (type === 'bar-grouped') {
      const grouped = new Map<string, ChartDatum[]>();
      for (const d of data) {
        const key = d.label;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(d);
      }

      const max = options.max ?? Math.max(
        ...Array.from(grouped.values()).flatMap(items =>
          items.map(d => d.value ?? 0)
        ),
        1
      );

      const result: any[] = [];
      grouped.forEach((items, label) => {
        result.push({
          label,
          seriesItems: items.map(d => ({
            ...d,
            _ratio: (d.value ?? 0) / max
          }))
        });
      });
      return result;
    }

    // GROUPED STACKED (each category has multiple bars, each bar is stacked)
    if (type === 'bar-grouped-stacked') {
      const byLabel = new Map<string, ChartDatum[]>();
      for (const d of data) {
        const key = d.label;
        if (!byLabel.has(key)) byLabel.set(key, []);
        byLabel.get(key)!.push(d);
      }
      const allSums = data
        .reduce((acc, d) => {
          const k = `${d.label}-${d.group ?? ''}`;
          acc.set(k, (acc.get(k) ?? 0) + (d.value ?? 0));
          return acc;
        }, new Map<string, number>());
      const globalMax = options.max ?? Math.max(...Array.from(allSums.values()), 1);
      const result: any[] = [];
      byLabel.forEach((items, label) => {
        const byGroup = new Map<string, ChartDatum[]>();
        for (const d of items) {
          const g = d.group ?? 'default';
          if (!byGroup.has(g)) byGroup.set(g, []);
          byGroup.get(g)!.push(d);
        }
        const groupItems: any[] = [];
        byGroup.forEach((seriesItems, group) => {
          const sum = seriesItems.reduce((s, d) => s + (d.value ?? 0), 0);
          groupItems.push({
            group,
            sum,
            seriesItems: seriesItems.map(d => ({
              ...d,
              _ratio: (d.value ?? 0) / globalMax
            }))
          });
        });
        result.push({ label, groupItems });
      });
      return result;
    }

    // AREA BAR / RANGE AREA
    if (type === 'area-bar' || type === 'range-area') {
      const max = options.max ?? Math.max(
        ...data.map(d => Math.max(d.value ?? 0, d.value2 ?? 0)),
        1
      );
      return data.map(d => ({
        ...d,
        _ratio: (d.value ?? 0) / max,
        _ratio2: (d.value2 ?? 0) / max
      }));
    }

    // MIXED BAR + LINE
    if (type === 'mixed-bar-line') {
      const max = options.max ?? Math.max(
        ...data.map(d => Math.max(d.value ?? 0, d.lineValue ?? 0)),
        1
      );
      return data.map(d => ({
        ...d,
        _barRatio: (d.value ?? 0) / max,
        _lineRatio: (d.lineValue ?? 0) / max
      }));
    }

    // TIMELINE / RANGE BARS (start–end)
    if (type === 'timeline-range') {
      const allStarts = data.map(d => d.start ?? 0);
      const allEnds = data.map(d => d.end ?? 0);
      const min = options.min ?? Math.min(...allStarts, ...allEnds, 0);
      const max = options.max ?? Math.max(...allStarts, ...allEnds, 1);
      const span = max - min || 1;

      return data.map(d => {
        const s = d.start ?? 0;
        const e = d.end ?? 0;
        const from = (s - min) / span;
        const to = (e - min) / span;
        return {
          ...d,
          _from: from,
          _to: to
        };
      });
    }

    // FUNNEL (value ratio for width and height)
    if (type === 'funnel') {
      const max = options.max ?? Math.max(...data.map(d => d.value ?? 0), 1);
      return data.map(d => ({
        ...d,
        _ratio: (d.value ?? 0) / max
      }));
    }

    // WATERFALL (totals = full bar from 0, deltas = bar from previous cumulative; scale = max cumulative + 20)
    if (type === 'waterfall') {
      let running = 0;
      const items: any[] = [];
      for (const d of data) {
        const val = d.value ?? 0;
        if (d.isTotal) {
          items.push({
            ...d,
            _start: 0,
            _end: val,
            _cumulative: val
          });
          running = val;
        } else {
          const start = running;
          running += val;
          items.push({
            ...d,
            _start: start,
            _end: running,
            _cumulative: running
          });
        }
      }
      const rawMax = Math.max(0, ...items.map(x => x._start), ...items.map(x => x._end), 1);
      const scaleMax = options.max ?? (rawMax + 20);
      const min = options.min ?? Math.min(0, ...items.map(x => x._start), ...items.map(x => x._end));
      const span = scaleMax - min || 1;

      return items.map(d => ({
        ...d,
        _from: (d._start - min) / span,
        _to: (d._end - min) / span
      }));
    }

    // SLOPE (two points: value at left, value2 at right)
    if (type === 'slope') {
      const max = options.max ?? Math.max(
        ...data.map(d => Math.max(d.value ?? 0, d.value2 ?? 0)),
        1
      );
      return data.map(d => ({
        ...d,
        _left: (d.value ?? 0) / max,
        _right: (d.value2 ?? 0) / max
      }));
    }

    // RADIAL BAR (basic / multiple / custom-angle): value as 0–max, _ratio = value/max
    if (type === 'radial-bar' || type === 'radial-bar-multiple' || this.isRadialCustomAngle(type)) {
      const max = options.max ?? 100;
      return data.map(d => ({
        ...d,
        _ratio: Math.min(1, Math.max(0, (d.value ?? 0) / max))
      }));
    }

    // PIE variants: sum-based _start/_end
    if (type === 'pie' || type === 'pie-donut' || type === 'pie-monochrome' || type === 'pie-donut-gradient') {
      const sum = data.reduce((s, d) => s + (d.value ?? 0), 0) || 1;
      let acc = 0;
      return data.map(d => {
        const v = d.value ?? 0;
        const start = acc / sum;
        const end = (acc + v) / sum;
        acc += v;
        return {
          ...d,
          _start: start,
          _end: end,
          _ratio: v / sum
        };
      });
    }

    // SCATTER / BUBBLE
    if (type === 'scatter' || type === 'bubble') {
      const xs = data.map(d => d.x ?? 0);
      const ys = data.map(d => d.y ?? 0);
      const rs = data.map(d => d.r ?? 1);
      const xMin = options.min ?? Math.min(...xs, 0);
      const xMax = options.max ?? Math.max(...xs, 1);
      const yMax = Math.max(...ys, 1);
      const rMax = Math.max(...rs, 1);

      return data.map(d => ({
        ...d,
        _x: ((d.x ?? 0) - xMin) / (xMax - xMin || 1),
        _y: (d.y ?? 0) / yMax,
        _r: (d.r ?? 1) / rMax
      }));
    }

    // BOXPLOT (vertical boxes; scale = data range + padding)
    if (type === 'boxplot') {
      const allMins = data.map(d => d.min ?? 0);
      const allMaxs = data.map(d => d.max ?? 0);
      const dataMin = Math.min(...allMins);
      const dataMax = Math.max(...allMaxs);
      const min = options.min ?? Math.max(0, dataMin - 10);
      const max = options.max ?? dataMax + 20;
      const span = max - min || 1;

      return data.map(d => ({
        ...d,
        _min: ((d.min ?? 0) - min) / span,
        _q1: ((d.q1 ?? 0) - min) / span,
        _median: ((d.median ?? 0) - min) / span,
        _q3: ((d.q3 ?? 0) - min) / span,
        _max: ((d.max ?? 0) - min) / span
      }));
    }

    // TREEMAP (simple hierarchical grid)
    if (type === 'treemap') {
      const sum = data.reduce((s, d) => s + (d.value ?? 0), 0) || 1;
      return data.map(d => ({
        ...d,
        _size: (d.value ?? 0) / sum
      }));
    }

    // CANDLESTICK
    if (type === 'candlestick') {
      const allOpens = data.map(d => d.open ?? 0);
      const allHighs = data.map(d => d.high ?? 0);
      const allLows = data.map(d => d.low ?? 0);
      const allCloses = data.map(d => d.close ?? 0);
      const min = options.min ?? Math.min(...allLows, ...allOpens, ...allCloses, 0);
      const max = options.max ?? Math.max(...allHighs, ...allOpens, ...allCloses, 1);
      const span = max - min || 1;

      return data.map(d => ({
        ...d,
        _open: ((d.open ?? 0) - min) / span,
        _close: ((d.close ?? 0) - min) / span,
        _high: Math.min(((d.high ?? 0) - min) / span, 1),
        _low: Math.max(((d.low ?? 0) - min) / span, 0)
      }));
    }

    // BROKEN SCALE BAR: two segments (0–scaleBreakAt, then scaleBreakAt–max) so large and small values both visible
    if (type === 'broken-scale-bar') {
      const values = data.map(d => Math.abs(d.value ?? 0));
      const dataMax = Math.max(...values, 1);
      const breakAt = options.scaleBreakAt ?? Math.min(150, dataMax * 0.15);
      const maxUpper = options.max ?? dataMax;
      const lowerSpan = breakAt;
      const upperSpan = Math.max(maxUpper - breakAt, 1);
      // Allocate height: lower segment ~70%, break ~4%, upper ~26%
      const lowerH = 70;
      const breakH = 4;
      const upperH = 26;
      return data.map(d => {
        const v = Math.abs(d.value ?? 0);
        const isNegative = (d.value ?? 0) < 0;
        let _barBottomPct: number;
        let _barHeightPct: number;
        let _segment: 'lower' | 'upper';
        if (v <= breakAt) {
          _segment = 'lower';
          _barBottomPct = 0;
          _barHeightPct = lowerH * (v / lowerSpan);
        } else {
          _segment = 'upper';
          _barBottomPct = lowerH + breakH;
          _barHeightPct = upperH * ((v - breakAt) / upperSpan);
        }
        const _barLowerHeightPct = _segment === 'upper' ? lowerH : 0; // full bar from 0: lower part height for above-break bars
        return {
          ...d,
          _ratio: v / maxUpper,
          _isNegative: isNegative,
          _segment,
          _barBottomPct,
          _barHeightPct,
          _barLowerHeightPct
        };
      });
    }

    // 3D BAR (group = depth e.g. year, label = category e.g. region; two categorical axes)
    if (type === 'bar-3d') {
      const max = options.max ?? Math.max(...data.map(d => d.value ?? 0), 1);
      return data.map(d => ({
        ...d,
        _ratio: (d.value ?? 0) / max
      }));
    }

    // SLOPE-GROUPED: multi-category slope (data: { label: category, series, value } per cell)
    if (type === 'slope-grouped') {
      const categories: string[] = [];
      const catSet = new Set<string>();
      for (const d of data) {
        const c = d.label;
        if (!catSet.has(c)) { catSet.add(c); categories.push(c); }
      }
      const seriesNames: string[] = [];
      const seriesSet = new Set<string>();
      for (const d of data) {
        const s = d.series ?? d.label;
        if (!seriesSet.has(s)) { seriesSet.add(s); seriesNames.push(s); }
      }
      const allValues = data.map(d => d.value ?? 0);
      const max = options.max ?? Math.max(...allValues, 1);
      const seriesLines: { series: string; points: { x: number; y: number }[] }[] = [];
      for (const series of seriesNames) {
        const points = categories.map((cat, xi) => {
          const datum = data.find(d => d.label === cat && (d.series ?? d.label) === series);
          const val = datum?.value ?? 0;
          return { x: categories.length <= 1 ? 0 : xi / (categories.length - 1), y: val / max };
        });
        seriesLines.push({ series, points });
      }
      return [{ categories, seriesLines }];
    }

    // MIXED OVERLAY (bar + area)
    if (type === 'mixed-overlay') {
      const max = options.max ?? Math.max(
        ...data.map(d => Math.max(d.value ?? 0, d.value2 ?? 0)),
        1
      );
      return data.map(d => ({
        ...d,
        _bar: (d.value ?? 0) / max,
        _area: (d.value2 ?? 0) / max
      }));
    }

    // GRADIENT BAR (color variants)
    if (type === 'gradient-bar') {
      const max = options.max ?? Math.max(...data.map(d => d.value ?? 0), 1);
      return data.map(d => ({
        ...d,
        _ratio: (d.value ?? 0) / max
      }));
    }

    const max = options.max ?? Math.max(...data.map(d => Math.abs(d.value ?? 0)), 1);
    return data.map(d => ({
      ...d,
      _ratio: (d.value ?? 0) / max
    }));
  });

  get chartHeight(): string {
    const opts = this.options();
    if (opts.useFillHeight) return '100%';
    return `${opts.height ?? this.internalHeight()}px`;
  }

  /** Min height when useFillHeight is true (so chart doesn't collapse). */
  get chartMinHeight(): string {
    const opts = this.options();
    if (!opts.useFillHeight) return '';
    return `${opts.height ?? 200}px`;
  }

  getChartClass(): string {
    return `chart chart--${this.currentType}`;
  }

  /** True for radial-bar-custom-angle and preset variants (e.g. radial-bar-custom-angle-270). */
  isRadialCustomAngle(type: ChartType): boolean {
    return type === 'radial-bar-custom-angle' || type.startsWith('radial-bar-custom-angle-');
  }

  /** Default palette when CSS variables are not set (e.g. no theme). */
  private static readonly MONO_PALETTE_FALLBACK = [
    'hsl(210, 70%, 32%)',
    'hsl(210, 70%, 42%)',
    'hsl(210, 70%, 52%)',
    'hsl(210, 70%, 60%)',
    'hsl(210, 70%, 68%)',
    'hsl(210, 70%, 76%)',
  ];

  /** Read theme-based monochrome palette from CSS variables (--chart-mono-1 … --chart-mono-6). */
  private getMonoPalette(): string[] {
    const el = this.doc.documentElement;
    const style = el && typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
    if (!style) return SmartChartComponent.MONO_PALETTE_FALLBACK;
    const out: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const v = style.getPropertyValue(`--chart-mono-${i}`).trim();
      if (!v) return SmartChartComponent.MONO_PALETTE_FALLBACK;
      out.push(v);
    }
    return out;
  }

  getBarColor(d: ChartDatum, index: number): string {
    if (d.color) return d.color;
    const palette = this.getMonoPalette();
    return palette[index % palette.length];
  }

  /** Gradient bar: linear gradient from base color (bottom) to lighter (top). */
  getGradientBarBackground(d: ChartDatum, index: number): string {
    const base = this.getBarColor(d, index);
    return `linear-gradient(to top, ${base}, color-mix(in srgb, ${base} 65%, white))`;
  }

  getSeriesColor(series: string, seriesIndex: number): string {
    const palette = this.getMonoPalette();
    return palette[seriesIndex % palette.length];
  }

  /** First (darkest) monochrome shade for labels/accents. */
  getMonoAccentColor(): string {
    return this.getMonoPalette()[0];
  }

  /** Candlestick fill: monochrome darker (down) / lighter (up). */
  getCandleFill(isUp: boolean): string {
    const palette = this.getMonoPalette();
    return isUp ? palette[3] : palette[0];
  }

  /** Conic gradient stops for pie/radial (0–1 _start/_end as degrees) */
  getConicGradientStops(): string {
    const data = this.normalizedData();
    const type = this.typeSignal();
    return data
      .map((seg, i) => `${this.getPieSegmentColor(seg, i, type)} ${(seg._start ?? 0) * 360}deg ${(seg._end ?? 0) * 360}deg`)
      .join(', ');
  }

  /** Segment color: default palette for pie/donut, monochrome blue shades for pie-monochrome */
  /** Comma-separated "label: value" for pie/donut native title. */
  getPieChartTitle(): string {
    return (this.data() ?? []).map(d => `${d.label}: ${d.value ?? 0}`).join(', ');
  }

  getPieSegmentColor(seg: ChartDatum, index: number, type: ChartType): string {
    if (type === 'pie-monochrome') {
      const palette = this.getMonoPalette();
      const n = this.normalizedData().length;
      const t = n <= 1 ? 0 : index / (n - 1);
      const i = Math.min(palette.length - 1, Math.round(t * (palette.length - 1)));
      return palette[i];
    }
    return this.getBarColor(seg, index);
  }

  /** Conic stops for basic radial: single arc 0..ratio (color), ratio..1 (grey) */
  getRadialBasicStops(): string {
    const data = this.normalizedData();
    const ratio = data[0]?._ratio ?? 0;
    const color = data[0] ? this.getBarColor(data[0], 0) : this.getMonoPalette()[0];
    const deg = ratio * 360;
    return `${color} 0deg ${deg}deg, #e5e7eb ${deg}deg 360deg`;
  }

  /** Theme monochrome color for radial ring by index (used so radial/custom-angle are always monochromatic). */
  getRadialRingColor(index: number): string {
    const palette = this.getMonoPalette();
    return palette[index % palette.length];
  }

  /** Conic stops for one radial ring. _ratio 0–1: filled then grey. maxDegrees: when set (custom-angle), fill is ratio of that span, not full circle. */
  getRadialRingStops(seg: ChartDatum & { _ratio?: number }, index: number, maxDegrees?: number): string {
    const ratio = seg._ratio ?? 0;
    const color = this.getRadialRingColor(index);
    const deg = maxDegrees != null ? ratio * maxDegrees : ratio * 360;
    return `${color} 0deg ${deg}deg, #e5e7eb ${deg}deg 360deg`;
  }

  /** Sector span in degrees for custom-angle (so value% fills that much of the sector). */
  getRadialCustomAngleSpan(): number {
    const start = this.options().startAngle ?? 0;
    const end = this.options().endAngle ?? 360;
    return end >= start ? end - start : 360 - start + end;
  }

  /** Radial custom angle: flex direction for legend + chart container (row = left/right, column = top/bottom). */
  getRadialLegendFlexDirection(): 'row' | 'column' {
    const pos = this.options().legendPosition ?? 'left';
    return pos === 'left' || pos === 'right' ? 'row' : 'column';
  }

  /** Radial custom angle: CSS order for the legend block (0 = first, 1 = second). */
  getRadialLegendOrder(): number {
    const pos = this.options().legendPosition ?? 'left';
    return pos === 'left' || pos === 'top' ? 0 : 1;
  }

  /** Radial custom angle: CSS order for the chart block. */
  getRadialChartOrder(): number {
    const pos = this.options().legendPosition ?? 'left';
    return pos === 'left' || pos === 'top' ? 1 : 0;
  }

  /** Radial multiple/custom-angle: ring wrapper inset (%), so each ring is a true annulus from outer to inner edge. */
  getRadialRingWrapperInset(i: number): number {
    const n = this.normalizedData().length;
    if (n <= 0) return 0;
    const ringWidth = 50 / (n + 1); // radius units; center hole = ringWidth
    return i * ringWidth;
  }

  /** Inner hole of ring i as % of wrapper (so the visible part is the ring only). */
  getRadialRingHoleInset(i: number): number {
    const n = this.normalizedData().length;
    if (n <= 0) return 0;
    const ringWidth = 50 / (n + 1);
    const outerR = 50 - i * ringWidth;
    const innerR = 50 - (i + 1) * ringWidth;
    if (outerR <= 0) return 0;
    return 50 * (1 - innerR / outerR);
  }

  /** Center empty circle inset (%) for radial multiple / custom-angle. */
  getRadialCenterInset(): number {
    const n = this.normalizedData().length;
    if (n <= 0) return 45;
    const ringWidth = 50 / (n + 1);
    return 50 - ringWidth;
  }

  /** Clip-path for custom-angle sector. 0° = top, clockwise. Sector from startAngle to endAngle so arc starts at startAngle. */
  getRadialCustomAngleClipPath(): string {
    const start = this.options().startAngle ?? 0;
    const end = this.options().endAngle ?? 360;
    const span = end >= start ? end - start : 360 - start + end;
    const stepDeg = 5;
    const steps = Math.max(2, Math.ceil(span / stepDeg));
    const points: string[] = ['50% 50%'];
    for (let i = 0; i <= steps; i++) {
      const deg = start + (i / steps) * span;
      const rad = (deg * Math.PI) / 180;
      const x = 50 + 50 * Math.sin(rad);
      const y = 50 - 50 * Math.cos(rad);
      points.push(`${x}% ${y}%`);
    }
    return `polygon(${points.join(', ')})`;
  }

  /** Rotation in deg so ring 0 is at options.startAngle (for custom-angle radial). */
  getRadialCustomAngleRotation(): number {
    return -(this.options().startAngle ?? 0);
  }

  /** 3D bar: unique groups (e.g. years) in order of first appearance (depth axis). No group = single group ''. */
  getBar3dGroups(): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of this.data()) {
      const g = (d as ChartDatum & { group?: string }).group ?? '';
      if (!seen.has(g)) { seen.add(g); out.push(g); }
    }
    return out.length ? out : [''];
  }

  /** 3D bar: unique categories (e.g. regions) in order of first appearance (width axis). */
  getBar3dCategories(): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of this.data()) {
      const c = d.label ?? '';
      if (c && !seen.has(c)) { seen.add(c); out.push(c); }
    }
    return out;
  }

  /** 3D bar: cell value for (group, category). Returns { value, _ratio } or null. */
  getBar3dBar(group: string, category: string): { value: number; _ratio: number } | null {
    const d = this.normalizedData().find(
      (x) => ((x as ChartDatum & { group?: string }).group ?? '') === group && x.label === category
    );
    if (!d) return null;
    return { value: d.value ?? 0, _ratio: d._ratio ?? 0 };
  }

  /** 3D bar: color by group index (theme monochrome shades). */
  getBar3dGroupColor(groupIndex: number): string {
    const palette = this.getMonoPalette();
    return palette[groupIndex % palette.length];
  }

  /** 3D bar: max value for Y-axis. */
  getBar3dMax(): number {
    const type = this.typeSignal();
    if (type !== 'bar-3d') return 100;
    const data = this.data();
    const max = this.options().max ?? Math.max(...data.map(d => d.value ?? 0), 1);
    return max;
  }

  /** Unique series names for stacked/grouped legend (from raw data) */
  getStackedLegendSeries(): { series: string; color: string }[] {
    const data = this.data();
    const seen = new Set<string>();
    const out: { series: string; color: string }[] = [];
    let idx = 0;
    for (const d of data) {
      const s = d.series ?? '';
      if (s && !seen.has(s)) {
        seen.add(s);
        out.push({ series: s, color: this.getSeriesColor(s, idx++) });
      }
    }
    return out;
  }

  /** Max value for axis scale (bar charts). For stacked, returns max of row sums. */
  getBarAxisMax(): number {
    const opts = this.options();
    const type = this.typeSignal();
    const data = this.data();
    if (opts.max != null) return opts.max;
    if (type === 'bar-stacked') {
      const byLabel = new Map<string, number>();
      for (const d of data) {
        const key = d.label;
        byLabel.set(key, (byLabel.get(key) ?? 0) + (d.value ?? 0));
      }
      return Math.max(...byLabel.values(), 1);
    }
    if (type === 'mixed-bar-line') {
      return Math.max(...data.map(d => Math.max(d.value ?? 0, d.lineValue ?? 0)), 1);
    }
    if (type === 'mixed-overlay' || type === 'area-bar' || type === 'range-area') {
      return Math.max(...data.map(d => Math.max(d.value ?? 0, d.value2 ?? 0)), 1);
    }
    if (type === 'slope') {
      return Math.max(...data.map(d => Math.max(d.value ?? 0, d.value2 ?? 0)), 1);
    }
    if (type === 'slope-grouped') {
      return Math.max(...data.map(d => d.value ?? 0), 1);
    }
    if (type === 'waterfall') {
      let running = 0;
      let maxVal = 0;
      for (const d of data) {
        const val = d.value ?? 0;
        if (d.isTotal) {
          running = val;
          maxVal = Math.max(maxVal, val);
        } else {
          running += val;
          maxVal = Math.max(maxVal, running);
        }
      }
      return opts.max ?? Math.max(maxVal + 20, maxVal, 1);
    }
    return Math.max(...data.map(d => d.value ?? 0), 1);
  }

  /** Boxplot Y-axis min. */
  getBoxplotAxisMin(): number {
    const opts = this.options();
    const data = this.data();
    const dataMin = data.length ? Math.min(...data.map(d => d.min ?? 0)) : 0;
    return opts.min ?? Math.max(0, dataMin - 10);
  }

  /** Boxplot Y-axis max. */
  getBoxplotAxisMax(): number {
    const opts = this.options();
    const data = this.data();
    const dataMax = data.length ? Math.max(...data.map(d => d.max ?? 0)) : 1;
    return opts.max ?? dataMax + 20;
  }

  /** Boxplot Y-axis ticks (4–5 values from min to max). */
  getBoxplotAxisTicks(): number[] {
    const min = this.getBoxplotAxisMin();
    const max = this.getBoxplotAxisMax();
    if (min >= max) return [min];
    const n = 5;
    const ticks: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = i === 0 ? min : i === n - 1 ? max : Math.round(min + (max - min) * i / (n - 1));
      if (i === 0 || t > ticks[ticks.length - 1]) ticks.push(t);
    }
    return ticks.length >= 2 ? ticks : [min, max];
  }

  /** Broken-scale: value at which axis breaks (top of lower segment). */
  getBrokenScaleBreakAt(): number {
    const opts = this.options();
    const data = this.data();
    const dataMax = data.length ? Math.max(...data.map(d => Math.abs(d.value ?? 0)), 1) : 1;
    return opts.scaleBreakAt ?? Math.min(150, dataMax * 0.15);
  }

  /** Broken-scale: max value (top of upper segment). */
  getBrokenScaleMaxUpper(): number {
    const opts = this.options();
    const data = this.data();
    const dataMax = data.length ? Math.max(...data.map(d => Math.abs(d.value ?? 0)), 1) : 1;
    return opts.max ?? dataMax;
  }

  /** Broken-scale: lower segment height %, break %, upper %. Must match normalization. */
  getBrokenScaleLowerPct(): number { return 70; }
  getBrokenScaleBreakPct(): number { return 4; }
  getBrokenScaleUpperPct(): number { return 26; }

  /** Broken-scale: tick values for lower segment (0 to breakAt). */
  getBrokenScaleLowerTicks(): number[] {
    const breakAt = this.getBrokenScaleBreakAt();
    const step = breakAt <= 50 ? 10 : breakAt <= 200 ? 20 : 50;
    const ticks: number[] = [];
    for (let t = 0; t <= breakAt; t += step) ticks.push(t);
    if (ticks[ticks.length - 1] !== breakAt) ticks.push(breakAt);
    return ticks;
  }

  /** Broken-scale: tick value(s) for upper segment (top of axis only, to avoid duplicating break value). */
  getBrokenScaleUpperTicks(): number[] {
    const breakAt = this.getBrokenScaleBreakAt();
    const maxU = this.getBrokenScaleMaxUpper();
    if (maxU <= breakAt) return [];
    return [maxU];
  }

  /** Boxplot: 0–100 position for a Y value (for axis tick placement). */
  getBoxplotTickPosition(value: number): number {
    const min = this.getBoxplotAxisMin();
    const max = this.getBoxplotAxisMax();
    const span = max - min || 1;
    return ((value - min) / span) * 100;
  }

  /** 4–5 tick values from 0 to max for axis labels (bar charts). */
  getBarAxisTicks(max?: number): number[] {
    const cap = max ?? this.getBarAxisMax();
    if (cap <= 0) return [0];
    const n = 5;
    const ticks: number[] = [];
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? cap : Math.round((cap * i) / (n - 1));
      if (i === 0 || v > ticks[ticks.length - 1]) ticks.push(v);
    }
    return ticks.length >= 2 ? ticks : [0, cap];
  }

  /** 4–5 ticks for percentage axis (0–100). */
  getBarAxisTicksPercent(): number[] {
    return [0, 25, 50, 75, 100];
  }

  /** Min value for diverging bar axis. */
  getDivergingAxisMin(): number {
    const opts = this.options();
    const data = this.data();
    if (opts.min != null) return opts.min;
    const values = data.map(d => d.value ?? 0);
    return Math.min(...values, 0);
  }

  /** Max value for diverging bar axis. */
  getDivergingAxisMax(): number {
    const opts = this.options();
    const data = this.data();
    if (opts.max != null) return opts.max;
    const values = data.map(d => d.value ?? 0);
    return Math.max(...values, 0);
  }

  /** 4–5 tick values from min to max for diverging axis (includes 0 when in range). */
  getDivergingAxisTicks(): number[] {
    const min = this.getDivergingAxisMin();
    const max = this.getDivergingAxisMax();
    if (min === max) return [min];
    const n = 5;
    const ticks: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = i === 0 ? min : i === n - 1 ? max : Math.round((min + (max - min) * i / (n - 1)) * 10) / 10;
      if (i === 0 || t > ticks[ticks.length - 1]) ticks.push(t);
    }
    return ticks.length >= 2 ? ticks : [min, max];
  }

  getPercentLabel(ratio: number): string {
    return (ratio * 100).toFixed(0) + '%';
  }

  getCandleBodyHeight(d: { _open?: number; _close?: number }): number {
    const open = d._open ?? 0;
    const close = d._close ?? 0;
    return Math.min(100, Math.abs(close - open) * 100);
  }

  /** Heatmap cell color: theme monochrome (light = low, dark = high). */
  getHeatmapColor(ratio: number): string {
    const palette = this.getMonoPalette();
    const i = 5 - Math.min(5, Math.round(ratio * 5)); // ratio 0 → index 5 (light), ratio 1 → index 0 (dark)
    return palette[i] ?? palette[0];
  }

  getHeatmapLabelCell(label: string): string {
    return label.split('-')[0];
  }

  getHeatmapHourLabel(label: string): string {
    return label.split('-')[1];
  }

  /** Unique row labels (Y axis) for heatmap, in order of first appearance. */
  getHeatmapRowLabels(): string[] {
    const data = this.data();
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of data) {
      const r = this.getHeatmapLabelCell(d.label);
      if (!seen.has(r)) { seen.add(r); out.push(r); }
    }
    return out;
  }

  /** Unique column labels (X axis) for heatmap, in order of first appearance. */
  getHeatmapColLabels(): string[] {
    const data = this.data();
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of data) {
      const c = this.getHeatmapHourLabel(d.label);
      if (!seen.has(c)) { seen.add(c); out.push(c); }
    }
    return out;
  }

  /** Get heatmap cell datum by row and column label. */
  getHeatmapCell(row: string, col: string): ChartDatum & { _ratio?: number } | null {
    const label = row + '-' + col;
    return this.normalizedData().find(d => d.label === label) ?? null;
  }

  /** Timeline range: min value for X axis. */
  getTimelineRangeMin(): number {
    const opts = this.options();
    const data = this.data();
    if (opts.min != null) return opts.min;
    const starts = data.map(d => d.start ?? 0);
    const ends = data.map(d => d.end ?? 0);
    return Math.min(...starts, ...ends, 0);
  }

  /** Timeline range: max value for X axis. */
  getTimelineRangeMax(): number {
    const opts = this.options();
    const data = this.data();
    if (opts.max != null) return opts.max;
    const starts = data.map(d => d.start ?? 0);
    const ends = data.map(d => d.end ?? 0);
    return Math.max(...starts, ...ends, 1);
  }

  /** Timeline range: 4–5 tick values for X axis. */
  /** Waterfall: bar bottom as 0–1 (for positioning). */
  getWaterfallBarBottom(d: { _from?: number; _to?: number }): number {
    const from = d._from ?? 0;
    const to = d._to ?? 0;
    return Math.min(from, to);
  }

  /** Waterfall: bar height as 0–1. */
  getWaterfallBarHeight(d: { _from?: number; _to?: number }): number {
    const from = d._from ?? 0;
    const to = d._to ?? 0;
    return Math.abs(to - from);
  }

  /** Waterfall: format cumulative/value for display. */
  formatWaterfallValue(n: number | undefined): string {
    if (n == null) return '';
    return Number(n).toFixed(2);
  }

  /** Slope-grouped: polyline points string for SVG (x, 1-y in 0–100). */
  getSlopeGroupedPolylinePoints(line: { points: { x: number; y: number }[] }): string {
    if (!line?.points?.length) return '';
    return line.points
      .map(p => `${p.x * 100},${(1 - p.y) * 100}`)
      .join(' ');
  }

  /** Slope-grouped: first normalized block (categories + seriesLines). */
  getSlopeGroupedBlock(): { categories: string[]; seriesLines: { series: string; points: { x: number; y: number }[] }[] } | null {
    const arr = this.normalizedData();
    const first = arr?.[0];
    return first && 'categories' in first && 'seriesLines' in first ? first as any : null;
  }

  getTimelineRangeTicks(): number[] {
    const min = this.getTimelineRangeMin();
    const max = this.getTimelineRangeMax();
    if (min === max) return [min];
    const n = 5;
    const ticks: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = i === 0 ? min : i === n - 1 ? max : Math.round((min + (max - min) * i / (n - 1)) * 10) / 10;
      if (i === 0 || t > ticks[ticks.length - 1]) ticks.push(t);
    }
    return ticks.length >= 2 ? ticks : [min, max];
  }

  /** Current tooltip content for the single cursor-following tooltip (avoids transform/positioning bugs). */
  getTooltipContent(): { label: string; value: string } | null {
    const i = this.hoveredBarIndex();
    const si = this.hoveredSegmentIndex();
    if (i == null) return null;
    const type = this.typeSignal();
    const data = this.normalizedData();
    const rawData = this.data();

    if (type === 'bar-stacked' || type === 'bar-grouped') {
      const g = data[i] as { label: string; seriesItems?: { series?: string; value?: number; _ratio?: number }[] };
      const seg = g?.seriesItems?.[si ?? 0];
      if (!seg) return null;
      return { label: `${g?.label ?? ''} · ${seg.series ?? ''}`, value: String(seg.value ?? 0) };
    }
    if (type === 'bar-stacked-100') {
      const g = data[i] as { label: string; seriesItems?: { series?: string; _ratio?: number }[] };
      const seg = g?.seriesItems?.[si ?? 0];
      if (!seg) return null;
      return { label: `${g?.label ?? ''} · ${seg.series ?? ''}`, value: this.getPercentLabel(seg._ratio ?? 0) };
    }
    if (type === 'bar-grouped-stacked') {
      const row = data[i] as { label: string; groupItems?: { group: string; seriesItems: { series?: string; value?: number }[] }[] };
      const gi = this.getGroupedStackedGroupIndex();
      const segIdx = this.getGroupedStackedSegmentIndex();
      const grp = row?.groupItems?.[gi];
      const seg = grp?.seriesItems?.[segIdx];
      if (!seg) return null;
      return {
        label: `${row?.label ?? ''} · ${grp?.group ?? ''} · ${seg.series ?? ''}`,
        value: String(seg.value ?? 0)
      };
    }
    if (type === 'heatmap') {
      const rows = this.getHeatmapRowLabels();
      const cols = this.getHeatmapColLabels();
      const ri = i;
      const ci = si ?? 0;
      const row = rows[ri];
      const col = cols[ci];
      const cell = this.getHeatmapCell(row ?? '', col ?? '');
      return {
        label: `${row ?? ''} · ${col ?? ''}`,
        value: String(cell?.value ?? 0)
      };
    }
    if (type === 'bar-3d') {
      const groups = this.getBar3dGroups();
      const cats = this.getBar3dCategories();
      const gi = i;
      const ci = si ?? 0;
      const g = groups[gi];
      const c = cats[ci];
      const bar = this.getBar3dBar(g ?? '', c ?? '');
      return { label: `${g ?? ''} · ${c ?? ''}`, value: String(bar?.value ?? 0) };
    }
    if (type === 'slope-grouped') {
      const block = this.getSlopeGroupedBlock();
      const line = block?.seriesLines?.[i];
      const pi = si ?? 0;
      const cat = block?.categories?.[pi];
      const p = line?.points?.[pi];
      const max = this.getBarAxisMax();
      const val = p != null ? (p.y * max).toFixed(2) : '';
      return { label: `${line?.series ?? ''} · ${cat ?? ''}`, value: val };
    }

    const d = data[i] as ChartDatum & { _value?: number; _ratio?: number; value2?: number; lineValue?: number; start?: number; end?: number; min?: number; max?: number; q1?: number; q3?: number; median?: number; open?: number; high?: number; low?: number; close?: number; _cumulative?: number; isTotal?: boolean; x?: number; y?: number; r?: number };
    if (!d) return null;
    const label = d.label ?? '';
    let value = '';
    switch (type) {
      case 'bar-diverging':
        value = String(d._value ?? d.value ?? 0);
        break;
      case 'timeline-range':
        value = `${d.start ?? 0} – ${d.end ?? 0}`;
        break;
      case 'slope':
        value = `${this.options().slopeLeftLabel ?? 'Left'}: ${d.value ?? ''} · ${this.options().slopeRightLabel ?? 'Right'}: ${d.value2 ?? ''}`;
        break;
      case 'mixed-bar-line':
        value = `Bar: ${d.value ?? 0} · Line: ${d.lineValue ?? 0}`;
        break;
      case 'range-area':
        value = `${d.value ?? 0} – ${d.value2 ?? 0}`;
        break;
      case 'waterfall':
        value = d.isTotal ? this.formatWaterfallValue(d._cumulative ?? d.value) : String(d.value ?? 0);
        break;
      case 'scatter':
        value = `x: ${d.x ?? ''} · y: ${d.y ?? d.value ?? ''}`;
        break;
      case 'bubble':
        value = `x: ${d.x ?? ''} · y: ${d.y ?? ''} · r: ${d.r ?? d.value ?? ''}`;
        break;
      case 'boxplot':
        value = `min: ${d.min ?? ''} · Q1: ${d.q1 ?? ''} · med: ${d.median ?? ''} · Q3: ${d.q3 ?? ''} · max: ${d.max ?? ''}`;
        break;
      case 'candlestick':
        value = `O: ${d.open ?? ''} H: ${d.high ?? ''} L: ${d.low ?? ''} C: ${d.close ?? ''}`;
        break;
      case 'mixed-overlay':
      case 'area-bar':
        value = `Bar: ${d.value ?? 0} · Area: ${d.value2 ?? 0}`;
        break;
      default:
        value = String(d.value ?? 0);
    }
    return { label, value };
  }

}
