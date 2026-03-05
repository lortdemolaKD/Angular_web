import {Injectable, signal} from '@angular/core';
import { BehaviorSubject, catchError, finalize, Observable, of, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';

import { UserType, Role } from '../components/Types';
//import { MOCK_USERS } from '../components/mock-data';
import { LocalStorageService } from './LocalStorage.service';
import { JwtHelperService } from '@auth0/angular-jwt'; // npm i @auth0/angular-jwt

type ApiAuthResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    role: Role;
    companyId?: string | null;
    locationId?: string | null;
    avatarUrl?: string | null;
  };
  company?: { id: string; name: string };
};

// Payload for first-user bootstrap: OrgAdmin + new organisation and optional first location.
export interface RegisterOrgAdminRequest {
  admin: {
    name: string;
    email: string;
    password: string;
  };
  company: {
    // Organisation (Company)
    name: string;
    director?: string | null;
    companyNumber?: string | null;
    CQCnumber?: string | null;                   // CQC provider id/number from search
    address?: string | null;
    registeredIn?: 'England' | 'Wales' | 'Scotland' | null;
    adminContact?: string | null;
    icon?: string | null;
    serviceTypes?: string[] | null;
  };
  location?: {
    // First site/location under the organisation
    name: string;
    address?: string | null;
    type: 'CareHome' | 'HomeCare';
    code?: string | null;                        // human-friendly or CQC location id
    cqcLocationId?: string | null;              // explicit CQC location identifier
  };
}

type InviteInfoResponse = {
  email: string;
  role: Role;
  companyName: string;
  companyId?: string | null;
  locationId?: string | null;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _currentUser = new BehaviorSubject<UserType | null>(null);
  public currentUser$ = this._currentUser.asObservable();

  public authReady$ = new BehaviorSubject<boolean>(false);
  private readonly jwtHelper = new JwtHelperService();
  readonly currentRole = signal<string>('');



  #loadRole() {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = this.jwtHelper.decodeToken(token);
      this.currentRole.set(decoded.role || ''); // From your Account.js RBAC
    }
  }

  isAdmin(): boolean {
    const role = this.currentRole();
    return ['SystemAdmin', 'OrgAdmin','RegisteredManager'].includes(role); // Your ElderPA roles
  }

  login(token: string) {
    localStorage.setItem('token', token);
    this.#loadRole();
  }
  constructor(private ls: LocalStorageService, private http: HttpClient) {
    const token = this.ls.getID('token');

    if (!token) {
      this._currentUser.next(null);
      this.authReady$.next(true);
      return;
    }

    // Validate token + hydrate user on refresh
    this.http
      .get<{ user: UserType }>('/api/auth/me')
      .pipe(
        tap((response) => this._currentUser.next(response.user)),
        catchError(() => {
          this._currentUser.next(null);
          return of(null);
        }),
        finalize(() => this.authReady$.next(true))
      )
      .subscribe();
    this.#loadRole();
  }

  // Invite flow (public)
  validateInvite(token: string): Observable<InviteInfoResponse> {
    return this.http.get<InviteInfoResponse>(`/api/auth/invite/${token}`);
  }

  registerWithInvite(token: string, name: string, password: string): Observable<ApiAuthResponse> {
    return this.http
      .post<ApiAuthResponse>('/api/auth/register-invite', { token, name, password })
      .pipe(tap((res) => this.applyAuth(res)));
  }

  // Invite creation (auth required; backend enforces allowed roles)
  sendInvite(email: string, role: Role, companyId: string, locationId?: string | null): Observable<any> {
    return this.http.post('/api/auth/invite', { email, role, companyId, locationId: locationId ?? null });
  }

  // Login
  loginWithPassword(email: string, password: string): Observable<ApiAuthResponse> {
    return this.http
      .post<ApiAuthResponse>('/api/auth/login', { email, password })
      .pipe(tap((res) => this.applyAuth(res)));
  }

  /**
   * First-user bootstrap: OrgAdmin + new Company (public)
   * Matches backend: POST /api/auth/register-org-admin
   */
  registerOrgAdmin(input: RegisterOrgAdminRequest): Observable<ApiAuthResponse> {
    return this.http
      .post<ApiAuthResponse>('/api/auth/register-org-admin', input)
      .pipe(tap((res) => this.applyAuth(res)));
  }


  isLoggedIn(): boolean {
    return !!this._currentUser.value;
  }

  logout() {
    this.ls.removeID('userId');
    this.ls.removeID('userType');
    this.ls.removeID('companyID');
    this.ls.removeID('locationID');
    this.ls.removeID('dashboardWidgets');
    this.ls.removeID('Monitored locations');
    this.ls.removeID('token');

    this._currentUser.next(null);
  }

  getCurrentUser(): UserType | null {
    return this._currentUser.value;
  }

  /** Refresh current user from API (e.g. after avatar upload/remove). */
  refreshCurrentUser(): void {
    const token = this.ls.getID('token');
    if (!token) return;
    this.http.get<{ user: UserType }>('/api/auth/me').pipe(
      tap((res) => this._currentUser.next(res.user)),
      catchError(() => of(null))
    ).subscribe();
  }

  /** Upload profile photo; file is saved on server. Returns new avatarUrl. */
  uploadAvatar(file: File): Observable<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.http.post<{ avatarUrl: string }>('/api/auth/avatar', formData).pipe(
      tap((res) => {
        const u = this._currentUser.value;
        if (u) this._currentUser.next({ ...u, avatarUrl: res.avatarUrl });
      })
    );
  }

  /** Remove profile photo from server and clear avatarUrl. */
  removeAvatar(): Observable<{ avatarUrl: null }> {
    return this.http.delete<{ avatarUrl: null }>('/api/auth/avatar').pipe(
      tap(() => {
        const u = this._currentUser.value;
        if (u) this._currentUser.next({ ...u, avatarUrl: null });
      })
    );
  }

  private applyAuth(res: ApiAuthResponse) {
    this.ls.setID('token', res.token);      // instead of localStorage.setItem
    this.ls.setID('userType', res.user.role as string);
    this.ls.setID('userId', res.user.name);

    if (res.user.companyId) this.ls.setID('companyID', res.user.companyId);
    else this.ls.removeID('companyID');

    if (res.user.locationId) this.ls.setID('locationID', res.user.locationId);
    else this.ls.removeID('locationID');

    // Keep full user object available to the app
    this._currentUser.next({
      name: res.user.name,
      role: res.user.role,
      companyId: res.user.companyId ?? null,
      locationId: res.user.locationId ?? null,
      avatarUrl: res.user.avatarUrl ?? null,
    });
  }


}
