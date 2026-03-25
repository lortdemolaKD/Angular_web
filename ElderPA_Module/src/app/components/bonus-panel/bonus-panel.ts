import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, filter, map, switchMap, takeUntil, tap } from 'rxjs/operators';

import { Panel } from '../panel/panel';
import {CompanyType, LocationType, PerformanceSet, Role, UserType} from '../Types';

import { BonusService } from '../../Services/bonus.service';
import { CompanyService } from '../../Services/Company.service';
import { AuthService } from '../../Services/Auth.service';
import { LocalStorageService } from '../../Services/LocalStorage.service';
import { LocationService } from '../../Services/location.service';
import { WalkthroughRegistryService } from '../../Services/walkthrough-registry.service';
import { AuditService } from '../../Services/audit.service';
import {CQCTest} from '../cqctest/cqctest';
import { AuditInstance, AuditQuestionInstance } from '../Types';

type RoleOrNull = Role | null;
const isOrgAdminLike = (r: Role) => r === 'SystemAdmin' || r === 'OrgAdmin';
const isCompanyManagerLike = (r: Role) => r === 'RegisteredManager' || r === 'Supervisor';
const isLocationScoped = (r: Role) => r === 'CareWorker' || r === 'SeniorCareWorker' || r === 'Auditor';
type ApiLocation = {
  id: string;
  companyId: string;
  name: string;
  type: string;
  icon?: string | null;
  address?: string | null;
  contactInfo?: string | null;
  primaryManager?: string | null;
  areas?: string[];
  wings?: string[];
  rooms?: any[];
  roomGroups?: any[];
  clientGroups?: any[];
  homeCareMetrics?: any;
  stats?: any;
};

interface SpendItem {
  id: number;
  label: string;
  amount: number;
  createdAt: string;
}

interface BonusPotState {
  currentMonth: number;
  monthlyDeposits: number[];
  totalAccumulated: number;
}

interface BonusLineView {
  role: string;
  basePercent: number;
  financialScore: number;
  stakeholderScore: number;
  productivityScore: number;
  autoBonusPercent: number;
  manualAdjustPercent: number;
  finalBonusPercent: number;
}

interface WorkerProductivityRow {
  workerName: string;
  workerRole: string;
  hoursWorked: number;
  targetHours: number;
  productivity: number;
}

interface MonthlyDepositBreakdown {
  month: number;
  keyMetricsFactor: number;
  highActiveAlerts: number;
  alertPenaltyFactor: number;
  productivityScore: number;
  productivityFactor: number;
  finalDeposit: number;
}

const MONTHLY_MAX_BONUS_DEPOSIT = 100;
const PETTY_CASH_MONTHLY_LIMIT = 200;
const PETTY_CASH_AUDIT_NAME = 'monthly useable cash';
const WORKER_HOURS_AUDIT_NAME = 'monthly worker timetable';

