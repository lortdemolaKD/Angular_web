import {Component, computed, input, signal} from '@angular/core';
import {Indicator, IndicatorHistoryPoint, LocationType} from '../../Types';
import {BarChartMarkers} from '../../bar-chart-markers/bar-chart-markers';
import {PieChart} from '../../pie-chart/pie-chart';
import {CommonModule, NgFor, NgIf} from '@angular/common';
type IndicatorRow = {
  indicator: Indicator;
  locationName: string;
  categoryType: string; // KPI/KFI/KCI
};

@Component({
  selector: 'app-widget-risk-overview',
  imports: [CommonModule, NgIf, NgFor, ],
  templateUrl: './widget-risk-overview.html',
  styleUrl: './widget-risk-overview.css',
})
export class WidgetRiskOverview {
  // Keep this input name so WidgetCom can pass it automatically
  LocElements = input<LocationType[]>([]);

  // Optional: filter to one location (if you want a per-location version too)
  locationId = input<string | undefined>(undefined);

  selectedIndicatorId = signal<string | null>(null);

  readonly rows = computed<IndicatorRow[]>(() => {
    const locId = this.locationId();
    const locs = (this.LocElements() ?? []).filter(l => !locId || l.locationID === locId);

    return locs.flatMap(loc =>
      (loc.performance?.categories ?? []).flatMap(cat =>
        (cat.indicators ?? []).map(ind => ({
          indicator: ind,
          locationName: loc.name,
          categoryType: cat.type,
        }))
      )
    );
  });

  readonly statusCounts = computed(() => {
    const counts = { Green: 0, Amber: 0, Red: 0 };
    for (const r of this.rows()) {
      if (r.indicator.status === 'Green') counts.Green += 1;
      else if (r.indicator.status === 'Amber') counts.Amber += 1;
      else if (r.indicator.status === 'Red') counts.Red += 1;
    }
    return counts;
  });

  readonly statusSeries = computed(() => {
    const c = this.statusCounts();
    return [c.Green, c.Amber, c.Red];
  });

  readonly statusLabels = ['Green', 'Amber', 'Red'];

  readonly topRisks = computed<IndicatorRow[]>(() => {
    const severityRank = (s: string) => (s === 'Red' ? 1 : s === 'Amber' ? 2 : 3);

    return [...this.rows()]
      .sort((a, b) => {
        const r = severityRank(a.indicator.status) - severityRank(b.indicator.status);
        if (r !== 0) return r;

        const diffA = Math.abs((a.indicator.current ?? 0) - (a.indicator.target ?? 0));
        const diffB = Math.abs((b.indicator.current ?? 0) - (b.indicator.target ?? 0));
        return diffB - diffA;
      })
      .slice(0, 5);
  });

  readonly selectedRow = computed<IndicatorRow | null>(() => {
    const id = this.selectedIndicatorId();
    const list = this.topRisks();
    if (!list.length) return null;
    if (!id) return list[0];
    return list.find(x => x.indicator.id === id) ?? list[0];
  });

  /** Bar chart shows last 12 months only. */
  private lastYearOfHistory(history: IndicatorHistoryPoint[]): IndicatorHistoryPoint[] {
    if (!history?.length) return [];
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const parseDate = (d: string): Date => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(d);
      if (/^\d{4}-\d{2}$/.test(d)) return new Date(d + '-01');
      return new Date(d);
    };
    return history.filter((h) => parseDate(h.date) >= oneYearAgo);
  }

  // Trend chart data for BarChartMarkers (one year)
  readonly chartCategories = computed(() => {
    const h = this.lastYearOfHistory(this.selectedRow()?.indicator.history ?? []);
    return h.map(p => p.date);
  });

  readonly chartSeries = computed(() => {
    const h = this.lastYearOfHistory(this.selectedRow()?.indicator.history ?? []);
    return h.map(p => p.value);
  });

  readonly chartTargets = computed<number[] | null>(() => {
    const t = this.selectedRow()?.indicator.target;
    return t == null ? null : [t];
  });
  readonly chartMarkers = computed(() => {
    const ind = this.selectedRow()?.indicator;
    if (!ind) return [];
    const values = this.chartSeries();
    const out: number[] = [];
    values.forEach((val, idx) => {
      if (this.isBreach(ind, val)) out.push(idx);
    });
    return out;
  });

  // Mirrors the approach already used to decide “breach” direction based on unit/name hints
  private isBreach(indicator: Indicator, value: number): boolean {
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

  selectIndicator(id: string) {
    this.selectedIndicatorId.set(id);
  }
}
