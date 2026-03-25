import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import {ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, takeUntil, tap } from 'rxjs/operators';

import { Panel } from '../panel/panel';
import { SmartChartComponent, type ChartDatum } from '../../NEW for implemnet/smart-chart/smart-chart';
import { AddressAlertDialog } from '../address-alert-dialog/address-alert-dialog';

import { CompanyService } from '../../Services/Company.service';
import { LocationType, PerformanceSet, Indicator, Alert, ActionTask } from '../Types';
import { WalkthroughRegistryService } from '../../Services/walkthrough-registry.service';

type HealthCounts = { Green: number; Amber: number; Red: number };

type ApiLocation = {
  id: string;
  companyId: string;
  name: string;
  type: string;
  icon?: string | null;
};

/** Display labels for account roles; only roles present in the company are shown in the UI */
const STAFF_ROLE_LABELS: Record<string, string> = {
  SystemAdmin: 'System Admin',
  OrgAdmin: 'Org Admin',
  RegisteredManager: 'Registered Manager',
  Supervisor: 'Supervisor',
  SeniorCareWorker: 'Senior Care Worker',
  CareWorker: 'Care Worker',
  Auditor: 'Auditor',
  Nurses: 'Nurses',
};
/** Order for listing roles; includes all known account role types (DB + legacy). */
const STAFF_ROLE_ORDER = [
  'SystemAdmin', 'OrgAdmin', 'RegisteredManager', 'Supervisor',
  'SeniorCareWorker', 'CareWorker', 'Auditor', 'Nurses',
];

