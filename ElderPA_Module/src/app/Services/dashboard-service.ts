import { computed, effect, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, tap, finalize } from 'rxjs';

import { Widget } from '../components/Types';
import { WIDGET_COMPONENTS } from '../components/Wigets/widget-registry';

// Define a simple type for the input to avoid circular dependency on full LocationType if not needed
interface LocationInfo {
  id: string;
  name: string;
}

type DashboardMeResponse = {
  widgets: Widget[];
  monitoredLocationIds: string[];
};

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly API_BASE = '/api/dashboard';

  // State: Raw data from DB
  private _rawWidgets = signal<Widget[]>([]);
  private isLoaded = signal(false);

  // DB-backed monitored locations
  monitoredLocationIds = signal<string[]>([]);

  // Library of available widgets
  widgets = signal<Widget[]>([
    { id: 3, label: 'Alerts', contentKey: 'alerts', rows: 2, cols: 2, minCols: 2, maxCols: 2, minRows: 2, maxRows: 4 },
    { id: 5, label: 'Companies', contentKey: 'location', rows: 2, cols: 1, minCols: 1, maxCols: 1, minRows: 2, maxRows: 4, backgroundColor: '#b4e0f3', color: '#101010' },
    { id: 6, label: 'Tasks', contentKey: 'tasksBoard', rows: 2, cols: 2, minCols: 2, minRows: 2, maxCols: 4, maxRows: 4 },
    { id: 7, label: 'Governance', contentKey: 'governancePlanner', rows: 3, cols: 2, minCols: 2, minRows: 3, maxCols: 4, maxRows: 4 },
    { id: 8, label: 'Audit completion', contentKey: 'auditCompletion', rows: 2, cols: 1, minCols: 1, minRows: 2, maxCols: 2, maxRows: 2 },
    { id: 9, label: 'Risk overview', contentKey: 'riskOverview', rows: 2, cols: 2, minCols: 2, minRows: 2, maxCols: 4, maxRows: 4 },
    { id: 10, label: 'Company summary', contentKey: 'locationsSummary', rows: 1, cols: 1, minCols: 1, maxCols: 2, minRows: 1, maxRows: 2, backgroundColor: '#e3f2fd', color: '#0d47a1' },
    { id: 11, label: 'Open alerts', contentKey: 'alertsCount', rows: 1, cols: 1, minCols: 1, maxCols: 1, minRows: 1, maxRows: 2, backgroundColor: '#ffebee', color: '#b71c1c' },
    { id: 12, label: 'Open tasks', contentKey: 'tasksCount', rows: 1, cols: 1, minCols: 1, maxCols: 1, minRows: 1, maxRows: 2, backgroundColor: '#fff3e0', color: '#e65100' },
    { id: 13, label: 'Company snapshot', contentKey: 'companySnapshot', rows: 1, cols: 1, minCols: 1, maxCols: 2, minRows: 1, maxRows: 2, backgroundColor: '#f3e5f5', color: '#4a148c' },
    { id: 14, label: 'Indicator summary', contentKey: 'indicatorSummary', rows: 1, cols: 2, minCols: 1, maxCols: 2, minRows: 1, maxRows: 2, backgroundColor: '#e8f5e9', color: '#1b5e20' },
  ]);

  // View: Hydrated widgets
  addedWidgets = computed(() => {
    return this._rawWidgets().map(w => ({
      ...w,
      content: WIDGET_COMPONENTS[w.contentKey] ?? null,
    }));
  });

  // UI helper
  widgetsToAdd = computed(() => {
    const addedIds = this._rawWidgets().map(w => w.id);
    return this.widgets().filter((w) => !addedIds.includes(w.id));
  });

  constructor(private http: HttpClient) {
    this.loadFromDb();

    // Persist to DB
    effect(() => {
      const currentWidgets = this._rawWidgets();
      const loaded = this.isLoaded();

      if (!loaded) return;

      const payload = this.stripContent(currentWidgets);

      this.http.put<DashboardMeResponse>(`${this.API_BASE}/me`, { widgets: payload })
        .pipe(catchError(() => of(null)))
        .subscribe();
    });
  }

  /* -------------------- DB load -------------------- */
  private loadFromDb() {
    this.http.get<DashboardMeResponse>(`${this.API_BASE}/me`)
      .pipe(
        tap((res) => {
          if (!res) return;
          this.monitoredLocationIds.set(res.monitoredLocationIds ?? []);
          if (Array.isArray(res.widgets)) {
            this._rawWidgets.set(res.widgets);
          }
        }),
        catchError(() => of(null)),
        finalize(() => this.isLoaded.set(true))
      )
      .subscribe();
  }

  /* -------------------- Data Helpers -------------------- */
  private stripContent(widgets: Widget[]): Partial<Widget>[] {
    return widgets.map((w) => {
      const { content, ...rest } = w;
      return rest;
    });
  }

  /* -------------------- Widget Actions -------------------- */
  addWidget(w: Widget) {
    const { content, ...cleanWidget } = w;
    this._rawWidgets.update(current => [...current, { ...cleanWidget } as Widget]);
  }

  updateWidget(id: number, patch: Partial<Widget>) {
    this._rawWidgets.update(current => {
      const index = current.findIndex(w => w.id === id);
      if (index === -1) return current;
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  removeWidget(id: number) {
    this._rawWidgets.update(current => current.filter(w => w.id !== id));
  }

  moveWidgetToRight(id: number) {
    this._rawWidgets.update(current => {
      const index = current.findIndex(w => w.id === id);
      if (index === -1 || index === current.length - 1) return current;
      const next = [...current];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  moveWidgetToLeft(id: number) {
    this._rawWidgets.update(current => {
      const index = current.findIndex(w => w.id === id);
      if (index <= 0) return current;
      const next = [...current];
      [next[index], next[index - 1]] = [next[index - 1], next[index]];
      return next;
    });
  }

  updateWidgetPosition(source: number, target: number) {
    this._rawWidgets.update(current => {
      const sourceIndex = current.findIndex(w => w.id === source);
      if (sourceIndex === -1) return current;

      const next = [...current];
      const [sourceWidget] = next.splice(sourceIndex, 1);

      const targetIndex = next.findIndex(w => w.id === target);
      // If target not found, append to end
      if (targetIndex === -1) {
        next.push(sourceWidget);
        return next;
      }

      const insertAt = targetIndex >= sourceIndex ? targetIndex : targetIndex;
      next.splice(insertAt, 0, sourceWidget);
      return next;
    });
  }

  /* -------------------- monitored locations (DB) -------------------- */
  saveMonitoredLocations(nextIds: string[], removedLocationId?: string) {
    this.monitoredLocationIds.set(nextIds);

    if (removedLocationId) {
      this._rawWidgets.update(current =>
        current.filter(w => !(w as any).isAuto || w.locationId !== removedLocationId)
      );
    }

    return this.http.put<DashboardMeResponse>(`${this.API_BASE}/me/monitored-locations`, {
      monitoredLocationIds: nextIds,
      removedLocationId: removedLocationId ?? null,
    }).pipe(
      tap((res) => {
        if (!res) return;
        if (res.monitoredLocationIds) this.monitoredLocationIds.set(res.monitoredLocationIds);
        if (res.widgets) this._rawWidgets.set(res.widgets);
      })
    );
  }

  /* -------------------- Location Widgets (Updated) -------------------- */
  // Three bar charts per monitored location: KPI, KFI, KCI. User selects which indicators in options.
  addLocationWidgets(locations: LocationInfo[]) {
    const currentWidgets = this._rawWidgets();
    const next = [...currentWidgets];

    locations.forEach((loc, index) => {
      const baseId = Date.now() + index * 100;
      const shortName = loc.name.includes('.') ? loc.name.substring(loc.name.lastIndexOf('.') + 1) : loc.name;

      next.push(
        {
          id: baseId,
          contentKey: 'bar',
          rows: 2,
          cols: 2,
          minCols: 2,
          maxCols: 4,
          minRows: 2,
          maxRows: 4,
          backgroundColor: '#003f5c',
          color: '#fff5ec',
          metricType: 'KPI',
          locationId: loc.id,
          label: `KPI - ${shortName}`,
          isAuto: true,
        } as Widget,
        {
          id: baseId + 1,
          contentKey: 'bar',
          rows: 2,
          cols: 2,
          minCols: 2,
          maxCols: 4,
          minRows: 2,
          maxRows: 4,
          backgroundColor: '#1b5e20',
          color: '#e8f5e9',
          metricType: 'KFI',
          locationId: loc.id,
          label: `KFI - ${shortName}`,
          isAuto: true,
        } as Widget,
        {
          id: baseId + 2,
          contentKey: 'bar',
          rows: 2,
          cols: 2,
          minCols: 2,
          maxCols: 4,
          minRows: 2,
          maxRows: 4,
          backgroundColor: '#0d47a1',
          color: '#e3f2fd',
          metricType: 'KCI',
          locationId: loc.id,
          label: `KCI - ${shortName}`,
          isAuto: true,
        } as Widget
      );
    });

    this._rawWidgets.set(next);
  }
}
