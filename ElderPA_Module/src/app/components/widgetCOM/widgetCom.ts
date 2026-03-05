import {
  Component,
  computed, effect,
  EventEmitter, inject,
  Inject,
  Input,
  input,
  OnInit,
  Output,
  PLATFORM_ID, Signal,
  signal
} from '@angular/core';
import { AuditInstance, Indicator, CompanyType, LocationType, UserType, Widget } from '../Types';
import {NgComponentOutlet} from '@angular/common';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {WigetOptions} from './wiget-options/wiget-options';
import {CdkDrag, CdkDragPlaceholder} from '@angular/cdk/drag-drop';
import {CompanyService} from '../../Services/Company.service';
import {AuthService} from '../../Services/Auth.service';
import {Router} from '@angular/router';
import {MatDialog} from '@angular/material/dialog';

import {LocalStorageService} from '../../Services/LocalStorage.service';
import {CLOEDomain, CLOEDomains} from '../ccga/ccga';
import {AuditDataService} from '../../Services/audit-data.service';
import {DashboardService} from '../../Services/dashboard-service';
@Component({
  selector: 'app-widget',
  imports: [
    NgComponentOutlet,
    MatIcon,
    MatIconButton,
    WigetOptions,
    CdkDrag,
    CdkDragPlaceholder
  ],
  templateUrl: './widgetCom.html',
  styleUrl: './widgetCom.css',
  host:{
    '[style.grid-area]' : '"span " + (data().rows??1) + " / span " + (data().cols??1)'
  }

})
export class WidgetCom implements OnInit{
  series = [1,2,3,4,5,9,7,8,9,10,15,12];
  series2 = [3,99,3,4,3];
  tempInd: Indicator = {
    current: 0,
    history: [],
    name: '',
    status: "Green",
    target: 0,
    trend: "Stable",
    unit: '',
    id:''};
  private readonly INDICATOR_KEY = 'current-indicator';
  indicator = signal<Indicator>(this.tempInd);
  viewType = signal<'month' | 'week' | 'day'>('month');
  data = input.required<Widget>();
  locations = input<LocationType[]>();
  companies = input<CompanyType[]>();
  showOptions = signal(false)
  isAdmin= input<boolean>();
  user = input<UserType|null>();
  canCreateTask = input<boolean>(true);

  test = signal<string[]>([]);

  /** Current location id so governance (and other widgets) get updates when location is set after dashboard load. */
  currentLocationId = signal<string | null>(null);

  /** Reactive inputs for the outlet so the chart updates when widget (e.g. selectedIndicatorId) changes. */
  outletInputs = computed(() => {
    this.data();
    this.locations();
    this.currentLocationId();
    return this.getInputsForComponent(this.data().content);
  });

  ngOnInit() {
    const locationId = this.data().locationId; // `data()` is now set
    const stored = this.ls.getID(this.indicatorKeyFor(locationId || ""));
    if (stored) {
      try {
        this.indicator.set(JSON.parse(stored) as Indicator);
      } catch {
        // ignore parse errors
      }
    }
    this.companyService.currentLocation$.subscribe((loc) => {
      const id = loc?.locationID ?? (loc as any)?.id ?? null;
      this.currentLocationId.set(id ?? null);
    });
  }

  constructor(
    private companyService: CompanyService,
    private ls: LocalStorageService,
    private authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private dashboardService: DashboardService,
    private auditService: AuditDataService) {
    this.audits = this.auditService.audits;
    effect(() => {
      const widget = this.data();              // tracks `data` signal
      const locationId = widget.locationId;

      const stored = this.ls.getID(this.indicatorKeyFor(locationId || ""));
      if (stored) {
        try {
          this.indicator.set(JSON.parse(stored) as Indicator);
        } catch {}
      }

      // Optional: if you want auto-save, use a second effect
    });
  }
  private indicatorKeyFor(locationId: string) {
    return `indicator:${locationId}`;
  }

