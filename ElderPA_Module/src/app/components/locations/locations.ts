import { CommonModule, NgFor, NgIf } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, takeUntil, tap } from 'rxjs/operators';

import { RadialSelector } from '../radial-selector/radial-selector';
import { SmartChartComponent, type ChartDatum, type ChartOptions } from '../../NEW for implemnet/smart-chart/smart-chart';
import { KeyMetricsPanel } from '../key-metrics-panel/key-metrics-panel';
import { Ccga } from '../ccga/ccga';

import { LocalStorageService } from '../../Services/LocalStorage.service';
import { CompanyService } from '../../Services/Company.service';
import { AuthService } from '../../Services/Auth.service';
import { LocationService } from '../../Services/location.service';

import { LocationType, Room, PerformanceSet, UserType, Role } from '../Types';

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

const ADMIN_LIKE: Role[] = ['SystemAdmin', 'OrgAdmin', 'RegisteredManager'];

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [CommonModule, RadialSelector, SmartChartComponent, NgFor, NgIf, KeyMetricsPanel, Ccga],
  templateUrl: './locations.html',
  styleUrl: './locations.css',
})
export class Locations implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab: 'details' | 'structure' | 'metrics' | 'CCGA' = 'details';

  companyId: string | null = null;

  locations: LocationType[] = [];
  selectedLocation: LocationType | null = null;

  // CareHome metrics
  careHomes: LocationType[] = [];
  currentRooms = 0; // free rooms
  maxBedCapacity = 0; // total rooms

  // HomeCare metrics
  homeCareLocations: LocationType[] = [];
  totalActiveCases = 0;
  totalMaxCases = 0;

  // Wing/room UI
  selectedWing: string | null = null;
  selectedRoom: Room | null = null;

  user: UserType | null = null;

  labelFn = (loc: LocationType) => loc.name;
  wingLabelFn = (w: string) => w;

  /** CareHome capacity gauge data for SmartChart. */
  getCapacityGaugeData(): ChartDatum[] {
    return [{ label: 'Overall capacity', value: this.currentRooms }];
  }
  getCapacityGaugeOptions(): ChartOptions {
    return { max: this.maxBedCapacity > 0 ? this.maxBedCapacity : 100, showLegend: false };
  }

  /** HomeCare capacity gauge data for SmartChart. */
  getHomeCareGaugeData(): ChartDatum[] {
    return [{ label: 'Overall capacity', value: this.totalActiveCases }];
  }
  getHomeCareGaugeOptions(): ChartOptions {
    return { max: this.totalMaxCases > 0 ? this.totalMaxCases : 100, showLegend: false };
  }

  get canChangeLocation(): boolean {
    const r = this.user?.role as any;
    return r === 'SystemAdmin' || r === 'OrgAdmin' || r === 'RegisteredManager';
  }


  constructor(
    private ls: LocalStorageService,
    private companyService: CompanyService,
    private authService: AuthService,
    private locationService: LocationService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
    this.activeTab = (this.ls.getID('tab_locations') as any) || 'details';
  }

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(
        takeUntil(this.destroy$),
        tap((user) => (this.user = user)),
        switchMap((user) => {
          if (!user) return of(null);

          // Non-admin (no location switcher): use only the location assigned to the user
          if (!this.canChangeLocation) {
            this.companyId = (user as any).companyId ?? this.ls.getID('companyID') ?? null;
            return this.loadLocationsForNonAdmin();
          }

          // Admin-like: company-scoped locations from API
          return this.companyService.currentCompany$.pipe(
            takeUntil(this.destroy$),
            tap((c: any) => {
              this.companyId = c?.id ?? c?.companyID ?? null;
            }),
            switchMap(() => (this.companyId ? this.loadLocationsForCompany(this.companyId) : of(null)))
          );
        })
      )
      .subscribe({
        next: () => {
          // After load, auto-select location: for care workers use user's assigned location only
          const preferredLocationId = this.user?.locationId ?? (this.user as any)?.locationID ?? this.ls.getID('locationID') ?? null;

          if (preferredLocationId) {
            const match = this.locations.find((l) => (l.locationID ?? l.id) === preferredLocationId) ?? null;
            if (match) this.onLocationSelected(match);
          }

          // If still no selection: pick first (for location-scoped users this is their only location)
          if (!this.selectedLocation && this.locations.length) {
            this.onLocationSelected(this.locations[0] ?? null);
          }

          this.updateMetrics();
          this.cdr.detectChanges();
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(tab: 'details' | 'structure' | 'metrics' | 'CCGA') {
    this.activeTab = tab;
    this.ls.setID('tab_locations', this.activeTab);
  }

  /** Non-admin: load only the location assigned to the current user (from /api/locations/me). */
  private loadLocationsForNonAdmin() {
    return this.locationService.listMyAssigned().pipe(
      catchError(() => of([] as ApiLocation[])),
      switchMap((apiLocs) => this.attachPerformanceToLocations((apiLocs ?? []) as ApiLocation[]))
    );
  }

  private loadLocationsForCompany(companyId: string) {
    const params = new HttpParams().set('companyId', companyId);

    return this.http.get<ApiLocation[]>('/api/locations', { params }).pipe(
      catchError(() => of([] as ApiLocation[])),
      switchMap((apiLocs) => this.attachPerformanceToLocations(apiLocs ?? []))
    );
  }

  private attachPerformanceToLocations(apiLocs: ApiLocation[]) {
    const baseLocs: LocationType[] = apiLocs.map((l) => ({
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

    return forkJoin(calls).pipe(
      tap((locs) => {
        this.locations = locs ?? [];
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

  onLocationSelected(loc: LocationType | null) {
    this.selectedLocation = loc;
    this.selectedWing = null;
    this.selectedRoom = null;

    if (loc) {
      const id = loc.locationID ?? loc.id ?? '';
      this.ls.setID('locationID', id);
      this.companyService.setCurrentLocation(id, loc);
    }
  }

  onLocationDropdownChange(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    const loc = this.locations.find((l) => (l.locationID ?? l.id) === id) || null;
    this.onLocationSelected(loc);
  }

  updateMetrics() {
    this.careHomes = this.locations.filter((loc) => loc.type === 'CareHome');
    this.currentRooms = this.careHomes.reduce((sum, loc) => sum + this.getCapacity(loc), 0);
    this.maxBedCapacity = this.careHomes.reduce((sum, loc) => sum + (loc.roomList?.length ?? 0), 0);

    this.homeCareLocations = this.locations.filter((loc) => loc.type === 'HomeCare');
    this.totalActiveCases = this.homeCareLocations.reduce((sum, loc) => sum + (loc.homeCareMetrics?.activeCases ?? 0), 0);
    this.totalMaxCases = this.homeCareLocations.reduce((sum, loc) => sum + (loc.homeCareMetrics?.maxCases ?? 0), 0);
  }

  getCapacity(location: LocationType): number {
    const rooms = location.roomList ?? [];
    const occupiedCount = rooms.filter((room: any) => !!room.occupiedClientGroup).length;
    return rooms.length - occupiedCount;
  }

  getManagerName(): string {
    return this.selectedLocation?.primaryManager ?? '—';
  }

  get availableWings(): string[] {
    const loc = this.selectedLocation;
    if (!loc || loc.type !== 'CareHome') return [];
    const list =
      loc.wings && loc.wings.length
        ? loc.wings
        : Array.from(new Set((loc.roomList ?? []).map((r: any) => r.wing).filter((w: any): w is string => !!w)));
    return list.sort();
  }

  get roomsForSelectedWing(): any[] {
    const loc = this.selectedLocation;
    if (!loc || loc.type !== 'CareHome') return [];
    const rooms = loc.roomList ?? [];
    if (!this.selectedWing) return rooms;
    return rooms.filter((r: any) => (r.wing || '') === this.selectedWing);
  }

  onWingSelected(wing: string) {
    this.selectedWing = wing;
    this.selectedRoom = null;
  }

  onRoomClicked(room: any) {
    this.selectedRoom = room as any;
  }

  clearSelectedRoom() {
    this.selectedRoom = null;
  }
}
