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
import { WalkthroughRegistryService } from '../../Services/walkthrough-registry.service';

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
    private cdr: ChangeDetectorRef,
    private walkthrough: WalkthroughRegistryService
  ) {
    this.activeTab = (this.ls.getID('tab_locations') as any) || 'details';
    this.registerWalkthroughSteps();
  }

  private registerWalkthroughSteps(): void {
    const locationTargetId = this.canChangeLocation ? 'locations.locationSelect' : 'locations.locationFixed';
    const selectedType = this.selectedLocation?.type;

    if (this.activeTab === 'details') {
      const steps: any[] = [
        {
          targetId: 'locations.tabDetails',
          title: 'Details',
          description: 'Overview information for the selected location.',
        },
        { targetId: locationTargetId, title: 'Location', description: 'Switch the current location context.' },
        {
          targetId: 'locations.locationSummaryTitle',
          title: 'Location summary',
          description: 'Main location card with key details and setup indicators.',
        },
      ];

      if (selectedType === 'CareHome') {
        steps.push({
          targetId: 'locations.roomsCardTitle',
          title: 'Rooms',
          description: 'Quick capacity overview for the rooms in this care home.',
        });
        steps.push({
          targetId: 'locations.careHomeSetupCardTitle',
          title: 'Care home setup',
          description: 'Areas, wings, room groups, and client groups used for setup.',
        });
      } else if (selectedType === 'HomeCare') {
        steps.push({
          targetId: 'locations.homeCareSetupCardTitle',
          title: 'Home care setup',
          description: 'Active cases, max cases, billing hours, rate card, and capacity overview.',
        });
        steps.push({
          targetId: 'locations.detailsCoverageCardTitle',
          title: 'Coverage',
          description: 'Where the service operates (center, radius, and areas).',
        });
        steps.push({
          targetId: 'locations.detailsStaffCardTitle',
          title: 'Staff',
          description: 'How many staff records are associated with this location.',
        });
      }

      this.walkthrough.register('/companies', steps);
      return;
    }

    if (this.activeTab === 'structure') {
      const steps: any[] = [
        {
          targetId: 'locations.tabStructure',
          title: 'Structure',
          description: 'Manage how the location is structured (wings/rooms for Care Homes, cards for Home Care).',
        },
        { targetId: locationTargetId, title: 'Location', description: 'Switch the current location context.' },
      ];

      if (selectedType === 'CareHome') {
        steps.push({
          targetId: 'locations.structureWingsCardTitle',
          title: 'Wings',
          description: 'Select the wing to filter the rooms table.',
        });
        steps.push({
          targetId: 'locations.structureRoomsCardTitle',
          title: 'Rooms',
          description: 'Rooms table shows room state (occupied vs free).',
        });
        steps.push({
          targetId: 'locations.structureRoomDetailsCardTitle',
          title: 'Room details',
          description: 'Click a room to view room-level details.',
        });
        steps.push({
          targetId: 'locations.structureClearRoomButton',
          title: 'Clear selection',
          description: 'Clear the selected room (disabled until a room is selected).',
        });
      } else if (selectedType === 'HomeCare') {
        steps.push({
          targetId: 'locations.structureHomeCareCoverageCardTitle',
          title: 'Coverage',
          description: 'Service coverage information for Home Care locations.',
        });
        steps.push({
          targetId: 'locations.structureHomeCareOperationsCardTitle',
          title: 'Operations',
          description: 'Operational metrics such as active cases and billing hours.',
        });
        steps.push({
          targetId: 'locations.structureHomeCareWorkforceCardTitle',
          title: 'Workforce',
          description: 'Total staff count for this Home Care location.',
        });
      }

      this.walkthrough.register('/companies', steps);
      return;
    }

    if (this.activeTab === 'metrics') {
      const steps: any[] = [
        {
          targetId: 'locations.tabMetrics',
          title: 'Key metrics',
          description:
            'Open the Key metrics view for the currently selected location/company. Here you’ll see Performance, Finances, Control, plus alerts and tasks that need attention.',
          lockScroll: true,
        },
        {
          targetId: locationTargetId,
          title: 'Location',
          description: 'Switch location (company context). When you change it, the dashboard updates to show that specific company’s data.',
          panelPlacement: 'left',
          lockScroll: true,
        },
        {
          targetId: 'locations.metricsPanel',
          title: 'Metrics panel',
          description:
            'Use the period controls to pick where the data comes from (or recalculate from last month). You can also refresh indicators and create action tasks using the buttons in this header area.',
          scrollTo: 'half',
          lockScroll: true,
        },
        {
          targetId: 'kmp.performanceCard',
          title: 'Performance',
          description:
            'Radial KPI (Performance) chart: compare current performance against the target. The card cycles through the indicators you already have, so you can preview how the company is working right now.',
          lockScroll: true,
        },
        {
          targetId: 'kmp.financesCard',
          title: 'Finances',
          description:
            'Radial KFI (Finances) chart: shows target and current values and the resulting status (on track or not). Use it to quickly understand whether financial performance is meeting expectations.',
          lockScroll: true,
        },
        {
          targetId: 'kmp.controlCard',
          title: 'Control',
          description:
            'Radial KCI (Control) chart: highlights control indicators and where attention is needed. If something is off target, this is where you spot it first.',
          lockScroll: true,
        },
        {
          targetId: 'kmp.barChartsCard',
          title: 'Bar charts',
          description:
            'Bar chart categories let you choose what indicator data you want to inspect (for example last 12 months of the current year, or monthly views). You can see the chart plus the targets and related context for each indicator.',
          scrollTo: 'bottom',
          lockScroll: true,
        },
        {
          targetId: 'kmp.activeAlertsCardTitle',
          title: 'Active alerts',
          description:
            'Active alerts are the items that require action right now. Assign tasks using the buttons here, so alerts get resolved with the right ownership.',
          scrollTo: 'top',
          panelPlacement: 'left',
          lockScroll: true,
        },
        {
          targetId: 'kmp.tasksCardTitle',
          title: 'Tasks',
          description:
            'Tasks are the concrete actions tied to alerts. Review what’s currently set, and mark tasks as done when they are addressed to clear the related alerts.',
          scrollTo: 'bottom',
          lockScroll: true,
        },
      ];

      this.walkthrough.register('/companies', steps);
      return;
    }

    // CCGA
    const ccgaSteps: any[] = [
      {
        targetId: 'locations.tabCCGA',
        title: 'Compliance Audit Hub',
        description:
          'This is the Compliance Audit Hub: where you can see all upcoming audits, all completed audits, their scores, and the audit-related information. Because this hub holds everything together, it also includes other areas like surveys and navigation to the next sections.',
      },
      { targetId: 'locations.ccgaPanel', title: 'CCGA panel', description: 'Embedded Compliance Audit Hub.' },
      { targetId: 'ccga.atAGlance', title: 'At a glance', description:
        'Base information and audit breakdown. See overall completion (how many audits are completed out of the total), how many are outstanding, the average score, and how many audit types exist (baseline, monthly, and provider).'
      },
      {
        targetId: 'ccga.yearlyPlanner',
        title: 'Yearly Governance Planner',
        description:
          'A yearly calendar with all audits marked across time. You can select different time views (months, weeks, even days), which is helpful when you have multiple audits in the same period.',
      },
      {
        targetId: 'ccga.baselineAuditsCard',
        title: 'Baseline audits',
        description:
          'Baseline comparison: total, completed, and outstanding counts, shown together with the radial bar.',
        scrollTo: 'bottom',
        lockScroll: true,
      },
      {
        targetId: 'ccga.monthlyManagerAuditsCard',
        title: 'Monthly manager audits',
        description:
          'Multi-manager (monthly) audit comparison: total, completed, and outstanding counts, shown together with the radial bar.',
        scrollTo: 'bottom',
        lockScroll: true,
      },
      {
        targetId: 'ccga.providerAuditsCard',
        title: 'Provider audits',
        description:
          'Provider audit comparison: total, completed, and outstanding counts, shown together with the radial bar.',
        scrollTo: 'bottom',
        lockScroll: true,
      },
      {
        targetId: 'ccga.quickActionsCard',
        title: 'Quick actions',
        description:
          'Two main action buttons: `Audit Library` (review/inspect existing audits) and `Audit Creator` (create a new audit). These are shortcuts so you can move faster.',
        panelPlacement: 'left',
        scrollTo: 'top',
        lockScroll: true,
      },
      {
        targetId: 'ccga.masterAuditCloe',
        title: 'Master Audit per CLOE',
        description:
          'Master audit hierarchy that includes domain scoring derived from audits. It helps you understand how each domain is performing and where attention is needed.',
      },
    ];

    this.walkthrough.register('/companies', ccgaSteps);
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
          this.registerWalkthroughSteps();
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
    this.registerWalkthroughSteps();
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

    this.registerWalkthroughSteps();
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