  /** Bar chart data from one location's performance (KPI/KFI/KCI). Single indicator with history → 12 months Jan–Dec. */
  private getLocationMetricChartData(): {
    series: number[];
    labels: string[];
    targets: number[];
    markerIndices: number[];
  } | null {
    const locId = this.data().locationId;
    const metricType = this.data().metricType;
    if (!locId || (metricType !== 'KPI' && metricType !== 'KFI' && metricType !== 'KCI')) return null;
    const locs = this.locations() ?? [];
    const loc = locs.find((l) => (l.locationID ?? l.id) === locId);
    if (!loc?.performance?.categories?.length) return null;
    let indicators = loc.performance.categories
      .filter((c) => c.type === metricType)
      .flatMap((c) => c.indicators ?? []);
    const singleId = this.data().selectedIndicatorId;
    const selectedIds = this.data().selectedIndicatorIds;
    if (singleId != null && singleId !== '') {
      indicators = indicators.filter((i) => i.id === singleId);
    } else if (selectedIds?.length) {
      indicators = indicators.filter((i) => selectedIds.includes(i.id));
    }
    if (!indicators.length) return null;

    // Single indicator with history → weekly = one bar per point; else 12 months Jan–Dec (e.g. Monthly hours)
    if (indicators.length === 1) {
      const ind = indicators[0]!;
      const raw = ind.history ?? [];
      if (raw.length > 0) {
        const isWeekly = (ind.resetPeriod ?? '').toLowerCase() === 'weekly';
        const isDayLevel = raw.some((h) => typeof h.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h.date));
        const useWeekly = isWeekly || (isDayLevel && raw.length >= 2);
        const chart = useWeekly ? this.buildWeeklySeriesFromHistory(ind) : this.buildMonthlySeriesFromHistory(ind);
        if (chart) {
          const markerIndices: number[] = [];
          chart.series.forEach((val, idx) => {
            if (this.isIndicatorBreach(ind, val)) markerIndices.push(idx);
          });
          return { ...chart, markerIndices };
        }
      }
    }

