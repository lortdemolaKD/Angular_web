// services/setup.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface InviteEntry { email: string; role: string; }

@Injectable({ providedIn: 'root' })
export class SetupService {
  constructor(private http: HttpClient) {}

  createCompanyFull(payload: any) {
    return this.http.post('/api/setup/company', payload);
  }
  updateCompany(companyId: string, data: any): Observable<any> {
    return this.http.put(`/api/companies/${companyId}`, data);
  }

  /**
   * After creating/updating organisation and locations, send invites to the listed users.
   * Backend should create invite links and email them (or return links).
   * items: array of { locationId? (if known), invites: { email, role }[] }.
   */
  sendInvitesAfterSetup(
    companyId: string,
    items: { locationId?: string; invites: InviteEntry[] }[]
  ): Observable<any> {
    return this.http.post('/api/setup/send-invites', { companyId, locations: items });
  }
}
