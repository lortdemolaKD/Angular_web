import { AfterViewInit, Component, ElementRef, inject, Inject, OnInit, PLATFORM_ID, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WidgetCom } from '../widgetCOM/widgetCom';
import { CompanyType, LocationType, UserType, Widget, Role, PerformanceSet } from '../Types';

const ORG_ADMIN_LIKE: Role[] = ['SystemAdmin', 'OrgAdmin'];
const LOCATION_MANAGER_LIKE: Role[] = ['RegisteredManager', 'Supervisor'];
/** Roles that are fixed to one location (no company/location switcher; dashboard shows only their location) */
const LOCATION_SCOPED_ROLES: Role[] = ['Supervisor', 'CareWorker', 'SeniorCareWorker', 'Auditor'];

import { DashboardService } from '../../Services/dashboard-service';
import { MatButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { wrapGrid } from 'animate-css-grid';
import { CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { CompanyService } from '../../Services/Company.service';
import { AuthService } from '../../Services/Auth.service';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { LocalStorageService } from '../../Services/LocalStorage.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { LocationService } from '../../Services/location.service';
import { performanceNeedsAuditRecalc } from '../../utils/performance-audit.helper';
import { catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';

type ApiCompany = { id: string; name: string; icon?: string | null; bannerUrl?: string | null };
type ApiLocation = { id: string; companyId: string; name: string; type: string; icon?: string | null };

function toCompanyType(c: ApiCompany): CompanyType {
  return { _id: c.id, name: c.name, icon: c.icon ?? undefined, bannerUrl: c.bannerUrl ?? undefined };
}

function toLocationType(l: ApiLocation): LocationType {
  return {
    id: l.id,
    locationID: l.id,
    name: l.name,
    type: l.type as 'CareHome' | 'HomeCare',
    companyId: l.companyId,
  };
}

const emptyPerformance = (): PerformanceSet => ({
  id: '',
  period: '',
  createdAt: new Date(0).toISOString(),
  categories: [],
  alerts: [],
  tasks: [],
});

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    WidgetCom,
    MatButton,
    MatIconModule,
    MatMenuModule,
    CdkDropList,
    CdkDropListGroup,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  providers: [DashboardService],
})
export class Dashboard implements AfterViewInit, OnInit {
  protected readonly store = inject(DashboardService);

  /** When false (default): view mode – widgets cannot be moved and settings are hidden. Button shows gear. When true: edit mode – widgets draggable and settings available. Button shows eye. */
  editMode = signal(false);

  /** Wide image from current company; shown under the dashboard header */
  companyBannerUrl = signal<string | null>(null);

  toggleEditMode(): void {
    this.editMode.update((v) => !v);
  }

  @ViewChild('dashboard', { read: ElementRef }) dashboard!: ElementRef;

  // TrackBy function for performance
  trackById(index: number, widget: Widget): number {
    return widget.id;
  }

  ngAfterViewInit(): void {
    if (this.dashboard?.nativeElement instanceof HTMLElement) {
      const el = this.dashboard.nativeElement;
      setTimeout(() => {
        wrapGrid(el, { duration: 300 });
      }, 0);
    }
  }

  protected drop(event: CdkDragDrop<number, any>) {
    const { previousContainer, container } = event;
    this.store.updateWidgetPosition(previousContainer.data, container.data);
  }

  user!: UserType | null;
  isOrgAdmin = false;

  /** location-level dashboards/widgets */
  isLocationManager = false;

  /** Non-admins (CareWorker, SeniorCareWorker, Auditor) cannot create tasks */
  get canCreateTask(): boolean {
    const r = this.user?.role as Role | undefined;
    return !!r && ['SystemAdmin', 'OrgAdmin', 'RegisteredManager', 'Supervisor'].includes(r);
  }
  ComElements: CompanyType[] = [];
  LocElements: LocationType[] = [];
  get roleLabel(): string {
    const r = this.user?.role as Role | undefined;
    if (!r) return '—';
    if (r === 'SystemAdmin') return 'System Administrator';
    if (r === 'OrgAdmin') return 'Organization Administrator';
    if (r === 'RegisteredManager') return 'Registered Manager';
    if (r === 'Supervisor') return 'Supervisor';
    if (r === 'SeniorCareWorker') return 'Senior Care Worker';
    if (r === 'CareWorker') return 'Care Worker';
    if (r === 'Auditor') return 'Auditor';
    return r;
  }

  // This will now sync with the service's signal
  selectedElementId?: string;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private companyService: CompanyService,
    private ls: LocalStorageService,
    private authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private http: HttpClient,
    private locationService: LocationService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    this.user = user;
    const role = user.role as Role;
    this.isOrgAdmin = ORG_ADMIN_LIKE.includes(role);
    this.isLocationManager = LOCATION_MANAGER_LIKE.includes(role);
    const isLocationScoped = LOCATION_SCOPED_ROLES.includes(role);
    const userLocationId = (user as { locationId?: string | null }).locationId ?? this.ls.getID('locationID');
    this.selectedElementId =
      isLocationScoped && userLocationId
        ? userLocationId
        : this.ls.getID('companyID') || this.ls.getID('locationID') || undefined;

    if (this.isOrgAdmin) {
      this.loadCompaniesAndLocations();
      this.companyService.currentCompany$.subscribe(() => this.loadLocationsForCurrentCompany());
      return;
    }

    // Location-scoped users: load their company and all its locations (or my locations)
    this.loadCompaniesAndLocations();
  }

  /** Load performance sets for each location so risks/tasks/alerts widgets have data. */
  private hydrateLocationsWithPerformance(locs: LocationType[]) {
    if (!locs.length) return of([] as LocationType[]);
    const calls = locs.map((loc) => {
      const locationId = loc.locationID ?? loc.id ?? '';
      const params = new HttpParams().set('locationId', locationId);
      return this.http.get<PerformanceSet[]>(`/api/performanceSets`, { params }).pipe(
        catchError((err) => {
          console.warn('[Dashboard] Failed to load performance set for location', locationId, err?.status ?? err);
          return of([]);
        }),
        map((sets) => (Array.isArray(sets) && sets.length ? sets[0] : null)),
        map((set): LocationType => {
          const hasKpi = (set?.categories ?? []).some((c) => c.type === 'KPI');
          if (!set && locationId) {
            console.warn('[Dashboard] No performance set for location', locationId, '- KPIs will be empty. Create/sync a set for this location.');
          } else if (set && !hasKpi) {
            console.warn('[Dashboard] Performance set for location', locationId, 'has no KPI category - sync from template or check seed.');
          }
          return {
            ...loc,
            performance: set
              ? {
                  id: set.id,
                  period: set.period ?? '',
                  createdAt: set.createdAt ?? new Date(0).toISOString(),
                  categories: set.categories ?? [],
                  alerts: set.alerts ?? [],
                  tasks: set.tasks ?? [],
                }
              : emptyPerformance(),
          };
        })
      );
    });
    return forkJoin(calls).pipe(
      switchMap((hydrated) => this.backfillAuditPerformanceForMonitored(hydrated as LocationType[]))
    );
  }

  /** When locations have audit-sourced KPIs with no history yet, run the same recalc as Key metrics (no manual button). Not limited to monitored IDs: monitoredLocationIds may still be loading from GET /api/dashboard/me while hydration runs. */
  private backfillAuditPerformanceForMonitored(locs: LocationType[]) {
    if (!this.authService.isAdmin()) return of(locs);
    const need = locs.filter((loc) => {
      const p = loc.performance;
      if (!p?.id || !p.categories?.length) return false;
      return performanceNeedsAuditRecalc(p.categories);
    });
    if (!need.length) return of(locs);
    const params = new HttpParams().set('fullYear', 'true');
    return forkJoin(
      need.map((loc) =>
        this.http
          .post<PerformanceSet>(`/api/performanceSets/${loc.performance!.id}/recalculate-from-audits`, {}, { params })
          .pipe(
            map((updated) => this.mergeLocationPerformance(loc, updated)),
            catchError(() => of(loc))
          )
      )
    ).pipe(
      map((updatedLocs) => {
        const byId = new Map(updatedLocs.map((l) => [l.locationID ?? l.id, l]));
        return locs.map((l) => byId.get(l.locationID ?? l.id) ?? l);
      })
    );
  }

  private mergeLocationPerformance(loc: LocationType, updated: PerformanceSet): LocationType {
    return {
      ...loc,
      performance: {
        id: updated.id,
        period: updated.period ?? '',
        createdAt: updated.createdAt ?? new Date(0).toISOString(),
        categories: updated.categories ?? [],
        alerts: updated.alerts ?? [],
        tasks: updated.tasks ?? [],
      },
    };
  }

  /** Load companies (admin: all; else: me) then locations for the current company. */
  private loadCompaniesAndLocations() {
    if (this.isOrgAdmin) {
      this.http
        .get<ApiCompany[]>('/api/companies')
        .pipe(
          catchError(() => of([])),
          tap((companies) => {
            this.ComElements = (companies ?? []).map(toCompanyType);
            const companyId = this.ls.getID('companyID') || (companies?.[0] as ApiCompany | undefined)?.id;
            const c = (companies ?? []).find((x) => x.id === companyId);
            this.companyBannerUrl.set(c?.bannerUrl ?? null);
          }),
          switchMap((companies) => {
            const companyId = this.ls.getID('companyID') || (companies?.[0] as ApiCompany | undefined)?.id;
            if (!companyId) return of([] as ApiLocation[]);
            return this.http.get<ApiLocation[]>(`/api/locations?companyId=${encodeURIComponent(companyId)}`).pipe(catchError(() => of([])));
          }),
          switchMap((locs) => {
            const locationTypes = (locs ?? []).map(toLocationType);
            return this.hydrateLocationsWithPerformance(locationTypes);
          }),
          tap((hydrated) => {
            this.LocElements = hydrated;
          })
        )
        .subscribe();
      return;
    }

    // Non-admin: try /api/companies/me first; if 404 (e.g. care workers), fall back to /api/locations/me
    const role = this.user?.role as Role | undefined;
    const isLocationScoped = role ? LOCATION_SCOPED_ROLES.includes(role) : false;
    const userLocationId = (this.user as { locationId?: string | null }).locationId ?? this.ls.getID('locationID');

    this.http
      .get<ApiCompany>('/api/companies/me')
      .pipe(
        catchError(() => of(null)),
        switchMap((company) => {
          if (company) {
            this.ComElements = [toCompanyType(company)];
            this.companyBannerUrl.set(company.bannerUrl ?? null);
            return this.locationService.list(company.id).pipe(
              catchError(() => of([])),
              map((locs) =>
                (locs ?? []).map((l) =>
                  toLocationType({ id: l.id, companyId: l.companyId, name: l.name, type: l.type })
                )
              )
            );
          }
          // 404 or no company: load locations via assigned endpoint (care workers etc.)
          this.companyBannerUrl.set(null);
          return this.locationService.listMyAssigned().pipe(
            catchError(() => of([])),
            map((locs) =>
              (locs ?? []).map((l) =>
                toLocationType({ id: l.id, companyId: l.companyId, name: l.name, type: l.type })
              )
            )
          );
        }),
        switchMap((locationTypes) => this.hydrateLocationsWithPerformance(locationTypes)),
        tap((hydrated) => {
          if (isLocationScoped && userLocationId && hydrated.length) {
            const onlyMine = hydrated.filter(
              (loc) => (loc.locationID ?? loc.id) === userLocationId
            );
            this.LocElements = onlyMine.length ? onlyMine : hydrated;
          } else {
            this.LocElements = hydrated;
          }
          // Set current location from data so we never call GET /api/locations/:id (avoids 403 for care workers)
          if (this.LocElements.length > 0) {
            const loc = userLocationId
              ? this.LocElements.find((l) => (l.locationID ?? l.id) === userLocationId) ?? this.LocElements[0]
              : this.LocElements[0];
            const id = loc.locationID ?? loc.id ?? '';
            if (id) this.companyService.setCurrentLocation(id, loc);
          }
        })
      )
      .subscribe();
  }

  /** Reload locations when admin switches company (e.g. from navbar). */
  private loadLocationsForCurrentCompany() {
    const companyId = this.companyService.getCurrentCompany()?._id ?? this.ls.getID('companyID');
    if (!companyId) return;
    this.http
      .get<ApiCompany>(`/api/companies/${encodeURIComponent(companyId)}`)
      .pipe(
        catchError(() => of(null)),
        tap((co) => this.companyBannerUrl.set(co?.bannerUrl ?? null)),
        switchMap(() =>
          this.http.get<ApiLocation[]>(`/api/locations?companyId=${encodeURIComponent(companyId)}`).pipe(catchError(() => of([])))
        ),
        switchMap((locs) => {
          const locationTypes = (locs ?? []).map(toLocationType);
          return this.hydrateLocationsWithPerformance(locationTypes);
        }),
        tap((hydrated) => {
          this.LocElements = hydrated;
        })
      )
      .subscribe();
  }

  /* -------------------- Monitor Logic (Updated for DB) -------------------- */

  toggleMonitor(id: string) {
    const currentSet = new Set(this.store.monitoredLocationIds());
    let removedId: string | undefined;

    if (currentSet.has(id)) {
      currentSet.delete(id);
      removedId = id;
    } else {
      currentSet.add(id);
    }

    const nextIds = Array.from(currentSet);

    // 1. Save changes to DB
    this.store.saveMonitoredLocations(nextIds, removedId).subscribe(() => {
      // 2. If added, generate widgets
      if (!removedId) {
        // Find the full location object in the loaded Location Elements
        const locationObj = this.LocElements.find((l) => (l.locationID ?? l.id) === id);

        if (locationObj) {
          const locId = locationObj.locationID ?? locationObj.id ?? '';
          this.store.addLocationWidgets([{
            id: locId,
            name: locationObj.name
          }]);
        } else {
          console.warn(`Location with ID ${id} not found in LocElements, cannot generate widgets.`);
        }
      }
    });
  }


  isMonitored(id: string): boolean {
    return this.store.monitoredLocationIds().includes(id);
  }
}