@Component({
  selector: 'app-company',
  standalone: true,
  imports: [CommonModule, SmartChartComponent, MatDialogModule],
  templateUrl: './company.html',
  styleUrl: './company.css',
})
export class Company implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Stable fields for template
  companyId: string | null = null;
  companyName: string | null = null;

  // Locations (each will get .performance from DB)
  locations: LocationType[] = [];
  selectedLocation: LocationType | null = null;

  // Company-wide collections
  allAlerts: (Alert & { locationName?: string })[] = [];
  allTasks: ActionTask[] = [];
  allIndicators: (Indicator & { categoryType?: string; categoryTitle?: string; locationName?: string })[] = [];

  indicatorCounts: HealthCounts = { Green: 0, Amber: 0, Red: 0 };
  activeAlertsCount = 0;
  openTasksCount = 0;
  overdueTasksCount = 0;

  topRisks: (Indicator & { categoryType?: string; locationName?: string })[] = [];

  /** Accounts belonging to the current company (from DB); used for staff overview */
  companyAccounts: { id: string; name: string; role: string }[] = [];

  totalStaff = 0;
  staffRoleCounts: Record<string, number> = {};
  /** Roles that have at least one account in this company, with display label and count (for template) */
  staffRolesPresent: { role: string; label: string; count: number }[] = [];
  pieSeries: number[] = [];
  pieLabels: string[] = [];
  /** Per-segment names for pie chart tooltip (e.g. [['Josh','Matthew','Tom']] for Org Admin) */
  pieTooltipDetails: string[][] = [];

  loading = false;

  constructor(
    private companyService: CompanyService,
    private http: HttpClient,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private walkthrough: WalkthroughRegistryService
  ) {}

  ngOnInit(): void {
    this.walkthrough.register('/organization', [
      {
        targetId: 'company.companyHeader',
        title: 'Company header',
        description: 'This top card shows the selected company and its quick summary.',
      },
      {
        targetId: 'company.healthCard',
        title: 'Company health',
        description: 'A quick overview of active alerts, open tasks, and indicator levels.',
      },
      {
        targetId: 'company.topRisksCard',
        title: 'Top risks',
        description: 'The most important indicators to review first.',
      },
      {
        targetId: 'company.staffCard',
        title: 'Staff overview',
        description: 'See how many staff accounts exist for this company, broken down by role.',
      },
      {
        targetId: 'company.alertsCard',
        title: 'Alerts',
        description: 'Turn High/Critical alerts into tasks or ping the manager for attention.',
      },
      {
        targetId: 'company.tasksCard',
        title: 'Tasks',
        description: 'A list of open and overdue tasks for this company.',
      },
    ]);

    this.companyService.currentCompany$
      .pipe(
        takeUntil(this.destroy$),
        tap((c: any) => {
          // Accept both DB-shape {id,name} and legacy mock-shape {companyID,name}
          this.companyId = c?.id ?? c?.companyID ?? null;
          this.companyName = c?.name ?? null;
          // inside ngOnInit() after setting this.companyId
          if (this.companyId && !this.companyName) {
            this.http.get<any>(`/api/companies/${this.companyId}`).subscribe({
              next: (c) => (this.companyName = c?.name ?? this.companyName),
              error: () => {},
            });
          }

        }),
        switchMap(() => {
          if (!this.companyId) {
            this.locations = [];
            this.selectedLocation = null;
            this.companyAccounts = [];
            return of(null);
          }
          return this.loadCompanyData(this.companyId);
        })
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Keep old template working: *ngIf="company as c"
  get company(): any {
    return this.companyId ? { id: this.companyId, name: this.companyName } : null;
  }

  /** Pie chart data for SmartChart (label + value from pieLabels/pieSeries). */
  get pieChartData(): ChartDatum[] {
    if (!this.pieLabels?.length) return [];
    return this.pieLabels.map((label, i) => ({ label, value: this.pieSeries[i] ?? 0 }));
  }

  onLocationChange(location: LocationType) {
    this.selectedLocation = location;
  }

  private loadCompanyData(companyId: string) {
    this.loading = true;
    const params = new HttpParams().set('companyId', companyId);

    const locations$ = this.http.get<ApiLocation[]>('/api/locations', { params }).pipe(
      catchError(() => of([] as ApiLocation[])),
      switchMap((apiLocs) => {
        const baseLocs: LocationType[] = (apiLocs ?? []).map((l) => ({
          cmpID: l.companyId,
          locationID: l.id,
          name: l.name,
          type: (l.type === 'CareHome' || l.type === 'HomeCare' ? l.type : 'CareHome') as any,
          icon: l.icon ?? undefined,
          performance: this.emptyPerformance(),
        }));

        if (!baseLocs.length) return of([] as LocationType[]);

        const calls = baseLocs.map((loc) => {
          const locationId = loc.locationID ?? loc.id ?? '';
          const p = new HttpParams().set('locationId', locationId);

          // GET /api/performanceSets?locationId=... returns array; newest first [file:35]
          return this.http.get<any[]>('/api/performanceSets', { params: p }).pipe(
            catchError(() => of([] as any[])),
            map((sets) => (Array.isArray(sets) && sets.length ? sets[0] : null)),
            map((set): LocationType => ({
              ...loc,
              performance: set
                ? ({
                  id: set.id,
                  period: set.period,
                  createdAt: set.createdAt ?? new Date().toISOString(),
                  categories: set.categories ?? [],
                  alerts: set.alerts ?? [],
                  tasks: set.tasks ?? [],
                } as PerformanceSet)
                : this.emptyPerformance(),
            }))
          );
        });

        return forkJoin(calls);
      })
    );

    const accounts$ = this.http
      .get<{ id: string; name: string; role: string }[]>('/api/accounts', { params: { companyId } })
      .pipe(catchError(() => of([] as { id: string; name: string; role: string }[])));

    return forkJoin({ locations: locations$, accounts: accounts$ }).pipe(
      tap(({ locations: locsWithPerf, accounts }) => {
        this.locations = locsWithPerf ?? [];
        this.selectedLocation = this.locations[0] ?? null;
        this.companyAccounts = accounts ?? [];
        this.recomputeCompanyWide();
        this.cdr.detectChanges();
        this.loading = false;
      }),
      catchError(() => {
        this.locations = [];
        this.selectedLocation = null;
        this.companyAccounts = [];
        this.loading = false;
        return of(null);
      })
    );
  }

  private emptyPerformance(): PerformanceSet {
    return {
      id: '',
      period: '',
      createdAt: new Date(0).toISOString(),
      categories: [],
      alerts: [],
      tasks: [],
    };
  }

  private recomputeCompanyWide(): void {
    this.computeStaffCompanyWide();
    this.collectAlertsTasksIndicators();
    this.computeHealthSummary();
    this.computeTopRisks();
    this.preparePieChart();
  }

  private computeStaffCompanyWide(): void {
    // Staff overview is based on accounts in the DB for this company (companyAccounts), not location.staff
    const staff = this.companyAccounts;
    this.totalStaff = staff.length;

    const byRole: Record<string, number> = {};
    for (const s of staff) {
      byRole[s.role] = (byRole[s.role] ?? 0) + 1;
    }
    this.staffRoleCounts = { ...byRole };

    // Only show role types that are currently present in the company (ordered list + any extra from API)
    const ordered = STAFF_ROLE_ORDER
      .filter((role) => (byRole[role] ?? 0) > 0)
      .map((role) => ({ role, label: STAFF_ROLE_LABELS[role] ?? role, count: byRole[role] ?? 0 }));
    const otherRoles = Object.keys(byRole)
      .filter((role) => !STAFF_ROLE_ORDER.includes(role))
      .map((role) => ({ role, label: STAFF_ROLE_LABELS[role] ?? role, count: byRole[role] ?? 0 }));
    this.staffRolesPresent = [...ordered, ...otherRoles];
  }

  private preparePieChart(): void {
    this.pieLabels = this.staffRolesPresent.map((r) => r.label);
    this.pieSeries = this.staffRolesPresent.map((r) => r.count);
    this.pieTooltipDetails = this.staffRolesPresent.map((r) =>
      this.companyAccounts.filter((a) => a.role === r.role).map((a) => a.name)
    );
  }

  private collectAlertsTasksIndicators(): void {
    this.allAlerts = this.locations.flatMap((loc) =>
      (loc.performance?.alerts ?? []).map((a) => ({ ...a, locationName: loc.name }))
    );

    this.allTasks = this.locations.flatMap((loc) => loc.performance?.tasks ?? []);

    this.allIndicators = this.locations.flatMap((loc) => {
      const cats = loc.performance?.categories ?? [];
      return cats.flatMap((cat) =>
        (cat.indicators ?? []).map((ind) => ({
          ...ind,
          categoryType: cat.type,
          categoryTitle: cat.title,
          locationName: loc.name,
        }))
      );
    });

    this.activeAlertsCount = this.allAlerts.filter((a) => a.active).length;
    this.openTasksCount = this.allTasks.filter((t) => t.status === 'Open' || t.status === 'InProgress').length;

    const now = Date.now();
    this.overdueTasksCount = this.allTasks.filter((t) => {
      const due = new Date(t.dueDate).getTime();
      const isOpen = t.status === 'Open' || t.status === 'InProgress';
      return isOpen && !Number.isNaN(due) && due < now;
    }).length;
  }

  private computeHealthSummary(): void {
    const counts: HealthCounts = { Green: 0, Amber: 0, Red: 0 };
    for (const ind of this.allIndicators) {
      if (ind.status === 'Green') counts.Green++;
      else if (ind.status === 'Amber') counts.Amber++;
      else if (ind.status === 'Red') counts.Red++;
    }
    this.indicatorCounts = counts;
  }

  private computeTopRisks(): void {
    const severityRank = (s?: string) => (s === 'Red' ? 1 : s === 'Amber' ? 2 : 3);

    this.topRisks = [...this.allIndicators]
      .sort((a, b) => {
        const r = severityRank(a.status) - severityRank(b.status);
        if (r !== 0) return r;
        const diffA = Math.abs((a.current ?? 0) - (a.target ?? 0));
        const diffB = Math.abs((b.current ?? 0) - (b.target ?? 0));
        return diffB - diffA;
      })
      .slice(0, 3);
  }

  hasTask(alert: Alert): boolean {
    return this.allTasks.some((t) => t.alertId === alert.id);
  }

  openAddressDialog(alert: any): void {
    const dialogRef = this.dialog.open(AddressAlertDialog, {
      width: '420px',
      data: alert,
    });

    dialogRef.afterClosed().subscribe(() => {
      // To persist: PATCH /api/performanceSets/:id with updated tasks [file:35]
    });
  }

  pingManager(alert: any): void {
    console.log('Ping manager requested for alert:', alert?.id, 'location:', alert?.locationName ?? alert?.location);
  }

  isOverdue(t: { dueDate: string; status: string }): boolean {
    const isOpen = t.status === 'Open' || t.status === 'InProgress';
    if (!isOpen) return false;

    const due = new Date(t.dueDate).getTime();
    if (Number.isNaN(due)) return false;

    return due < Date.now();
  }

  /** Map API status (Green/Amber/Red) to indicator class (light/mid/high) for monochromatic styling */
  indicatorLevel(status: string): 'light' | 'mid' | 'high' {
    if (status === 'Green') return 'light';
    if (status === 'Amber') return 'mid';
    return 'high';
  }

  indicatorLabel(status: string): string {
    if (status === 'Green') return 'Light';
    if (status === 'Amber') return 'Mid';
    return 'High';
  }

  trackById(_: number, x: any) {
    return x?.id;
  }
}
