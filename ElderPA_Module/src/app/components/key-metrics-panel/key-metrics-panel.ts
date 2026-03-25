import { CommonModule, NgFor, NgIf } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, map, takeUntil, tap } from 'rxjs/operators';

import {
  PerformanceSet,
  Indicator,
  IndicatorHistoryPoint,
  Alert,
  ActionTask,
  ChartData,
} from '../Types';

import { MatIconModule } from '@angular/material/icon';
import { DynamicFlexTable } from '../dynamic-flex-table/dynamic-flex-table';
import { Panel } from '../panel/panel';
import { SmartChartComponent, type ChartDatum, type ChartOptions } from '../../NEW for implemnet/smart-chart/smart-chart';
import { CSTButton } from '../cst-button/cst-button';
import { TaskCreator } from '../task-creator/task-creator';
import { AuthService } from '../../Services/Auth.service';
import { WalkthroughRegistryService } from '../../Services/walkthrough-registry.service';

interface MarkerConfig {
  index: number;
  label: string;
  color: string;
}

/** Debug payload from POST .../recalculate-from-audits */
interface RecalcDebug {
  periodUsed?: { year: number; month: number; fromPeriod?: boolean };
  byIndicator?: unknown[];
  [key: string]: unknown;
}

@Component({
  selector: 'app-key-metrics-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgFor,
    NgIf,
    MatIconModule,
    DynamicFlexTable,
    Panel,
    SmartChartComponent,
    CSTButton,
    TaskCreator,
  ],
  templateUrl: './key-metrics-panel.html',
  styleUrl: './key-metrics-panel.css',
})
export class KeyMetricsPanel implements OnInit, OnChanges, OnDestroy {
  private destroy$ = new Subject<void>();

  // render mode (standalone vs embedded) - keep your existing API
  @Input() embedded = false;

  // DB location id (string). In locations.html pass: selectedLocation?.locationID
  @Input() locationId: string | null | undefined = null;


  // Data for template
  selectedSet: PerformanceSet | null = null;
  loading = false;
  loadError: string | null = null;

  totalIndicators = 0;
  statusCounts = { Green: 0, Amber: 0, Red: 0 };

  showTaskCreator = false;
  recalculating = false;
  syncing = false;
  /** Debug info from last recalculate-from-audits (for troubleshooting) */
  lastRecalcDebug: RecalcDebug | null = null;
  /** Optional period override for recalculate (e.g. "2026-04" to use April 2026) */
  recalcPeriodOverride = '';
  /** When true, recalculate-from-audits runs for all 12 months so charts show full year. */
  recalcFullYear = true;

  // One selected indicator per category: chartState[categoryId] = { series, categories, targets, markers, selectedIndicator }
  chartState: Record<string, any> = {};