@Component({
  selector: 'app-bonus-panel',
  standalone: true,
  imports: [CommonModule,],
  templateUrl: './bonus-panel.html',
  styleUrl: './bonus-panel.css',
})
export class BonusPanel implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  company = signal<CompanyType | null>(null);

  // Real DB-loaded locations (with attached `performance`)
  locations = signal<LocationType[]>([]);

  selectedLocationId = signal<string | null>(null);
  userRole = signal<RoleOrNull>(null);

  // Admin only: manual +/- adjustments to bonus percentage table
  manualAdjustments = signal<Record<string, number>>({});

  // BONUS: pot + spending (spendable only in Dec 22–31)
  potState = signal<BonusPotState>({
    currentMonth: new Date().getMonth() + 1,
    monthlyDeposits: [],
    totalAccumulated: 0,
  });

  bonusSpendItems = signal<SpendItem[]>([]);
  nextBonusSpendId = 1;

  // PETTY CASH: monthly reset + always spendable
  pettyCashMonthlyLimit = signal<number>(PETTY_CASH_MONTHLY_LIMIT);
  pettyCashSpendItems = signal<SpendItem[]>([]);
  nextPettySpendId = 1;
  pettyCashAuditId = signal<string | null>(null);

  private locationAudits = signal<AuditInstance[]>([]);

  // Spend input helpers
  currentBonusSpendAmount = signal<number>(0);
  currentPettySpendAmount = signal<number>(0);

  constructor(
    private companyService: CompanyService,
    private authService: AuthService,
    private ls: LocalStorageService,
    private locationService: LocationService,
    private http: HttpClient,
    private bonusService: BonusService,
    private walkthrough: WalkthroughRegistryService,
    private auditService: AuditService
  ) {}

  ngOnInit(): void {
    this.walkthrough.register('/Bonus', [
      {
        targetId: 'bonus.pageTitle',
        title: 'Finances',
        description: 'This page lets you spend petty cash and manage the bonus pot.',
      },
      {
        targetId: 'bonus.locationSelect',
        title: 'Location',
        description: 'If you can change locations, pick which one the finances apply to.',
        panelPlacement: 'left',
      },
      {
        targetId: 'bonus.pettyCashTitle',
        title: 'Petty cash',
        description: 'Use petty cash to record monthly spending.',
      },
      {
        targetId: 'bonus.bonusPotTitle',
        title: 'Bonus pot',
        description: 'Review totals and (when unlocked) add bonus spending entries.',
        panelPlacement: 'left',
      },
    ]);

    // Wait for a real user (Auth.service.ts emits async after /api/auth/me) [file:13]
    this.authService.currentUser$
      .pipe(
        takeUntil(this.destroy$),
        filter((u): u is UserType => !!u),
        tap((user) => this.userRole.set((user.role as Role) ?? null)),

        // Admin/TESTER: follow navbar-selected company
        // Manager: fallback to stored companyID (because currentCompany$ may not be set for managers)
        switchMap((user) => {
          const r = user.role as Role;

          // Org-wide: follow navbar-selected company
          if (isOrgAdminLike(r)) {
            return this.companyService.currentCompany$.pipe(
              takeUntil(this.destroy$),
              switchMap((c: any) => {
                const companyId = c?.id ?? c?.companyID ?? null;
                if (!companyId) {
                  this.company.set(null);
                  this.locations.set([]);
                  this.selectedLocationId.set(null);
                  return of(null);
                }

                this.company.set({
                  companyID: companyId,
                  name: c?.name ?? 'Selected company',
                  Locations: [],
                } as any);

                return this.loadLocationsForCompany(companyId);
              })
            );
          }

          // Location-scoped roles: use only the location assigned to the user (bonus is per location)
          if (isLocationScoped(user.role as Role)) {
            this.company.set({
              companyID: (user as any).companyId ?? this.ls.getID('companyID') ?? '',
              name: 'Company',
              Locations: [],
            } as any);
            return this.loadLocationsForNonAdmin();
          }

          // Supervisor / other: use companyId from auth/localstorage
          const companyId = (user as any).companyId ?? this.ls.getID('companyID');
          if (!companyId) {
            this.company.set(null);
            this.locations.set([]);
            this.selectedLocationId.set(null);
            return of(null);
          }

          this.company.set({
            companyID: companyId,
            name: 'Company',
            Locations: [],
          } as any);

          return this.loadLocationsForCompany(companyId);
        })
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------- Role/Location selection ----------
  get locationOptions(): LocationType[] {
    return this.locations();
  }

  currentLocation(): LocationType | null {
    const id = this.selectedLocationId();
    return this.locations().find((l) => l.locationID === id) ?? null;
  }

  onLocationChange(event: Event) {
    // Managers are locked to their location (keeps same behavior as before).
    const r = this.userRole();
    if (r === 'CareWorker' || r === 'SeniorCareWorker' || r === 'Auditor') return;

    const value = (event.target as HTMLSelectElement).value;
    this.selectedLocationId.set(value || null);

    if (value) this.ls.setID('finances-locationID', value);

    const loc = this.currentLocation();
    if (loc) {
      this.refreshFinancialDataForLocation(loc);
    }
  }

  /** Non-admin (CareWorker, Auditor, etc.): load only the user's assigned location; bonus is based on this location. */
  private loadLocationsForNonAdmin() {
    return this.locationService.listMyAssigned().pipe(
      catchError(() => of([] as ApiLocation[])),
      switchMap((apiLocs) => {
        const baseLocs: LocationType[] = (apiLocs ?? []).map((l: any) => ({
          cmpID: l.companyId,
          locationID: l.id,
          name: l.name,
          type: (l.type === 'CareHome' || l.type === 'HomeCare' ? l.type : 'CareHome') as any,
          icon: l.icon ?? undefined,
          address: l.address ?? undefined,
          contactInfo: l.contactInfo ?? undefined,
          primaryManager: l.primaryManager ?? undefined,
          areas: l.areas ?? [],
          wings: l.wings ?? [],
          roomList: (l.rooms as any) ?? [],
          roomGroups: (l.roomGroups as any) ?? [],
          clientGroups: (l.clientGroups as any) ?? [],
          homeCareMetrics: (l.homeCareMetrics as any) ?? undefined,
          stats: (l.stats as any) ?? undefined,
          staff: [],
          performance: this.emptyPerformance(),
        }));
        if (!baseLocs.length) return of([] as LocationType[]);
        const calls = baseLocs.map((loc) => {
          const locationId = loc.locationID ?? loc.id ?? '';
          const p = new HttpParams().set('locationId', locationId);
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
      }),
      tap((locs) => {
        const all = locs ?? [];
        this.locations.set(all);
        const assignedLocId = (this.authService.getCurrentUser() as any)?.locationId;
        const storedLocId = assignedLocId || this.ls.getID('locationID') || this.ls.getID('finances-locationID');
        const initial = all.find((l) => l.locationID === storedLocId) ?? all[0] ?? null;
        this.selectedLocationId.set(initial?.locationID ?? null);
        if (initial?.locationID) this.ls.setID('finances-locationID', initial.locationID);
        if (initial) {
          this.refreshFinancialDataForLocation(initial);
        } else {
          this.potState.set({
            currentMonth: new Date().getMonth() + 1,
            monthlyDeposits: [],
            totalAccumulated: 0,
          });
        }
      })
    );
  }

  private loadLocationsForCompany(companyId: string) {
    const params = new HttpParams().set('companyId', companyId);

    return this.http.get<ApiLocation[]>('/api/locations', { params }).pipe(
      catchError(() => of([] as ApiLocation[])),
      switchMap((apiLocs) => {
        const baseLocs: LocationType[] = (apiLocs ?? []).map((l) => ({
          cmpID: l.companyId,
          locationID: l.id,
          name: l.name,
          type: (l.type === 'CareHome' || l.type === 'HomeCare' ? l.type : 'CareHome') as any,
          icon: l.icon ?? undefined,
          address: l.address ?? undefined,
          contactInfo: l.contactInfo ?? undefined,
          primaryManager: l.primaryManager ?? undefined,
          areas: l.areas ?? [],
          wings: l.wings ?? [],
          roomList: (l.rooms as any) ?? [],
          roomGroups: (l.roomGroups as any) ?? [],
          clientGroups: (l.clientGroups as any) ?? [],
          homeCareMetrics: (l.homeCareMetrics as any) ?? undefined,
          stats: (l.stats as any) ?? undefined,
          staff: [],
          performance: this.emptyPerformance(),
        }));

        if (!baseLocs.length) return of([] as LocationType[]);

        // Attach latest performance set (same approach as Locations panel). [file:11]
        const calls = baseLocs.map((loc) => {
          const locationId = loc.locationID ?? loc.id ?? '';
          const p = new HttpParams().set('locationId', locationId);
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
      }),
      tap((locs) => {
        const all = locs ?? [];
        this.locations.set(all);

        // Resolve initial selection
        const role = this.userRole();
        let initial: LocationType | null = null;


// Lock selection for location-scoped roles
        const isLocked =
          role === 'CareWorker' || role === 'SeniorCareWorker' || role === 'Auditor';

        if (isLocked) {
          // Prefer explicit assigned location (if your UserType has it); otherwise fall back to stored ids
          const assignedLocId = (this.authService.getCurrentUser() as any)?.locationId;
          const storedLocId = assignedLocId || this.ls.getID('locationID') || this.ls.getID('finances-locationID');
          initial = all.find((l) => l.locationID === storedLocId) ?? all[0] ?? null;
        } else {
          // Admin-like / managers: remember last finance selection
          const stored = this.ls.getID('finances-locationID');
          initial = all.find((l) => l.locationID === stored) ?? all[0] ?? null;
        }

        this.selectedLocationId.set(initial?.locationID ?? null);
        if (initial?.locationID) this.ls.setID('finances-locationID', initial.locationID);

        if (initial) {
          this.refreshFinancialDataForLocation(initial);
        } else {
          this.potState.set({
            currentMonth: new Date().getMonth() + 1,
            monthlyDeposits: [],
            totalAccumulated: 0,
          });
        }
      })
    );
  }

  // ---------- Bonus pot (still demo/local) ----------
  private refreshFinancialDataForLocation(loc: LocationType): void {
    this.resetSpendLedgers();
    this.pettyCashAuditId.set(null);
    this.auditService.list({ locationId: loc.locationID ?? null }).pipe(
      catchError(() => of([] as AuditInstance[]))
    ).subscribe((audits) => {
      this.locationAudits.set(audits ?? []);
      this.loadPettyCashFromAudits();
      this.loadBonusPotForLocation(loc);
    });
  }

  private loadBonusPotForLocation(loc: LocationType): void {
    const now = new Date();
    const currentYear = now.getFullYear();
    const deposits = Array.from({ length: 12 }, (_, monthIndex) =>
      this.computeMonthlyBonusDeposit(monthIndex, currentYear, loc)
    );
    this.potState.set({
      currentMonth: now.getMonth() + 1,
      monthlyDeposits: deposits,
      totalAccumulated: deposits.reduce((a, b) => a + b, 0),
    });
  }

  private resetSpendLedgers(): void {
    this.bonusSpendItems.set([]);
    this.nextBonusSpendId = 1;
    this.currentBonusSpendAmount.set(0);

    this.pettyCashSpendItems.set([]);
    this.nextPettySpendId = 1;
    this.currentPettySpendAmount.set(0);
  }

  bonusSpendPreview = computed(() => Number(this.currentBonusSpendAmount()) || 0);
  pettySpendPreview = computed(() => Number(this.currentPettySpendAmount()) || 0);

  // ---------- BONUS: spend window ----------
  isBonusSpendWindowOpen = computed(() => {
    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 11, 22, 0, 0, 0); // Dec 22
    const end = new Date(year, 11, 31, 23, 59, 59); // Dec 31
    return now >= start && now <= end;
  });

  // ---------- Bonus scoring + percentages ----------
  lines = computed<BonusLineView[]>(() => {
    const loc = this.currentLocation();
    if (!loc) return [];

    // If you prefer: const lines = this.bonusService.computeBonusForLocation(loc) ...
    // Keeping your existing scoring logic for now.
    const scores = this.computeScoresForLocation(loc);

    const allRoleConfigs = [
      { role: 'SystemAdmin', basePercent: 0 },
      { role: 'OrgAdmin', basePercent: 0 },
      { role: 'RegisteredManager', basePercent: 15 },
      { role: 'Supervisor', basePercent: 8 },
      { role: 'SeniorCareWorker', basePercent: 6 },
      { role: 'CareWorker', basePercent: 5 },
      { role: 'Auditor', basePercent: 0 }, // usually no bonus; set as you want
    ];
    const roleConfigs = allRoleConfigs.filter((cfg) => this.roleExistsInWorkerAudits(cfg.role));


    return roleConfigs.map((cfg) => {
      const roleProductivity = this.computeProductivityScore(undefined, undefined, cfg.role);
      const financialWeight = 0.6;
      const stakeholderWeight = 0.25;
      const productivityWeight = 0.15;
      const weightedScore =
        scores.financial * financialWeight +
        scores.stakeholder * stakeholderWeight +
        roleProductivity * productivityWeight;
      const factor = this.mapScoreToFactor(weightedScore);

      const auto = cfg.basePercent * factor;
      const manual = this.manualAdjustments()[cfg.role] ?? 0;
      const final = auto + manual;

      return {
        role: cfg.role,
        basePercent: cfg.basePercent,
        financialScore: scores.financial,
        stakeholderScore: scores.stakeholder,
        productivityScore: roleProductivity,
        autoBonusPercent: auto,
        manualAdjustPercent: manual,
        finalBonusPercent: final,
      };
    });
  });

  totalFinalPercent = computed(() => this.lines().reduce((s, l) => s + l.finalBonusPercent, 0));

  workerProductivityRows = computed<WorkerProductivityRow[]>(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const audits = this.locationAudits()
      .filter((a) => this.isWorkerHoursAudit(a))
      .filter((a) => {
        const d = this.auditDate(a);
        return d.getFullYear() === year && d.getMonth() === month;
      });
    if (!audits.length) return [];
    return audits.flatMap((a) => this.extractWorkerRowsFromAudit(a));
  });

  updateManualAdjust(role: string, value: string) {
    const r = this.userRole();
    // only org admins (or optionally RegisteredManager) can adjust:
    if (!(r === 'SystemAdmin' || r === 'OrgAdmin')) return;

    const num = parseFloat(value);
    this.manualAdjustments.update((m) => ({ ...m, [role]: isNaN(num) ? 0 : num }));
  }


  // ---------- Balances ----------
  normalizedDeposits = computed(() => {
    const deposits = this.potState().monthlyDeposits;
    if (!deposits.length) return [];
    const max = Math.max(...deposits);
    if (max <= 0) return deposits.map(() => 0);
    return deposits.map((d) => Math.max(10, (d / max) * 100));
  });

  monthlyDepositBreakdowns = computed<MonthlyDepositBreakdown[]>(() => {
    const loc = this.currentLocation();
    if (!loc) return [];
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, monthIndex) =>
      this.computeMonthlyDepositBreakdown(monthIndex, year, loc)
    );
  });

  bonusSpentTotal = computed(() => this.bonusSpendItems().reduce((s, i) => s + i.amount, 0));
  bonusBalance = computed(() => this.potState().totalAccumulated - this.bonusSpentTotal());

  pettySpentTotal = computed(() => this.pettyCashSpendItems().reduce((s, i) => s + i.amount, 0));
  pettyBalance = computed(() => this.pettyCashMonthlyLimit() - this.pettySpentTotal());

  // ---------- BONUS: spending ----------
  onBonusAmountInput(value: string) {
    const num = parseFloat(value);
    this.currentBonusSpendAmount.set(isNaN(num) ? 0 : num);
  }

  addBonusSpendItem(label: string, amountStr: string) {
    if (!this.canSpendBonus()) return;
    if (!this.isBonusSpendWindowOpen()) return;

    const amount = parseFloat(amountStr);
    if (!label || isNaN(amount) || amount <= 0) return;

    const balance = this.bonusBalance();
    if (amount > balance) return;

    const item: SpendItem = {
      id: this.nextBonusSpendId++,
      label,
      amount,
      createdAt: new Date().toISOString(),
    };

    this.bonusSpendItems.update((list) => [...list, item]);
    this.currentBonusSpendAmount.set(0);
  }


  removeBonusSpendItem(id: number) {
    if (!this.canSpendBonus()) return;
    if (!this.isBonusSpendWindowOpen()) return;
    this.bonusSpendItems.update((list) => list.filter((i) => i.id !== id));
  }

  // ---------- PETTY CASH: spending ----------
  onPettyAmountInput(value: string) {
    const num = parseFloat(value);
    this.currentPettySpendAmount.set(isNaN(num) ? 0 : num);
  }

  addPettySpendItem(label: string, amountStr: string) {
    if (!this.canSpendPettyCash()) return;

    const amount = parseFloat(amountStr);
    if (!label || isNaN(amount) || amount <= 0) return;

    const balance = this.pettyBalance();
    if (amount > balance) return;

    const item: SpendItem = {
      id: this.nextPettySpendId++,
      label,
      amount,
      createdAt: new Date().toISOString(),
    };

    this.pettyCashSpendItems.update((list) => [...list, item]);
    this.currentPettySpendAmount.set(0);
    this.persistPettySpendToAudit(item);
  }

  removePettySpendItem(id: number) {
    if (!this.canSpendPettyCash()) return;
    this.pettyCashSpendItems.update((list) => list.filter((i) => i.id !== id));
  }

  // ---------- scoring helpers ----------
  private computeScoresForLocation(loc: LocationType): { financial: number; stakeholder: number; productivity: number } {
    const perf = (loc as any).performance;
    if (!perf) return { financial: 0, stakeholder: 0, productivity: this.computeProductivityScore() };

    const kpi = perf.categories?.filter((c: any) => c.type === 'KPI') ?? [];
    const kfi = perf.categories?.filter((c: any) => c.type === 'KFI') ?? [];
    const kci = perf.categories?.filter((c: any) => c.type === 'KCI') ?? [];
    const alerts = perf.alerts ?? [];

    return {
      financial: this.computeFinancialScore(kpi, kfi, loc),
      stakeholder: this.computeStakeholderScore(kci, alerts),
      productivity: this.computeProductivityScore(),
    };
  }

  private computeFinancialScore(kpiCats: any[], kfiCats: any[], loc: LocationType): number {
    const inds = [
      ...kpiCats.flatMap((c) => c.indicators ?? []),
      ...kfiCats.flatMap((c) => c.indicators ?? []),
    ];

    const vals: number[] = [];
    inds.forEach((ind: any) => {
      if (typeof ind.current === 'number' && typeof ind.target === 'number' && ind.target !== 0) {
        const pct = Math.max(0, Math.min(150, (ind.current / ind.target) * 100));
        vals.push(pct);
      }
    });

    const hc = (loc as any).homeCareMetrics;
    if (hc?.activeCases && hc.maxCases) vals.push((hc.activeCases / hc.maxCases) * 100);

    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  private computeStakeholderScore(kciCats: any[], alerts: any[]): number {
    const inds = kciCats.flatMap((c) => c.indicators ?? []);
    const vals: number[] = [];

    inds.forEach((ind: any) => {
      if (typeof ind.current === 'number' && typeof ind.target === 'number' && ind.target !== 0) {
        const pct = Math.max(0, Math.min(150, (ind.current / ind.target) * 100));
        vals.push(pct);
      }
    });

    const base = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 80;
    const penalty = Math.min((alerts?.length ?? 0) * 3, 30);
    return Math.max(0, base - penalty);
  }

  private mapScoreToFactor(score: number): number {
    if (score <= 50) return 0.4;
    if (score <= 70) return 0.7;
    if (score <= 85) return 1.0;
    if (score <= 100) return 1.1;
    return 1.2;
  }

  private computeMonthlyBonusDeposit(monthIndex: number, year: number, loc: LocationType): number {
    return this.computeMonthlyDepositBreakdown(monthIndex, year, loc).finalDeposit;
  }

  private computeMonthlyDepositBreakdown(monthIndex: number, year: number, loc: LocationType): MonthlyDepositBreakdown {
    const now = new Date();
    if (year === now.getFullYear() && monthIndex > now.getMonth()) {
      return {
        month: monthIndex + 1,
        keyMetricsFactor: 0,
        highActiveAlerts: 0,
        alertPenaltyFactor: 0,
        productivityScore: 0,
        productivityFactor: 0,
        finalDeposit: 0,
      };
    }
    const scores = this.computeScoresForLocation(loc);
    const monthlyProductivity = this.computeProductivityScore(monthIndex, year);

    // Key metrics contribution (KPI/KFI/KCI blend) around a base monthly value.
    const keyMetricsWeighted = scores.financial * 0.6 + scores.stakeholder * 0.4;
    const keyMetricsFactor = this.mapScoreToFactor(keyMetricsWeighted);

    // Each active High alert reduces this month by 5%.
    const highActiveAlerts = this.countHighActiveAlerts(loc);
    const alertPenaltyFactor = Math.max(0, 1 - highActiveAlerts * 0.05);

    // Productivity adds/removes up to +/- 20% around neutral 100%.
    // e.g. 110 productivity => +2%, 80 productivity => -4%.
    const productivityFactor = 1 + ((monthlyProductivity - 100) / 100) * 0.2;

    const deposit = MONTHLY_MAX_BONUS_DEPOSIT * keyMetricsFactor * alertPenaltyFactor * productivityFactor;
    return {
      month: monthIndex + 1,
      keyMetricsFactor,
      highActiveAlerts,
      alertPenaltyFactor,
      productivityScore: monthlyProductivity,
      productivityFactor,
      finalDeposit: Math.max(0, Math.round(deposit)),
    };
  }

  private computeProductivityScore(monthIndex?: number, year?: number, role?: string): number {
    const audits = this.locationAudits().filter((a) => this.isWorkerHoursAudit(a));
    if (!audits.length) return 0;
    const filtered = audits.filter((a) => {
      if (monthIndex == null || year == null) return true;
      const d = this.auditDate(a);
      return d.getFullYear() === year && d.getMonth() === monthIndex;
    });
    const source = monthIndex == null || year == null ? (filtered.length ? filtered : audits) : filtered;
    const values = source.flatMap((a) => this.extractProductivityValuesFromAudit(a, role));
    if (!values.length) return 0;
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    return Math.max(0, Math.min(150, avg));
  }

  private extractProductivityValuesFromAudit(audit: AuditInstance, role?: string): number[] {
    const vals: number[] = [];
    (audit.questions ?? []).forEach((q) => {
      const v = (q as any)?.customFields?.value;
      const tableCfg = (q as any)?.customFields?.tableConfig;
      const headers = Array.isArray(tableCfg?.headers) ? (tableCfg.headers as string[]).map((h) => (h ?? '').toLowerCase()) : [];
      const roleCol = this.findRoleColumn(headers);
      const hoursCol = headers.findIndex((h) => h.includes('hours worked') || h === 'hours' || h.includes('actual'));
      const targetCol = headers.findIndex((h) => h.includes('target') || h.includes('planned') || h.includes('expected'));
      if (typeof v === 'number') {
        vals.push(v <= 1 ? v * 100 : v);
      }
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const current = Number((v as any).current ?? (v as any).hoursWorked ?? (v as any).actual);
        const target = Number((v as any).target ?? (v as any).expectedHours ?? (v as any).planned);
        if (!isNaN(current) && !isNaN(target) && target > 0) {
          vals.push((current / target) * 100);
        }
      }
      if (Array.isArray(v)) {
        v.forEach((row: any) => {
          if (!Array.isArray(row)) return;
          if (role && roleCol >= 0) {
            const rowRole = String(row[roleCol] ?? '').toLowerCase();
            if (!this.roleMatches(rowRole, role)) return;
          }
          if (hoursCol >= 0 && targetCol >= 0) {
            const current = Number(row[hoursCol]);
            const target = Number(row[targetCol]);
            if (!isNaN(current) && !isNaN(target) && target > 0) {
              vals.push((current / target) * 100);
              return;
            }
          }
          const nums = row.map((c) => Number(c)).filter((n) => !isNaN(n));
          if (nums.length >= 2 && nums[1] > 0) vals.push((nums[0] / nums[1]) * 100);
          else if (nums.length >= 1) vals.push(nums[0] <= 1 ? nums[0] * 100 : nums[0]);
        });
      }
    });
    return vals;
  }

  private roleMatches(rowRole: string, role: string): boolean {
    const canonicalRow = this.canonicalRoleFromLabel(rowRole);
    const canonicalRole = this.canonicalRoleFromLabel(role);
    return canonicalRow !== null && canonicalRole !== null && canonicalRow === canonicalRole;
  }

  private canonicalRoleFromLabel(value: string): Role | null {
    const v = String(value ?? '').toLowerCase().replace(/[\s_-]+/g, '');
    if (v.includes('systemadmin')) return 'SystemAdmin';
    if (v.includes('orgadmin')) return 'OrgAdmin';
    if (v.includes('registeredmanager')) return 'RegisteredManager';
    if (v.includes('supervisor')) return 'Supervisor';
    if (v.includes('seniorcareworker')) return 'SeniorCareWorker';
    if (v.includes('careworker')) return 'CareWorker';
    if (v.includes('auditor')) return 'Auditor';
    return null;
  }

  private roleExistsInWorkerAudits(role: string): boolean {
    const workerAudits = this.locationAudits().filter((a) => this.isWorkerHoursAudit(a));
    if (!workerAudits.length) return false;
    return workerAudits.some((audit) =>
      this.extractWorkerRowsFromAudit(audit).some((row) => this.roleMatches(row.workerRole, role))
    );
  }

  private extractWorkerRowsFromAudit(audit: AuditInstance): WorkerProductivityRow[] {
    const rowsOut: WorkerProductivityRow[] = [];
    (audit.questions ?? []).forEach((q) => {
      const tableCfg = (q as any)?.customFields?.tableConfig;
      const rows = (q as any)?.customFields?.value;
      if (!Array.isArray(rows) || !Array.isArray(tableCfg?.headers)) return;
      const headers = (tableCfg.headers as string[]).map((h) => (h ?? '').toLowerCase());
      const nameCol = headers.findIndex((h) => h.includes('name'));
      const roleCol = this.findRoleColumn(headers);
      const hoursCol = headers.findIndex((h) => h.includes('hours worked') || h === 'hours' || h.includes('actual'));
      const targetCol = headers.findIndex((h) => h.includes('target') || h.includes('planned') || h.includes('expected'));
      if (roleCol < 0 || hoursCol < 0 || targetCol < 0) return;
      rows.forEach((row: any[]) => {
        if (!Array.isArray(row)) return;
        const workerName = String((nameCol >= 0 ? row[nameCol] : '') ?? '').trim();
        const workerRole = String(row[roleCol] ?? '').trim();
        const hoursWorked = Number(row[hoursCol]);
        const targetHours = Number(row[targetCol]);
        if (!workerRole || isNaN(hoursWorked) || isNaN(targetHours) || targetHours <= 0) return;
        rowsOut.push({
          workerName,
          workerRole,
          hoursWorked,
          targetHours,
          productivity: Math.max(0, Math.min(150, (hoursWorked / targetHours) * 100)),
        });
      });
    });
    return rowsOut;
  }

  private findRoleColumn(headers: string[]): number {
    const exact = headers.findIndex((h) => h === 'worker role' || h === 'role');
    if (exact >= 0) return exact;
    return headers.findIndex((h) => h.includes('role') && !h.includes('name'));
  }

  private countHighActiveAlerts(loc: LocationType): number {
    const alerts = ((loc as any)?.performance?.alerts ?? []) as any[];
    return alerts.filter((a) => {
      const severity = String(a?.severity ?? '').toLowerCase();
      return a?.active === true && severity === 'high';
    }).length;
  }

  private loadPettyCashFromAudits(): void {
    const petty = this.locationAudits().filter((a) => this.isPettyCashAudit(a));
    if (!petty.length) {
      this.pettyCashMonthlyLimit.set(PETTY_CASH_MONTHLY_LIMIT);
      this.pettyCashSpendItems.set([]);
      this.pettyCashAuditId.set(null);
      return;
    }
    const audit = petty.sort((a, b) => this.auditDate(b).getTime() - this.auditDate(a).getTime())[0];
    this.pettyCashAuditId.set(audit.id);

    const now = new Date();
    const monthName = now.toLocaleString('en-GB', { month: 'long' }).toLowerCase();
    const monthNum = now.getMonth() + 1;

    let monthlyLimit: number | null = null;
    const items: SpendItem[] = [];

    (audit.questions ?? []).forEach((q) => {
      const tableCfg = (q as any)?.customFields?.tableConfig;
      const rows = (q as any)?.customFields?.value;
      if (Array.isArray(rows) && tableCfg?.headers?.length) {
        const headers = (tableCfg.headers as string[]).map((h) => (h ?? '').toLowerCase());
        const monthCol = headers.findIndex((h) => h.includes('month'));
        const spentCol = headers.findIndex((h) => h.includes('money spent'));
        const acquiredCol = headers.findIndex((h) => h.includes('what acquired'));
        const remainingCol = headers.findIndex((h) => h.includes('amount remaining after purchase'));

        rows.forEach((row: any[]) => {
          if (!Array.isArray(row)) return;
          const monthCell = String(row[monthCol] ?? '').toLowerCase();
          const isThisMonth = monthCol === -1 || monthCell.includes(monthName) || Number(monthCell) === monthNum;
          if (!isThisMonth) return;

          const spent = spentCol >= 0 ? Number(row[spentCol]) : NaN;
          const remaining = remainingCol >= 0 ? Number(row[remainingCol]) : NaN;
          if (!isNaN(spent) && !isNaN(remaining)) {
            const derivedLimit = spent + remaining;
            if (derivedLimit > 0) monthlyLimit = Math.max(monthlyLimit ?? 0, derivedLimit);
          }

          if (spentCol >= 0 && acquiredCol >= 0) {
            const amount = Number(row[spentCol]);
            const label = String(row[acquiredCol] ?? '').trim();
            if (!isNaN(amount) && amount > 0 && label) {
              const createdAt = new Date().toISOString();
              items.push({ id: this.nextPettySpendId++, label, amount, createdAt });
            }
          }
        });
      }
    });

    this.pettyCashMonthlyLimit.set(monthlyLimit ?? PETTY_CASH_MONTHLY_LIMIT);
    this.pettyCashSpendItems.set(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  private persistPettySpendToAudit(item: SpendItem): void {
    const auditId = this.pettyCashAuditId();
    const audit = this.locationAudits().find((a) => a.id === auditId);
    if (!audit) return;
    const questions = [...(audit.questions ?? [])];
    const monthName = new Date(item.createdAt).toLocaleString('en-GB', { month: 'long' });
    const monthNum = new Date(item.createdAt).getMonth() + 1;

    const qIndex = questions.findIndex((q) => {
      const rows = (q as any)?.customFields?.value;
      const headers = (q as any)?.customFields?.tableConfig?.headers;
      return Array.isArray(rows) && Array.isArray(headers);
    });
    if (qIndex < 0) return;
    const q = { ...(questions[qIndex] as any) };
    const tableCfg = q.customFields?.tableConfig;
    const headers = Array.isArray(tableCfg?.headers) ? [...tableCfg.headers] : [];
    const rows = Array.isArray(q.customFields?.value) ? [...q.customFields.value] : [];

    const headersLower = headers.map((h: string) => (h ?? '').toLowerCase());
    const monthCol = headersLower.findIndex((h: string) => h.includes('month'));
    const acquiredCol = headersLower.findIndex((h: string) => h.includes('what acquired'));
    const spentCol = headersLower.findIndex((h: string) => h.includes('money spent'));
    const remainingCol = headersLower.findIndex((h: string) => h.includes('amount remaining after purchase'));
    if (acquiredCol < 0 || spentCol < 0) return;

    const row = new Array(headers.length).fill('');
    if (monthCol >= 0) row[monthCol] = monthName || `${monthNum}`;
    row[acquiredCol] = item.label;
    row[spentCol] = item.amount;
    if (remainingCol >= 0) {
      const nextRemaining = Math.max(0, this.pettyBalance() - item.amount);
      row[remainingCol] = nextRemaining;
    }
    rows.push(row);

    q.customFields = { ...(q.customFields ?? {}), value: rows };
    questions[qIndex] = q as AuditQuestionInstance;
    this.auditService.patch(audit.id, { questions }).pipe(catchError(() => of(audit))).subscribe();
  }

  private isPettyCashAudit(audit: AuditInstance): boolean {
    const text = `${audit.title ?? ''}`.toLowerCase();
    return text.includes(PETTY_CASH_AUDIT_NAME);
  }

  private isWorkerHoursAudit(audit: AuditInstance): boolean {
    const title = `${audit.title ?? ''}`.toLowerCase();
    return title.includes(WORKER_HOURS_AUDIT_NAME);
  }

  private auditDate(audit: AuditInstance): Date {
    return new Date(audit.date || audit.createdAt || new Date().toISOString());
  }
  canSpendBonus(): boolean {
    const r = this.userRole() as Role | null;
    // Bonus spenders: RegisteredManager + SeniorCareWorker
    return r === 'RegisteredManager' || r === 'SeniorCareWorker';
  }
  canChangeLocation(): boolean {
    const r = this.userRole();
    return r === 'SystemAdmin' || r === 'OrgAdmin' || r === 'RegisteredManager' || r === 'Supervisor';
  }



  canEditManualAdjustments(): boolean {
    const r = this.userRole();
    return r === 'SystemAdmin' || r === 'OrgAdmin';
  }


  canSpendPettyCash(): boolean {
    const r = this.userRole() as Role | null;
    // Petty cash spenders: RegisteredManager + SeniorCareWorker
    return r === 'RegisteredManager' || r === 'SeniorCareWorker';
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
}
