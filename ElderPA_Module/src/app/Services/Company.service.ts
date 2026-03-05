import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './Auth.service';
import { LocalStorageService } from './LocalStorage.service'; // Added
import { CompanyType, LocationType, Role } from '../components/Types'; // Added Role

export interface CompanyData {
  name: string;
  director?: string;
  companyNumber?: string;
  CQCnumber?: string;
  address?: string;
  registeredIn?: 'England' | 'Wales' | 'Scotland';
  adminContact?: string;
  serviceTypes?: string[];
}

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private _currentCompany = new BehaviorSubject<CompanyType | null>(null);
  currentCompany$ = this._currentCompany.asObservable();

  private _currentLocation = new BehaviorSubject<LocationType | null>(null);
  currentLocation$ = this._currentLocation.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private ls: LocalStorageService // Injected
  ) {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    // Logic moved INSIDE constructor
    const role = user.role as Role;
    const isOrgAdminLike = ['SystemAdmin', 'OrgAdmin'].includes(role);
    const isLocationScoped = [
      'RegisteredManager', 'Supervisor', 'CareWorker',
      'SeniorCareWorker', 'Auditor'
    ].includes(role);

    if (isOrgAdminLike) {
      const companyId = this.ls.getID('companyID') || (user as any).companyId;
      if (companyId) this.setCurrentCompany(companyId);
    }

    if (isLocationScoped) {
      const locationId = this.ls.getID('locationID') || (user as any).locationId;
      if (locationId) this.ls.setID('locationID', locationId);
      // Do not call setCurrentLocation here: GET /api/locations/:id can 403 for care workers.
      // Location data is set when Locations/Dashboard load via listMyAssigned() and call setCurrentLocation(id, data).
    }
  }

  setCurrentCompany(companyId: string) {
    if (!companyId) return;

    this.http.get<CompanyType>(`/api/companies/${companyId}`).subscribe({
      next: (company) => {
        this._currentCompany.next(company);
        this.ls.setID('companyID', companyId);
      },
      error: () => {
        console.warn('Company not found:', companyId);
        this._currentCompany.next(null);
      }
    });
  }

  /**
   * Set current location. If locationData is provided (e.g. from listMyAssigned), use it and do not call the API.
   * This avoids GET /api/locations/:id which can return 403 for care workers.
   */
  setCurrentLocation(locationId: string, locationData?: LocationType | null) {
    if (!locationId) return;

    if (locationData != null) {
      this._currentLocation.next(locationData);
      this.ls.setID('locationID', locationId);
      return;
    }

    this.http.get<LocationType>(`/api/locations/${locationId}`).subscribe({
      next: (loc) => {
        this._currentLocation.next(loc);
        this.ls.setID('locationID', locationId);
      },
      error: () => this._currentLocation.next(null)
    });
  }

  getCurrentCompany(): CompanyType | null {
    return this._currentCompany.value;
  }

  getCurrentLocation(): LocationType | null {
    return this._currentLocation.value;
  }

  createCompany(data: CompanyData): Observable<CompanyType> {
    return this.http.post<CompanyType>('/api/companies', data);
  }

  createAndSelectCompany(data: CompanyData): Observable<CompanyType> {
    return this.createCompany(data).pipe(
      tap((newCompany: CompanyType) => {
        // Handle both _id (MongoDB) and id (Frontend type)
        const id = newCompany._id || (newCompany as any)._id;
        if (id) {
          this.setCurrentCompany(id);
        }
      })
    );
  }
}
