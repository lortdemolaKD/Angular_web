import { ChangeDetectorRef, Component, HostBinding, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ThemeSwitcher } from '../theme-switcher/theme-switcher';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { LocalStorageService } from '../../Services/LocalStorage.service';
import { UserType, Role, LocationType } from '../Types';
import { CompanyService } from '../../Services/Company.service';
import { AuthService } from '../../Services/Auth.service';
import { HttpClient } from '@angular/common/http';
import { Subject, of, switchMap, takeUntil, catchError, tap, filter } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { InviteDialogComponent } from './invite-dialog/invite-dialog';
import { UserAccountPanelComponent } from './user-account-panel/user-account-panel';

type ApiCompany = { id: string; name: string; icon?: string | null };
type ApiLocation = { id: string; companyId: string; name: string; type: string; icon?: string | null };

const ADMIN_LIKE: Role[] = ['SystemAdmin', 'OrgAdmin'];
const INVITE_CREATORS: Role[] = ['SystemAdmin', 'OrgAdmin', 'RegisteredManager'];

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [MatIconModule, RouterLink, RouterLinkActive, ThemeSwitcher, CommonModule, NgFor, NgIf, UserAccountPanelComponent],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css'],
})
export class NavBar implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  /** Desktop: compact (72px) by default, expands on hover (280px). Set only when viewport > 768. */
  readonly expanded = signal(false);
  private get isDesktopView(): boolean {
    return typeof window !== 'undefined' && window.innerWidth > 768;
  }
  @HostBinding('class.navbar--expanded') get isExpanded() {
    return this.expanded();
  }

  onNavbarMouseEnter(): void {
    if (this.isDesktopView) this.expanded.set(true);
  }
  onNavbarMouseLeave(): void {
    if (this.isDesktopView) this.expanded.set(false);
  }

  private updateExpandedFromViewport(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      this.expanded.set(false);
      this.cdr.markForCheck();
    }
  }

  user: UserType | null = null;

  accountPanelOpen = false;

  /** Mobile: menu dropdown open (nav links with icons + names). */
  mobileMenuOpen = false;

  currentCompany: ApiCompany | null = null;
  currentLocation: ApiLocation | null = null;

  companies: ApiCompany[] = [];
  locations: ApiLocation[] = [];

  dropdownOpen = false;

  get isOrgAdmin() {
    const r = this.user?.role;
    return r === 'SystemAdmin' || r === 'OrgAdmin';
  }


  constructor(
    private router: Router,
    private ls: LocalStorageService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private companyService: CompanyService,
    private http: HttpClient,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    if (typeof window !== 'undefined') {
      this.updateExpandedFromViewport();
      const onResize = () => this.updateExpandedFromViewport();
      window.addEventListener('resize', onResize);
      this.destroy$.subscribe(() => window.removeEventListener('resize', onResize));
    }
    this.router.events
      .pipe(
        takeUntil(this.destroy$),
        filter((e): e is NavigationEnd => e instanceof NavigationEnd)
      )
      .subscribe(() => this.closeMobileMenu());
    this.authService.currentUser$
      .pipe(
        takeUntil(this.destroy$),
        switchMap((u) => {
          queueMicrotask(() => {
            this.user = u;

            if (!u) {
              this.companies = [];
              this.locations = [];
              this.currentCompany = null;
              this.currentLocation = null;
              this.dropdownOpen = false;
              this.cdr.markForCheck();
            }
          });

          if (!u) return of(null);

          // Admin-like users can browse companies (requires backend to allow OrgAdmin/SystemAdmin)
          if (ADMIN_LIKE.includes(u.role as Role)) {
            return this.http.get<ApiCompany[]>('/api/companies').pipe(
              catchError(() => of([] as ApiCompany[])),
              switchMap((companies) => {
                queueMicrotask(() => {
                  this.companies = companies ?? [];
                  this.cdr.markForCheck();
                });

                const savedCompanyId = this.ls.getID('companyID');
                const initialCompanyId = savedCompanyId || companies?.[0]?.id;
                if (!initialCompanyId) return of(null);

                queueMicrotask(() => {
                  this.currentCompany = (companies.find((c) => c.id === initialCompanyId) as any) ?? null;
                  this.cdr.markForCheck();
                });

                this.companyService.setCurrentCompany(initialCompanyId);

                return this.http
                  .get<ApiLocation[]>(`/api/locations?companyId=${encodeURIComponent(initialCompanyId)}`)
                  .pipe(
                    catchError(() => of([] as ApiLocation[])),
                    tap((locs) =>
                      queueMicrotask(() => {
                        this.locations = locs ?? [];
                        this.cdr.markForCheck();
                      })
                    )
                  );
              })
            );
          }

          // Non-admin users: only their own company
          return this.http.get<ApiCompany>('/api/companies/me').pipe(
            catchError(() => of(null as any)),
            switchMap((company) => {
              if (!company) return of(null);

              queueMicrotask(() => {
                this.companies = [company];
                this.currentCompany = company;
                this.cdr.markForCheck();
              });

              this.companyService.setCurrentCompany(company.id);
              this.ls.setID('companyID', company.id);

              return this.http
                .get<ApiLocation[]>(`/api/locations?companyId=${encodeURIComponent(company.id)}`)
                .pipe(
                  catchError(() => of([] as ApiLocation[])),
                  tap((locs) =>
                    queueMicrotask(() => {
                      this.locations = locs ?? [];
                      const userLocId = this.user?.locationId;
                      const locId =
                        userLocId && (locs ?? []).some((l) => l.id === userLocId)
                          ? userLocId
                          : (locs ?? [])[0]?.id ?? null;
                      if (locId) {
                        this.currentLocation =
                          (locs ?? []).find((l) => l.id === locId) ?? (locs ?? [])[0] ?? null;
                        this.companyService.setCurrentLocation(locId, this.currentLocation ? { ...this.currentLocation, locationID: this.currentLocation.id, type: this.currentLocation.type as 'CareHome' | 'HomeCare', icon: this.currentLocation.icon ?? undefined } as LocationType : undefined);
                        this.ls.setID('locationID', locId);
                      }
                      this.cdr.markForCheck();
                    })
                  )
                );
            })
          );
        })
      )
      .subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Avatar URL from server (profile photo stored on server). */
  get userAvatarUrl(): string | null {
    return this.user?.avatarUrl ?? null;
  }

  get userInitials(): string {
    if (!this.user?.name?.trim()) return '?';
    const name = this.user.name.trim();
    if (name.length >= 2) return name.slice(0, 2).toUpperCase();
    return name.slice(0, 1).toUpperCase();
  }

  closeAccountPanel(): void {
    this.accountPanelOpen = false;
    this.cdr.markForCheck();
  }

  toggleAccountPanel(): void {
    this.accountPanelOpen = !this.accountPanelOpen;
    this.cdr.markForCheck();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    this.cdr.markForCheck();
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
    this.dropdownOpen = false;
    this.cdr.markForCheck();
  }

  get canInvite(): boolean {
    const r = this.user?.role as Role | undefined;
    return !!r && INVITE_CREATORS.includes(r);
  }

  /** Compliance audits (Audits + Audit Library) only for admins and registered managers */
  get canAccessComplianceAudits(): boolean {
    const r = this.user?.role as Role | undefined;
    return !!r && (ADMIN_LIKE.includes(r) || r === 'RegisteredManager');
  }

  /** True for roles that can switch company/location (show "Locations"); else show "Location" for current user only */
  get showLocationsPlural(): boolean {
    const r = this.user?.role as Role | undefined;
    return !!r && (ADMIN_LIKE.includes(r) || r === 'RegisteredManager');
  }

  openInviteModal() {
    if (!this.canInvite || !this.currentCompany) return;

    this.dialog.open(InviteDialogComponent, {
      data: {
        companyId: this.currentCompany.id,
        companyName: this.currentCompany.name,
        locationId: this.currentLocation?.id ?? null,
        locationName: this.currentLocation?.name ?? null,
        locations: (this.locations ?? []).map((l) => ({ id: l.id, name: l.name })),
      },
      width: '420px',
    });
  }

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
    this.cdr.markForCheck();
  }

  selectCompany(companyId: string | undefined) {
    if (!companyId) return;

    this.dropdownOpen = false;
    this.currentCompany = (this.companies.find((c) => c.id === companyId) as any) ?? null;

    this.companyService.setCurrentCompany(companyId);

    this.http
      .get<ApiLocation[]>(`/api/locations?companyId=${encodeURIComponent(companyId)}`)
      .pipe(catchError(() => of([] as ApiLocation[])))
      .subscribe((locs) => {
        this.locations = locs ?? [];
        //this.cdr.markForCheck();
      });
  }

  logout(): void {
    this.closeAccountPanel();
    this.authService.logout();
    this.router.navigate(['login']);
  }
}