    // Multiple indicators or no history: one bar per indicator
    const series = indicators.map((i) => i.current ?? 0);
    const labels = indicators.map((i) => i.name ?? '');
    const targets = indicators.map((i) => i.target ?? 0);
    const markerIndices: number[] = [];
    indicators.forEach((ind, idx) => {
      if (this.isIndicatorBreach(ind, ind.current ?? 0)) markerIndices.push(idx);
    });
    return { series, labels, targets, markerIndices };
  }

  /** Parse history date: YYYY-MM-DD, YYYY-MM, or month name (jan/feb/...) → same year as now. */
  private parseHistoryDate(d: string): Date {
    if (typeof d !== 'string') return new Date(NaN);
    const s = d.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);
    if (/^\d{4}-\d{2}/.test(s)) return new Date(s + '-01');
    const monthFromName = this.monthNameToNumber(s);
    if (monthFromName != null) {
      const y = new Date().getFullYear();
      return new Date(y, monthFromName - 1, 1);
    }
    return new Date(s);
  }

  /** "jan", "feb", "January", or 1–12 → 1-based month number; else null. */
  private monthNameToNumber(s: string): number | null {
    const n = parseInt(s, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 12) return n;
    const three = s.toLowerCase().slice(0, 3);
    const map: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    return map[three] ?? null;
  }

  /** Normalize history date to YYYY-MM. Month names (jan/feb) use current year; YYYY-MM kept as-is. */
  private historyDateToMonthKey(dateStr: string): string | null {
    const s = String(dateStr).trim();
    const currentYear = new Date().getFullYear();
    if (/^\d{4}-\d{2}(-\d{2})?$/.test(s)) {
      const y = s.slice(0, 4);
      const m = s.slice(5, 7);
      return `${y}-${m}`;
    }
    const monthNum = this.monthNameToNumber(s);
    if (monthNum != null) return `${currentYear}-${String(monthNum).padStart(2, '0')}`;
    const dt = this.parseHistoryDate(s);
    if (Number.isNaN(dt.getTime())) return null;
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  }

  /** Build 12 months Jan–Dec of current year from one indicator's history (for dashboard bar chart). */
  private buildMonthlySeriesFromHistory(indicator: Indicator): { series: number[]; labels: string[]; targets: number[] } | null {
    const raw = indicator.history ?? [];
    if (!raw.length) return null;
    const agg = indicator.aggregation ?? 'sum';
    const reduce = (vals: number[]): number =>
      agg === 'average'
        ? vals.reduce((a, b) => a + b, 0) / vals.length
        : agg === 'count'
          ? vals.length
          : vals.reduce((a, b) => a + b, 0);
    const currentYear = new Date().getFullYear();
    const byMonth = new Map<string, number[]>();
    for (const h of raw) {
      const key = this.historyDateToMonthKey(h.date);
      if (key == null || !key.startsWith(String(currentYear) + '-')) continue;
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(h.value);
    }
    const labels: string[] = [];
    const series: number[] = [];
    const targetVal = indicator.target ?? 0;
    const targets: number[] = [];
    for (let i = 0; i < 12; i++) {
      const key = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
      labels.push(key);
      const vals = byMonth.get(key);
      series.push(vals?.length ? reduce(vals) : 0);
      targets.push(targetVal);
    }
    return { series, labels, targets };
  }

  /** One bar per point (weeks/days) for weekly or day-level indicators (e.g. Staff capacity hours). */
  private buildWeeklySeriesFromHistory(indicator: Indicator): { series: number[]; labels: string[]; targets: number[] } | null {
    const raw = indicator.history ?? [];
    if (!raw.length) return null;
    const sorted = [...raw].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const targetVal = indicator.target ?? 0;
    return {
      series: sorted.map((h) => h.value),
      labels: sorted.map((h) => h.date),
      targets: sorted.map(() => targetVal),
    };
  }

  private isIndicatorBreach(indicator: Indicator, value: number): boolean {
    const target = indicator.target ?? 0;
    if (!indicator.unit) return value < target;
    if (/GBP/i.test(indicator.unit)) return value > target;
    const lowerIsBetter = ['time', 'wait', 'delay', 'overspend', 'cost'].some((h) =>
      (indicator.name ?? '').toLowerCase().includes(h)
    );
    return lowerIsBetter ? value > target : value < target;
  }

  getInputsForComponent(componentClass: any): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};

    const cmpMeta = (componentClass as any)?.ɵcmp;
    //console.log(cmpMeta.debugInfo.className);
    //console.log(this.locations());
    const declaredInputs = cmpMeta ? Object.keys(cmpMeta.inputs || {}) : [];
    const locationMetricData = this.getLocationMetricChartData();
    if (declaredInputs.includes('series')) {
      switch (this.data().metricType) {
        case 'CLOE':
          inputs['series'] = this.cloeSeries();
          break;
        case 'Indicator':
          inputs['series'] = this.tempInd !== this.indicator() ? this.getValues(this.indicator().history, 'value') : [];
          break;
        case 'KPI':
        case 'KFI':
        case 'KCI':
          inputs['series'] = locationMetricData?.series ?? [];
          break;
        default:
          inputs['series'] = this.series;
      }
    }
    if (declaredInputs.includes('labels')) {
      switch (this.data().metricType) {
        case 'CLOE':
          inputs['labels'] = this.cloeDomains.slice();
          break;
        case 'Indicator':
          inputs['labels'] = this.tempInd !== this.indicator() ? this.getLabels(this.indicator().history, 'date') : [];
          break;
        case 'KPI':
        case 'KFI':
        case 'KCI':
          inputs['labels'] = locationMetricData?.labels ?? [];
          break;
        default:
          inputs['labels'] = this.series;
      }
    }
    if (declaredInputs.includes('targets')) {
      switch (this.data().metricType) {
        case 'Indicator':
          inputs['targets'] = this.tempInd !== this.indicator() ? this.getTargets(this.indicator().history, this.indicator().target) : [];
          break;
        case 'KPI':
        case 'KFI':
        case 'KCI':
          inputs['targets'] = locationMetricData?.targets ?? [];
          break;
        default:
          inputs['targets'] = this.series;
      }
    }
    if (declaredInputs.includes('markerIndices')) {
      inputs['markerIndices'] = locationMetricData?.markerIndices ?? [];
    }
    if (declaredInputs.includes('LocElements')) inputs["LocElements"] = this.locations();
    if (declaredInputs.includes('ComElements')) inputs["ComElements"] = this.companies();
    if (declaredInputs.includes('isAdmin')) inputs["isAdmin"] = this.isAdmin;
    if (declaredInputs.includes('viewType')) {
      //console.log(this.viewType());
      inputs["viewType"] = this.viewType() // correct (value)
    }

    if (declaredInputs.includes('metricType')) inputs["metricType"] = this.data().metricType;
    if (declaredInputs.includes('chartTitle')) inputs['chartTitle'] = this.data().label ?? '';
    if (declaredInputs.includes('indicatorName')) {
      const locData = this.getLocationMetricChartData();
      inputs['indicatorName'] = (locData?.labels?.length === 1 ? locData.labels[0] : '') ?? '';
    }

    if (declaredInputs.includes('current')) {
      // Determine value based on metric type
      switch (this.data().metricType) {
        case 'KPI':
          inputs['current'] = this.calculateKPI();
          break;
        case 'KFI':
          inputs['current'] = this.calculateKFI();
          break;
        case 'KCI':
          inputs['current'] = this.calculateKCI();
          break;
        case 'SAT':
          inputs['current'] = this.calculateKCI();
          break;
        default:
          inputs['current'] = 0;
      }
    }
    if (declaredInputs.includes('user')) inputs["user"] = this.user;
    if (declaredInputs.includes('canCreateTask')) inputs["canCreateTask"] = this.canCreateTask();
    if (declaredInputs.includes('setTest')) {
      inputs['setTest'] = (value: string[], removedLocationId?: string) => {
        if (value !== this.test()) this.test.set(value);
        const prevIds = [...this.dashboardService.monitoredLocationIds()];
        this.dashboardService.saveMonitoredLocations(value, removedLocationId).subscribe({
          next: () => {
            if (!removedLocationId) {
              const addedIds = value.filter((id) => !prevIds.includes(id));
              const locs = (this.locations() ?? []).filter((l) =>
                addedIds.includes(l.locationID ?? l.id ?? '')
              );
              if (locs.length) {
                this.dashboardService.addLocationWidgets(
                  locs.map((l) => ({ id: l.locationID ?? l.id ?? '', name: l.name }))
                );
              }
            }
          },
          error: () => {},
        });
      };
    }
    if (declaredInputs.includes('monitoredLocationIds')) {
      inputs['monitoredLocationIds'] = this.dashboardService.monitoredLocationIds() ?? [];
    }
    if (declaredInputs.includes('companyId')) {
      const companies = this.companies() ?? [];
      const currentId = this.ls.getID('companyID') ?? companies[0]?._id;
      inputs['companyId'] = currentId ?? null;
    }
    if (declaredInputs.includes('locationID')) {
      const locationId = this.currentLocationId() ?? this.ls.getID('locationID') ?? this.companyService.getCurrentLocation()?.locationID ?? (this.companyService.getCurrentLocation() as any)?.id ?? null;
      inputs['locationID'] = locationId ?? null;
    }
    return inputs;

  }



  calculateKPI(): number {
    return this.activeLocations.reduce((sum, loc) => sum + this.calculateComplianceScore(loc), 0) / this.activeLocations.length;
  }

  calculateKFI(): number {
    // Example: some other formula
    return this.activeLocations.length > 0 ? 75 : 0;
  }

  calculateKCI(): number {
    // Example: yet another formula
    return 90;
  }
  get activeLocations(): LocationType[] {
    if (!this.test().length) return this.locations() || [];
    return (this.locations() || []).filter(loc => {
      const id = loc.locationID ?? loc.id ?? '';
      return this.test().includes(id);
    });
  }
  calculateComplianceScore(location: LocationType): number {
    const alerts = location.performance?.alerts?.length || 0;
    // Simple mock calculation: higher alerts = lower score
    return Math.max(0, 100 - (alerts * 5));
  }
  readonly audits: Signal<AuditInstance[]>;
  readonly cloeSeries = computed(() => this.cloeDomains.map(d => this.getDomainScore(d)));
  readonly cloeDomains = CLOEDomains;
  getDomainScore(domain: CLOEDomain): number {
    const score = (this.masterCLOE().scores[domain] ?? 0);
    //console.log(`${domain} score: ${score}`);
    return score;
  }
  readonly masterCLOE = computed(() => {
    const allQuestions = this.audits()?.filter(b => b.locationId === this.data().locationId)?.flatMap(a => a.questions);
    const sum: Record<CLOEDomain, number> = {Safe: 0, Effective: 0, Caring: 0, Responsive: 0, WellLed: 0};
    const count: Record<CLOEDomain, number> = {Safe: 0, Effective: 0, Caring: 0, Responsive: 0, WellLed: 0};

    allQuestions.forEach(q => {
      const domain = q.domain as CLOEDomain;
      if (q.score != null) {
        sum[domain] += q.score;
        count[domain] += 1;
      }
    });


    const scores: Record<CLOEDomain, number> = {
      Safe: count.Safe ? sum.Safe / count.Safe : 0,
      Effective: count.Effective ? sum.Effective / count.Effective : 0,
      Caring: count.Caring ? sum.Caring / count.Caring : 0,
      Responsive: count.Responsive ? sum.Responsive / count.Responsive : 0,
      WellLed: count.WellLed ? sum.WellLed / count.WellLed : 0,
    };
    const validDomains = Object.keys(count).filter(d => count[d as CLOEDomain] > 0) as CLOEDomain[];
    const averageScore =
      validDomains.length
        ? validDomains.reduce((acc, d) => acc + scores[d], 0) / validDomains.length
        : 0;

    return { scores, averageScore };
  });

  getLabels(data:any,dataLabelsID:string): string[] {


    const temp : string[] = [];
    data.forEach((d: any) => {temp.push(d.date)});

    return temp;
  }
  getTargets(data:any,dataLabelsID:number): number[] {


    const temp : number[] = [];
    data.forEach((d: any) => {temp.push(dataLabelsID)});

    return temp;
  }

  getValues(data:any,dataLabelsID:string): number[] {
    const temp : number[] = [];
    data.forEach((d: any) => {temp.push(d.value)});

    //console.log(temp);
    return temp;

  }
}