  // Top diagrams: Performance (KPI), Finances (KFI), Control (KCI) – carousel index per group
  performanceIndex = 0;
  financesIndex = 0;
  controlIndex = 0;
  /** 1 = next (slide from right), -1 = prev (slide from left) for carousel animation */
  performanceSlideDirection: 1 | -1 = 1;
  financesSlideDirection: 1 | -1 = 1;
  controlSlideDirection: 1 | -1 = 1;
  private diagramCarouselTimer: ReturnType<typeof setInterval> | null = null;
  readonly diagramRotateIntervalMs = 3500;
  private dragStartX = 0;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private walkthrough: WalkthroughRegistryService
  ) {}

  /** Only admins and Registered Managers can create or assign tasks. */
  get canAssignTasks(): boolean {
    return this.authService.isAdmin();
  }

  /** Full Key Metrics state as JSON for debugging (company page). */
  get keyMetricsDataJson(): string {
    const state = {
      locationId: this.locationId,
      loading: this.loading,
      loadError: this.loadError,
      selectedSet: this.selectedSet,
      performanceIndicators: this.performanceIndicators(),
      financesIndicators: this.financesIndicators(),
      controlIndicators: this.controlIndicators(),
      performanceIndex: this.performanceIndex,
      financesIndex: this.financesIndex,
      controlIndex: this.controlIndex,
      lastRecalcDebug: this.lastRecalcDebug,
    };
    return JSON.stringify(state, null, 2);
  }

  ngOnInit(): void {
    this.walkthrough.register('/KMP', [
      {
        targetId: 'kmp.performanceCard',
        title: 'Performance',
        description: 'Radial KPI (Performance) chart comparing current performance vs target. The card cycles through the KPI indicators you already have.',
      },
      {
        targetId: 'kmp.financesCard',
        title: 'Finances',
        description: 'Radial KFI (Finances) chart showing target, current values, and status (on track or not). Use it to understand whether finances meet expectations.',
      },
      {
        targetId: 'kmp.controlCard',
        title: 'Control',
        description: 'Radial KCI (Control) chart showing control indicators and where attention is needed first when something is off target.',
      },
      {
        targetId: 'kmp.barChartsCard',
        title: 'Bar chart categories',
        description: 'Bar chart categories: choose the indicator data type you want to inspect (for example last 12 months of the current year or a monthly view). Charts show current trend values plus targets.',
      },
      {
        targetId: 'kmp.updateFromTemplateButton',
        title: 'Update from template',
        description: 'Refresh your indicator data from templates. Use it to update the performance/finances/control values used by the charts.',
      },
      {
        targetId: 'kmp.activeAlertsCardTitle',
        title: 'Active alerts',
        description: 'Active alerts that require action right now. Use the action buttons to assign tasks and start resolving them.',
      },
      {
        targetId: 'kmp.assignTaskButton',
        title: 'Assign task',
        description: 'Assign a task directly from a high alert so the right ownership resolves the issue.',
      },
      {
        targetId: 'kmp.tasksCardTitle',
        title: 'Tasks',
        description: 'Tasks tied to the alerts. When you mark a task as done, the linked alert gets resolved as well.',
      },
      {
        targetId: 'kmp.markDoneButton',
        title: 'Mark done',
        description: 'Mark the selected task as done to resolve the linked alert.',
      },
    ]);

    if (this.locationId) this.loadLatestSet(this.locationId);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['locationId']) {
      const id = this.locationId;
      if (!id) {
        this.selectedSet = null;
        this.loadError = null;
        this.totalIndicators = 0;
        this.statusCounts = { Green: 0, Amber: 0, Red: 0 };
        this.chartState = {};
        this.stopDiagramCarousel();
        return;
      }
      this.loadLatestSet(id);
    }
  }

  ngOnDestroy(): void {
    this.stopDiagramCarousel();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadLatestSet(locationId: string) {
    if (!locationId?.trim()) return;
    this.loading = true;
    this.loadError = null;
    const params = new HttpParams().set('locationId', locationId);

    this.http
      .get<any[]>('/api/performanceSets', { params })
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          this.loadError = err?.error?.message || err?.message || 'Failed to load key metrics';
          this.loading = false;
          this.cdr.detectChanges();
          return of([] as any[]);
        }),
        map((sets) => (Array.isArray(sets) && sets.length ? sets[0] : null)),
        tap((set) => {
          this.loading = false;
          if (set) {
            this.loadError = null;
            console.log('[KeyMetrics] Loaded set', set.id, {
              categories: set.categories?.length ?? 0,
              indicators: (set.categories ?? []).reduce((n: number, c: { indicators?: unknown[] }) => n + (c.indicators?.length ?? 0), 0),
              alerts: set.alerts?.length ?? 0,
              tasks: set.tasks?.length ?? 0,
            });
          }
          this.selectedSet = set
            ? ({
              id: set.id,
              period: set.period,
              createdAt: set.createdAt ?? new Date().toISOString(),
              categories: set.categories ?? [],
              alerts: set.alerts ?? [],
              tasks: set.tasks ?? [],
            } as PerformanceSet)
            : null;

          this.recalculateSummary();
          this.rebuildCharts();
          this.resetDiagramIndices();
          this.startDiagramCarousel();
          this.cdr.detectChanges();
        })
      )
      .subscribe();
  }

  private resetDiagramIndices() {
    this.performanceIndex = 0;
    this.financesIndex = 0;
    this.controlIndex = 0;
  }

  private startDiagramCarousel() {
    this.stopDiagramCarousel();
    this.diagramCarouselTimer = setInterval(() => {
      this.diagramNext('performance');
      this.diagramNext('finances');
      this.diagramNext('control');
      this.cdr.markForCheck();
    }, this.diagramRotateIntervalMs);
  }

  private stopDiagramCarousel() {
    if (this.diagramCarouselTimer) {
      clearInterval(this.diagramCarouselTimer);
      this.diagramCarouselTimer = null;
    }
  }

  onSelectLocation(_: string) {
    // No-op now (selection is done by parent Locations component)
  }

  getTotalIndicatorsCount(): number {
    if (!this.selectedSet?.categories) return 0;
    return (this.selectedSet.categories ?? []).reduce(
      (n: number, c: { indicators?: unknown[] }) => n + (c.indicators?.length ?? 0),
      0
    );
  }

  getCategoryTitles(): string {
    if (!this.selectedSet?.categories?.length) return '';
    return (this.selectedSet.categories ?? []).map((c: { title?: string }) => c.title ?? '').join(', ');
  }

  recalculateSummary() {
    this.totalIndicators = 0;
    this.statusCounts = { Green: 0, Amber: 0, Red: 0 };

    if (!this.selectedSet?.categories?.length) return;

    for (const cat of this.selectedSet.categories) {
      for (const ind of cat.indicators ?? []) {
        this.totalIndicators++;
        if (ind.status === 'Green') this.statusCounts.Green++;
        else if (ind.status === 'Amber') this.statusCounts.Amber++;
        else if (ind.status === 'Red') this.statusCounts.Red++;
      }
    }
  }

  topRisks(): Indicator[] {
    if (!this.selectedSet) return [];
    const all = this.selectedSet.categories.flatMap((c) => c.indicators ?? []);
    const severityRank = (s: string) => (s === 'Red' ? 1 : s === 'Amber' ? 2 : 3);

    return all
      .slice()
      .sort((a, b) => {
        const r = severityRank(a.status) - severityRank(b.status);
        if (r !== 0) return r;
        const diffA = Math.abs((a.current ?? 0) - (a.target ?? 0));
        const diffB = Math.abs((b.current ?? 0) - (b.target ?? 0));
        return diffB - diffA;
      })
      .slice(0, 3);
  }

  /** Indicators for Performance diagram (KPI categories). */
  performanceIndicators(): Indicator[] {
    if (!this.selectedSet?.categories) return [];
    return this.selectedSet.categories.filter((c) => c.type === 'KPI').flatMap((c) => c.indicators ?? []);
  }

  /** Indicators for Finances diagram (KFI categories). */
  financesIndicators(): Indicator[] {
    if (!this.selectedSet?.categories) return [];
    return this.selectedSet.categories.filter((c) => c.type === 'KFI').flatMap((c) => c.indicators ?? []);
  }

  /** Indicators for Control diagram (KCI categories). */
  controlIndicators(): Indicator[] {
    if (!this.selectedSet?.categories) return [];
    return this.selectedSet.categories.filter((c) => c.type === 'KCI').flatMap((c) => c.indicators ?? []);
  }

  performanceCurrent(): Indicator | null {
    const list = this.performanceIndicators();
    if (!list.length) return null;
    const i = ((this.performanceIndex % list.length) + list.length) % list.length;
    return list[i] ?? null;
  }

  financesCurrent(): Indicator | null {
    const list = this.financesIndicators();
    if (!list.length) return null;
    const i = ((this.financesIndex % list.length) + list.length) % list.length;
    return list[i] ?? null;
  }

  controlCurrent(): Indicator | null {
    const list = this.controlIndicators();
    if (!list.length) return null;
    const i = ((this.controlIndex % list.length) + list.length) % list.length;
    return list[i] ?? null;
  }

  diagramNext(group: 'performance' | 'finances' | 'control') {
    const list =
      group === 'performance'
        ? this.performanceIndicators()
        : group === 'finances'
          ? this.financesIndicators()
          : this.controlIndicators();
    if (list.length <= 1) return;
    if (group === 'performance') {
      this.performanceSlideDirection = 1;
      this.performanceIndex = (this.performanceIndex + 1) % list.length;
    } else if (group === 'finances') {
      this.financesSlideDirection = 1;
      this.financesIndex = (this.financesIndex + 1) % list.length;
    } else {
      this.controlSlideDirection = 1;
      this.controlIndex = (this.controlIndex + 1) % list.length;
    }
  }

  diagramPrev(group: 'performance' | 'finances' | 'control') {
    const list =
      group === 'performance'
        ? this.performanceIndicators()
        : group === 'finances'
          ? this.financesIndicators()
          : this.controlIndicators();
    if (list.length <= 1) return;
    const len = list.length;
    if (group === 'performance') {
      this.performanceSlideDirection = -1;
      this.performanceIndex = ((this.performanceIndex - 1) % len + len) % len;
    } else if (group === 'finances') {
      this.financesSlideDirection = -1;
      this.financesIndex = ((this.financesIndex - 1) % len + len) % len;
    } else {
      this.controlSlideDirection = -1;
      this.controlIndex = ((this.controlIndex - 1) % len + len) % len;
    }
  }

  /** Single-item array for carousel ngFor so trackBy creates new node when indicator changes (for animation). */
  getDiagramCarouselItem(group: 'performance' | 'finances' | 'control'): (Indicator | null)[] {
    const cur =
      group === 'performance'
        ? this.performanceCurrent()
        : group === 'finances'
          ? this.financesCurrent()
          : this.controlCurrent();
    return [cur ?? null];
  }

  trackByDiagramItem(_index: number, ind: Indicator | null): string {
    return ind?.id ?? 'empty';
  }

  diagramDragStart(_group: 'performance' | 'finances' | 'control', e: MouseEvent | TouchEvent) {
    this.dragStartX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  }

  diagramDragEnd(group: 'performance' | 'finances' | 'control', e: MouseEvent | TouchEvent) {
    const endX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
    const deltaX = endX - this.dragStartX;
    if (deltaX > 40) this.diagramPrev(group);
    else if (deltaX < -40) this.diagramNext(group);
    this.cdr.markForCheck();
  }

  viewIndicatorDetail(catId: string, indicator: Indicator) {
    const cat = this.selectedSet?.categories?.find((c) => c.id === catId);
    const chartData = this.indicatorChartData(indicator, cat ?? undefined);
    this.chartState[catId] = {
      series: [...chartData.series],
      categories: [...chartData.categories],
      targets: indicator.target != null ? [indicator.target] : null,
      markers: [...chartData.markers],
      selectedIndicator: indicator,
    };
  }

  /** Bar chart data for SmartChart (bar-with-markers). Values stay raw; target is 0–100% so the marker line is on the same scale as the bars. */
  getBarChartData(catId: string): ChartDatum[] {
    const entry = this.chartState[catId];
    if (!entry?.categories?.length || !Array.isArray(entry.series)) return [];
    const targetVal = entry.targets?.length ? (entry.targets[0] ?? entry.targets[entry.series.length - 1]) : undefined;
    const max = Math.max(...entry.series.map((v: number) => v ?? 0), targetVal ?? 0, 1);
    return entry.categories.map((label: string, i: number) => {
      const value = entry.series[i] ?? 0;
      const rowTarget = entry.targets?.length === entry.series.length ? entry.targets[i] : targetVal;
      return {
        label,
        value,
        target: rowTarget != null && max > 0 ? (rowTarget / max) * 100 : undefined
      };
    });
  }

  /** Bar chart options: pass max so bar length = value/max and axis is 0–100%. */
  getBarChartOptions(catId: string): ChartOptions {
    const entry = this.chartState[catId];
    if (!entry?.series?.length) return { showAxis: true, showLegend: false, height: 220 };
    const targetVal = entry.targets?.length ? entry.targets[0] : undefined;
    const max = Math.max(...entry.series.map((v: number) => v ?? 0), targetVal ?? 0, 1);
    return { max, showAxis: true, showLegend: false, height: 220 };
  }

  /** Radial gauge (single value) data for SmartChart. */
  getRadialGaugeData(ind: Indicator): ChartDatum[] {
    return [{ label: ind.name, value: ind.current ?? 0 }];
  }

  /** Radial gauge options (max = target so % is current/target). */
  getRadialGaugeOptions(ind: Indicator): ChartOptions {
    const max = ind.target ?? 100;
    return { max: max <= 0 ? 100 : max, showLegend: false, height: 180 };
  }

  /** One chart per category; default to first indicator. */
  private rebuildCharts() {
    this.chartState = {};
    if (!this.selectedSet?.categories) return;

    for (const cat of this.selectedSet.categories) {
      const first = cat.indicators?.[0];
      if (first) this.viewIndicatorDetail(cat.id, first);
    }
  }

  private parseHistoryDate(d: string): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(d);
    if (/^\d{4}-\d{2}$/.test(d)) return new Date(d + '-01');
    const w = d.match(/^(\d{4})-W(\d{1,2})$/i);
    if (w) {
      const year = parseInt(w[1], 10);
      const week = parseInt(w[2], 10);
      const jan4 = new Date(year, 0, 4);
      const mon = new Date(jan4);
      mon.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
      mon.setDate(mon.getDate() + (week - 1) * 7);
      return mon;
    }
    return new Date(d);
  }

  /** Bar chart: last 12 months of history. */
  private lastYearOfHistory(history: IndicatorHistoryPoint[]): IndicatorHistoryPoint[] {
    if (!history?.length) return [];
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return history
      .filter((h) => this.parseHistoryDate(h.date) >= oneYearAgo)
      .sort((a, b) => this.parseHistoryDate(a.date).getTime() - this.parseHistoryDate(b.date).getTime());
  }

  /** Build 12 months for current year (Jan–Dec) with optional values from byMonth map. */
  private currentYear12Months(byMonth: Map<string, number[]>, reduce: (vals: number[]) => number): IndicatorHistoryPoint[] {
    const currentYear = new Date().getFullYear();
    const months: IndicatorHistoryPoint[] = [];
    for (let i = 0; i < 12; i++) {
      const key = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
      const vals = byMonth.get(key);
      months.push({ date: key, value: vals?.length ? reduce(vals) : 0 });
    }
    return months;
  }

  /** Only months that have data in the map, sorted Jan–Dec (for “show only months in the file”). */
  private monthsWithDataOnly(byMonth: Map<string, number[]>, reduce: (vals: number[]) => number): IndicatorHistoryPoint[] {
    const keys = Array.from(byMonth.keys()).sort();
    return keys.map((key) => {
      const vals = byMonth.get(key)!;
      return { date: key, value: vals.length ? reduce(vals) : 0 };
    });
  }

  /**
   * Chart history by category:
   * - KPI (Performance): monthly view — current year points only.
   * - KFI (Financial): current year only — always 12 bars Jan–Dec in order.
   * - KCI (Controls/compliance): monthly = 12 bars Jan–Dec; yearly = 12 years.
   */
  private getChartHistoryForCategory(
    categoryType: 'KPI' | 'KFI' | 'KCI',
    indicator: Indicator
  ): IndicatorHistoryPoint[] {
    const raw = indicator.history ?? [];
    const agg = indicator.aggregation ?? 'sum';
    const reduce = (vals: number[]) =>
      agg === 'average'
        ? vals.reduce((a, b) => a + b, 0) / vals.length
        : agg === 'count'
          ? vals.length
          : vals.reduce((a, b) => a + b, 0);

    const monthKey = (d: string): string => {
      const dt = this.parseHistoryDate(d);
      const y = dt.getFullYear();
      const m = dt.getMonth() + 1;
      return `${y}-${String(m).padStart(2, '0')}`;
    };

    const now = new Date();
    const currentYear = now.getFullYear();

    if (categoryType === 'KPI') {
      if (!raw.length) return [];
      return this.lastYearOfHistory(raw.filter((h) => this.parseHistoryDate(h.date).getFullYear() === currentYear));
    }

    if (categoryType === 'KFI') {
      // Weekly (one bar per week): history with YYYY-MM-DD → one bar per date, sorted (from recalc period)
      const isDayLevel = raw.some((h) => typeof h.date === 'string' && h.date.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(h.date));
      if (isDayLevel && raw.length > 0) {
        const sorted = [...raw].sort((a, b) => String(a.date).localeCompare(String(b.date)));
        return sorted.slice(-12);
      }
      // Monthly: always 12 bars Jan–Dec of current year (one column per month)
      const byMonth = new Map<string, number[]>();
      for (const h of raw) {
        const dt = this.parseHistoryDate(h.date);
        if (dt.getFullYear() !== currentYear) continue;
        const key = monthKey(h.date);
        if (!byMonth.has(key)) byMonth.set(key, []);
        byMonth.get(key)!.push(h.value);
      }
      return this.currentYear12Months(byMonth, reduce);
    }

    // KCI: based on indicator — monthly => 12 months; yearly => 12 years
    const period = (indicator.resetPeriod || 'monthly').toLowerCase();
    if (period === 'yearly') {
      if (!raw.length) return [];
      const byYear = new Map<string, number[]>();
      const twelveYearsAgo = now.getFullYear() - 11;
      for (const h of raw) {
        const y = this.parseHistoryDate(h.date).getFullYear();
        if (y < twelveYearsAgo) continue;
        const key = String(y);
        if (!byYear.has(key)) byYear.set(key, []);
        byYear.get(key)!.push(h.value);
      }
      const years: IndicatorHistoryPoint[] = [];
      for (let y = twelveYearsAgo; y <= now.getFullYear(); y++) {
        const key = String(y);
        const vals = byYear.get(key);
        years.push({ date: key, value: vals?.length ? reduce(vals) : 0 });
      }
      return years;
    }

    // KCI monthly: always 12 bars Jan–Dec of current year (one column per month)
    const byMonth = new Map<string, number[]>();
    for (const h of raw) {
      const dt = this.parseHistoryDate(h.date);
      if (dt.getFullYear() !== currentYear) continue;
      const key = monthKey(h.date);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(h.value);
    }
    return this.currentYear12Months(byMonth, reduce);
  }

  indicatorChartData(indicator: Indicator, category?: { type: 'KPI' | 'KFI' | 'KCI' }): ChartData {
    // KCI (controls/compliance): one value only — do not split into months or years
    if (category?.type === 'KCI') {
      const current = indicator.current ?? 0;
      return {
        categories: ['Current'],
        series: [current],
        target: indicator.target,
        markers: this.isBreach(indicator, current) ? [0] : [],
      };
    }
    const history =
      category != null
        ? this.getChartHistoryForCategory(category.type, indicator)
        : this.getChartHistoryForCategory('KFI', indicator);
    const hasHistory = history.length > 0;
    const categories = hasHistory ? history.map((h) => h.date) : ['Current'];
    const series = hasHistory ? history.map((h) => h.value) : [indicator.current ?? 0];
    const markers: number[] = [];
    series.forEach((val, idx) => {
      if (this.isBreach(indicator, val)) markers.push(idx);
    });
    return { series, categories, target: indicator.target, markers };
  }

  /** For indicators with monthly history, show current month’s value only; otherwise show indicator.current. */
  getDisplayCurrent(indicator: Indicator | undefined, categoryType?: string): number {
    if (!indicator) return 0;
    if (categoryType === 'KCI') return indicator.current ?? 0;
    const history = indicator.history ?? [];
    if (history.length === 0) return indicator.current ?? 0;
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const point = history.find((h) => {
      const d = this.parseHistoryDate(h.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === currentKey;
    });
    return point != null ? point.value : 0;
  }

  isBreach(indicator: Indicator, value: number): boolean {
    const target = indicator.target ?? 0;

    if (!indicator.unit) return value < target;

    const currencyRegex = /GBP/i;
    if (currencyRegex.test(indicator.unit)) return value > target;

    const lowerIsBetterHints = ['time', 'wait', 'delay', 'overspend', 'cost'];
    const nameLower = (indicator.name ?? '').toLowerCase();

    for (const hint of lowerIsBetterHints) {
      if (nameLower.includes(hint)) return value > target;
    }
    return value < target;
  }

  openTaskCreator() {
    this.showTaskCreator = true;
  }

  /** When opening task creator from an alert, preselect this alert. */
  selectedAlertForTask: Alert | null = null;

  handleTaskCancelled() {
    this.showTaskCreator = false;
    this.selectedAlertForTask = null;
  }

  handleTaskCreated(task: Partial<ActionTask>) {
    if (!this.selectedSet) return;

    const newTask: ActionTask = {
      id: `task-${Date.now()}`,
      alertId: (task as any).alertId || '',
      assignedBy: 'current-user-id',
      assignedTo: (task as any).assignedTo || '',
      category: (task as any).category || '',
      description: (task as any).description || '',
      dueDate: (task as any).dueDate || new Date().toISOString(),
      status: 'Open',
      comments: (task as any).comments || [],
    };

    this.selectedSet.tasks.push(newTask);
    this.showTaskCreator = false;
    this.selectedAlertForTask = null;

    this.http
      .patch<PerformanceSet>(`/api/performanceSets/${this.selectedSet.id}`, {
        tasks: this.selectedSet.tasks,
      })
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          console.error('Save task failed', err);
          return of(null);
        })
      )
      .subscribe((updated) => {
        if (updated) {
          this.selectedSet = {
            id: updated.id,
            period: updated.period,
            createdAt: updated.createdAt ?? new Date().toISOString(),
            categories: updated.categories ?? [],
            alerts: updated.alerts ?? [],
            tasks: updated.tasks ?? [],
          };
          this.cdr.detectChanges();
        }
      });
  }

  assignTaskFromAlert(alert: Alert): void {
    this.selectedAlertForTask = alert;
    this.showTaskCreator = true;
    this.cdr.detectChanges();
  }

  /** Mark task/alert as done: removes the alert and all tasks linked to it. */
  taskToResolve: ActionTask | null = null;

  resolveAlert(alertId: string): void {
    const set = this.selectedSet;
    if (!set?.id || !alertId) return;

    this.http
      .post<PerformanceSet>(`/api/performanceSets/${set.id}/resolve-alert`, { alertId })
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          console.error('Resolve alert failed', err);
          return of(null);
        })
      )
      .subscribe((updated) => {
        if (updated) {
          this.selectedSet = {
            id: updated.id,
            period: updated.period,
            createdAt: updated.createdAt ?? new Date().toISOString(),
            categories: updated.categories ?? [],
            alerts: updated.alerts ?? [],
            tasks: updated.tasks ?? [],
          };
          this.taskToResolve = null;
          this.cdr.detectChanges();
        }
      });
  }

  getMarkers(catId: string): MarkerConfig[] {
    const entry = this.chartState[catId];
    if (!entry?.markers) return [];
    return entry.markers.map((markerIndex: number, i: number) => ({
      index: markerIndex,
      label: entry.categories[i] ?? `Marker ${i}`,
      color: '#FF0000',
    }));
  }

  onIndicatorSelect(catId: string, indicatorId: string) {
    const cat = this.selectedSet?.categories?.find((c) => c.id === catId);
    const ind = cat?.indicators?.find((x) => x.id === indicatorId);
    if (ind) this.viewIndicatorDetail(catId, ind);
  }

  saveIndicatorTarget(catId: string, indicatorId: string, value: string | number): void {
    const set = this.selectedSet;
    if (!set?.id) return;
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(num)) return;

    const updatedCategories = (set.categories ?? []).map((cat) => {
      if (cat.id !== catId) return cat;
      return {
        ...cat,
        indicators: (cat.indicators ?? []).map((ind) =>
          ind.id === indicatorId ? { ...ind, target: num } : ind
        ),
      };
    });

    this.http
      .patch<PerformanceSet>(`/api/performanceSets/${set.id}`, { categories: updatedCategories })
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          console.error('Save target failed', err);
          return of(null);
        })
      )
      .subscribe((updated) => {
        if (updated) {
          this.selectedSet = {
            id: updated.id,
            period: updated.period,
            createdAt: updated.createdAt ?? new Date().toISOString(),
            categories: updated.categories ?? [],
            alerts: updated.alerts ?? [],
            tasks: updated.tasks ?? [],
          };
          this.recalculateSummary();
          this.refreshChartStateFromSet();
          this.cdr.detectChanges();
        }
      });
  }

  /** After PATCH, refresh chartState so selected indicator per category shows updated target/current. */
  private refreshChartStateFromSet(): void {
    if (!this.selectedSet?.categories) return;
    for (const cat of this.selectedSet.categories) {
      const entry = this.chartState[cat.id];
      if (!entry?.selectedIndicator) continue;
      const ind = cat.indicators?.find((x) => x.id === entry.selectedIndicator!.id);
      if (ind) this.viewIndicatorDetail(cat.id, ind);
    }
  }

  get activeAlerts(): Alert[] {
    return (this.selectedSet?.alerts ?? []).filter((a) => a.active);
  }

  /** Indicator class for alert severity (High/Critical → high, Medium → mid, Low/other → light). */
  alertSeverityLevel(alert: Alert): 'high' | 'mid' | 'light' {
    const s = alert.severity ?? '';
    if (s === 'High' || s === 'Critical') return 'high';
    if (s === 'Medium') return 'mid';
    return 'light';
  }

  /** Display label for alert severity (theme-aligned: High, Mid, Light). */
  alertSeverityLabel(alert: Alert): string {
    const s = alert.severity ?? '';
    if (s === 'High' || s === 'Critical') return 'High';
    if (s === 'Medium') return 'Mid';
    return 'Light';
  }

  /** Map API status (Green/Amber/Red) to indicator class (light/mid/high) for monochromatic styling */
  indicatorLevel(status: string | undefined): 'light' | 'mid' | 'high' {
    if (status === 'Green') return 'light';
    if (status === 'Amber') return 'mid';
    return 'high';
  }

  indicatorLabel(status: string | undefined): string {
    if (status === 'Green') return 'Light';
    if (status === 'Amber') return 'Mid';
    return 'High';
  }

  get alertIndicatorOptions() {
    return this.activeAlerts.map((a) => ({ alertId: a.id, indicatorId: a.indicatorId, message: a.message }));
  }

  hasAuditSourcedIndicators(): boolean {
    if (!this.selectedSet?.categories?.length) return false;
    for (const cat of this.selectedSet.categories) {
      for (const ind of cat.indicators ?? []) {
        if (ind.sourceType === 'audit') return true;
      }
    }
    return false;
  }

  /** Debug: what is loaded and displayed (categories, indicators per category, selected chart, bar count). */
  get displayDebug(): Record<string, unknown> {
    const set = this.selectedSet;
    if (!set) return { loaded: false, message: 'No set loaded' };
    const categories = (set.categories ?? []).map((cat: any) => {
      const indicators = cat.indicators ?? [];
      const entry = this.chartState[cat.id];
      const selected = entry?.selectedIndicator;
      return {
        id: cat.id,
        title: cat.title,
        indicatorsCount: indicators.length,
        indicatorNames: indicators.map((ind: any) => ({ id: ind.id, name: ind.name, sourceType: ind.sourceType })),
        selectedIndicatorId: selected?.id ?? null,
        selectedIndicatorName: selected?.name ?? null,
        chartSeriesLength: Array.isArray(entry?.series) ? entry.series.length : 0,
        chartCategoriesLength: Array.isArray(entry?.categories) ? entry.categories.length : 0,
      };
    });
    return {
      loaded: true,
      setId: set.id,
      period: set.period,
      categoriesCount: categories.length,
      totalIndicators: this.totalIndicators,
      categories,
    };
  }

  recalculateFromAudits(): void {
    const set = this.selectedSet;
    const locId = this.locationId;
    if (!set?.id || !locId) return;

    this.recalculating = true;
    this.cdr.detectChanges();

    let params: HttpParams = new HttpParams();
    if (this.recalcPeriodOverride?.trim()) {
      const [y, m] = this.recalcPeriodOverride.trim().split('-');
      if (y) params = params.set('year', y);
      if (m) params = params.set('month', m);
    }
    if (this.recalcFullYear) {
      params = params.set('fullYear', 'true');
    }
    this.http
      .post<PerformanceSet>(`/api/performanceSets/${set.id}/recalculate-from-audits`, {}, { params })
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          this.recalculating = false;
          this.cdr.detectChanges();
          console.error('Recalculate from audits failed', err);
          return of(null);
        })
      )
      .subscribe((updated) => {
        this.recalculating = false;
        if (updated) {
          const res = updated as PerformanceSet & { _debug?: Record<string, unknown> };
          if (res._debug) {
            this.lastRecalcDebug = res._debug;
            console.log('[KeyMetrics] Recalculate debug', res._debug);
          }
          this.selectedSet = {
            id: updated.id,
            period: updated.period,
            createdAt: updated.createdAt ?? new Date().toISOString(),
            categories: updated.categories ?? [],
            alerts: updated.alerts ?? [],
            tasks: updated.tasks ?? [],
          };
          this.recalculateSummary();
          this.rebuildCharts();
        }
        this.cdr.detectChanges();
      });
  }

  /** Replace set categories with active template (gets audit-sourced indicators). */
  syncFromTemplate(): void {
    const set = this.selectedSet;
    if (!set?.id) return;

    this.syncing = true;
    this.cdr.detectChanges();

    this.http
      .post<PerformanceSet>(`/api/performanceSets/${set.id}/sync-from-template`, { replaceCategories: true })
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          this.syncing = false;
          this.cdr.detectChanges();
          console.error('Sync from template failed', err);
          return of(null);
        })
      )
      .subscribe((updated) => {
        this.syncing = false;
        if (updated) {
          this.selectedSet = {
            id: updated.id,
            period: updated.period,
            createdAt: updated.createdAt ?? new Date().toISOString(),
            categories: updated.categories ?? [],
            alerts: updated.alerts ?? [],
            tasks: updated.tasks ?? [],
          };
          this.recalculateSummary();
          this.rebuildCharts();
        }
        this.cdr.detectChanges();
      });
  }
}
