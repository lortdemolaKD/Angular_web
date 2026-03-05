import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type DbLocation = {
  id: string;
  companyId: string;
  name: string;
  type: 'CareHome' | 'HomeCare';
  departments?: any[];
};

@Injectable({ providedIn: 'root' })
export class LocationService {
  constructor(private http: HttpClient) {}

  list(companyId?: string): Observable<DbLocation[]> {
    let params = new HttpParams();
    if (companyId) params = params.set('companyId', companyId);
    return this.http.get<DbLocation[]>('/api/locations', { params });
  }
  /** For managers: locations where user is in staff. */
  listForManager() {
    return this.http.get<DbLocation[]>('/api/locations/my');
  }
  /** For non-admin (CareWorker, Auditor, etc.): only the location assigned to the current user. */
  listMyAssigned(): Observable<DbLocation[]> {
    return this.http.get<DbLocation[]>('/api/locations/me');
  }
  get(id: string): Observable<DbLocation> {
    return this.http.get<DbLocation>(`/api/locations/${id}`);
  }
}
