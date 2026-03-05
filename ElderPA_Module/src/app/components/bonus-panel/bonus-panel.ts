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
import {CQCTest} from '../cqctest/cqctest';

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
  autoBonusPercent: number;
  manualAdjustPercent: number;
  finalBonusPercent: number;
}

// NOTE: bonus pot + petty cash are still demo/local-state until you add DB endpoints.
const MONTHLY_MAX_BONUS_DEPOSIT = 100;
const PETTY_CASH_MONTHLY_LIMIT = 200;

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

  // Spend input helpers
  currentBonusSpendAmount = signal<number>(0);
  currentPettySpendAmount = signal<number>(0);

  constructor(
    private companyService: CompanyService,
    private authService: AuthService,
    private ls: LocalStorageService,
    private locationService: LocationService,
    private http: HttpClient,
    private bonusService: BonusService
  ) {}

  ngOnInit(): void {
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
      this.loadBonusPotForLocation(loc);
      this.resetSpendLedgers();
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
          this.loadBonusPotForLocation(initial);
          this.resetSpendLedgers();
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
          this.loadBonusPotForLocation(initial);
          this.resetSpendLedgers();
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
  private loadBonusPotForLocation(_loc: LocationType): void {
    // TODO: replace with real DB endpoint, e.g. GET /api/bonusPot?locationId=...
    const monthlyPerformance = Array.from({ length: 12 }, () => 0.7 + Math.random() * 0.3);
    const deposits = monthlyPerformance.map((p) => Math.round(MONTHLY_MAX_BONUS_DEPOSIT * p));

    this.potState.set({
      currentMonth: new Date().getMonth() + 1,
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

    const roleConfigs = [
      { role: 'RegisteredManager', basePercent: 15 },
      { role: 'Supervisor', basePercent: 8 },
      { role: 'SeniorCareWorker', basePercent: 6 },
      { role: 'CareWorker', basePercent: 5 },
      { role: 'Auditor', basePercent: 0 }, // usually no bonus; set as you want
    ];


    return roleConfigs.map((cfg) => {
      const financialWeight = 0.75;
      const stakeholderWeight = 0.25;

      const weightedScore = scores.financial * financialWeight + scores.stakeholder * stakeholderWeight;
      const factor = this.mapScoreToFactor(weightedScore);

      const auto = cfg.basePercent * factor;
      const manual = this.manualAdjustments()[cfg.role] ?? 0;
      const final = auto + manual;

      return {
        role: cfg.role,
        basePercent: cfg.basePercent,
        financialScore: scores.financial,
        stakeholderScore: scores.stakeholder,
        autoBonusPercent: auto,
        manualAdjustPercent: manual,
        finalBonusPercent: final,
      };
    });
  });

  totalFinalPercent = computed(() => this.lines().reduce((s, l) => s + l.finalBonusPercent, 0));

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
  }

  removePettySpendItem(id: number) {
    if (!this.canSpendPettyCash()) return;
    this.pettyCashSpendItems.update((list) => list.filter((i) => i.id !== id));
  }

  // ---------- scoring helpers ----------
  private computeScoresForLocation(loc: LocationType): { financial: number; stakeholder: number } {
    const perf = (loc as any).performance;
    if (!perf) return { financial: 0, stakeholder: 0 };

    const kpi = perf.categories?.filter((c: any) => c.type === 'KPI') ?? [];
    const kfi = perf.categories?.filter((c: any) => c.type === 'KFI') ?? [];
    const kci = perf.categories?.filter((c: any) => c.type === 'KCI') ?? [];
    const alerts = perf.alerts ?? [];

    return {
      financial: this.computeFinancialScore(kpi, kfi, loc),
      stakeholder: this.computeStakeholderScore(kci, alerts),
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
  canSpendBonus(): boolean {
    const r = this.userRole() as Role | null;
    return r === 'RegisteredManager'; // adjust if you want OrgAdmin too
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
    return r === 'RegisteredManager' || r === 'Supervisor'; // adjust as you like
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
