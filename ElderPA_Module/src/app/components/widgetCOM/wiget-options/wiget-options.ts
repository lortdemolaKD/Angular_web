import { ApplicationRef, Component, computed, effect, inject, input, Input, model } from '@angular/core';

import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatButtonToggleModule} from '@angular/material/button-toggle';

import { Indicator, LocationType, PerformanceSet, Widget } from '../../Types';
import { DashboardService } from '../../../Services/dashboard-service';
import { CommonModule } from '@angular/common';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { LocalStorageService } from '../../../Services/LocalStorage.service';

@Component({
  selector: 'app-wiget-options',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatSelectModule,
    MatFormFieldModule
  ],
  templateUrl: './wiget-options.html',
  styleUrl: './wiget-options.css',
})
export class WigetOptions {
  data = input.required<Widget>();
  @Input() locations: LocationType[] = [];

  showOptions = model<boolean>(false);
  indicator = model<Indicator | undefined>();
  viewType = model<string | undefined>();

  viewTypeS: string[] = ['month', 'week', 'day'];

  /** Indicators available for this widget (location + metricType KPI/KFI/KCI). */
  get locationIndicators(): Indicator[] {
    const w = this.data();
    const locId = w.locationId;
    const metricType = w.metricType;
    if (!locId || (metricType !== 'KPI' && metricType !== 'KFI' && metricType !== 'KCI')) return [];
    const loc = (this.locations ?? []).find((l) => (l.locationID ?? l.id) === locId);
    if (!loc?.performance?.categories?.length) return [];
    return loc.performance.categories
      .filter((c) => c.type === metricType)
      .flatMap((c) => c.indicators ?? []);
  }

  get selectedIndicatorId(): string | null {
    const id = this.data().selectedIndicatorId;
    return id ?? null;
  }

  /** Width (cols) clamped to widget min/max so toggle always shows a valid option (e.g. bar widgets only 3 or 4). */
  effectiveCols = computed(() => {
    const w = this.data();
    const min = w.minCols ?? 1;
    const max = w.maxCols ?? 4;
    const v = w.cols ?? 1;
    return Math.max(min, Math.min(max, v));
  });

  /** Height (rows) clamped to widget min/max so toggle always shows a valid option. */
  effectiveRows = computed(() => {
    const w = this.data();
    const min = w.minRows ?? 1;
    const max = w.maxRows ?? 4;
    const v = w.rows ?? 1;
    return Math.max(min, Math.min(max, v));
  });

  setSelectedIndicator(value: string | null) {
    this.store.updateWidget(this.data().id, {
      selectedIndicatorId: value ?? undefined,
      selectedIndicatorIds: undefined
    });
    this.appRef.tick();
  }

  /** True when this is a KPI/KFI/KCI location widget – show indicator dropdown. */
  isLocationMetricType(metricType: string | undefined): boolean {
    return metricType === 'KPI' || metricType === 'KFI' || metricType === 'KCI';
  }

  // Generic numeric range helper (unchanged)
  range(min?: number, max?: number): number[] {
    const start = min ?? 1;  // default min = 1
    const end   = max ?? 4;  // default max = 4
    if (start > end) return [];
    return Array.from({length: end - start + 1}, (_, i) => start + i);
  }

  /**
   * NOTE: With the new DB-driven standard the performance set
   * should *not* come from MOCK_LOCATIONS. You will want to
   * replace this getter with a call into your real service
   * once that endpoint is ready, for example:
   *
   *   this.performanceService.getByLocation(this.data().locationId)
   *
   * For now this is left as a placeholder so the component
   * still compiles.
   */
  get performanceData(): PerformanceSet[] {
    // TODO: hook into real DB-backed service
    return [];
  }

  store = inject(DashboardService);
  private appRef = inject(ApplicationRef);
  private readonly INDICATOR_KEY = 'current-indicator';

  constructor(private ls: LocalStorageService) {
    // When stored cols/rows are below min (e.g. bar width was 2, now min is 3), upgrade so grid reflects options
    effect(() => {
      if (!this.showOptions()) return;
      const w = this.data();
      const ec = this.effectiveCols();
      const er = this.effectiveRows();
      const updates: Partial<Widget> = {};
      if ((w.cols ?? 1) !== ec) updates.cols = ec;
      if ((w.rows ?? 1) !== er) updates.rows = er;
      if (Object.keys(updates).length) this.store.updateWidget(w.id, updates);
    });
  }

  /** Called when user picks a specific Indicator for this widget */
  protected updateIncicator(selected: Indicator) {
    this.indicator.set(selected);

    const locId = this.data().locationId || '';
    this.ls.setID(this.indicatorKeyFor(locId), JSON.stringify(selected));

    // Keep widget label in sync (matches WidgetCom behaviour)
    this.store.updateWidget(this.data().id, {
      label: selected?.name,
    });
  }

  /** Called when user changes view type (month/week/day) */
  protected updateViewType(view: string) {
    this.viewType.set(view);
    const locId = this.data().locationId || '';
    this.ls.setID(this.viewKeyFor(locId), JSON.stringify(view));
  }

  /** Called when user selects KPI / KFI / KCI for a location bar or gauge widget. */
  protected updateMetricType(metricType: 'KPI' | 'KFI' | 'KCI') {
    const w = this.data();
    const label = (w.label ?? '').replace(/^(KPI|KFI|KCI) - /, '').trim() || 'Location';
    this.store.updateWidget(w.id, { metricType, label: `${metricType} - ${label}` });
  }

  private indicatorKeyFor(locationId: string) {
    return `indicator:${locationId}`;
  }

  private viewKeyFor(locationId: string) {
    return `viewType:${locationId}`;
  }
}
