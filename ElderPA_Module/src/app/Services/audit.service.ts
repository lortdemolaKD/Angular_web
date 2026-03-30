import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuditInstance, AuditQuestionInstance, CustomAuditTemplate } from '../components/Types';  // Remove AuditResponse if unused

@Injectable({ providedIn: 'root' })
export class AuditService {
  constructor(private http: HttpClient) {
  }

  // ✅ EXISTING (keep)
  // In AuditService
  list(filters: { companyId?: string; locationId?: string | null; auditType?: string } = {}) {
    let params = new HttpParams();
    if (filters.companyId) params = params.set('companyId', filters.companyId);

    const loc = filters.locationId;
    if (loc && loc !== 'null') params = params.set('locationId', loc);

    // ✅ Add this line:
    if (filters.auditType) params = params.set('auditType', filters.auditType);

    return this.http.get<AuditInstance[]>('/api/audits', { params });
  }


  get(id: string): Observable<AuditInstance> {
    return this.http.get<AuditInstance>(`/api/audits/${id}`);
  }

  create(payload: Partial<AuditInstance>): Observable<AuditInstance> {
    return this.http.post<AuditInstance>('/api/audits', payload);
  }

  patch(id: string, payload: Partial<AuditInstance>): Observable<AuditInstance> {
    return this.http.patch<AuditInstance>(`/api/audits/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/audits/${id}`);
  }

  patchQuestion(auditId: string, templateQuestionId: string, payload: Partial<AuditQuestionInstance>) {
    return this.http.patch<AuditInstance>(`/api/audits/${auditId}/questions`, {
      templateQuestionId,
      patch: payload
    });
  }



  listCustomAudits() {
    return this.http.get<AuditInstance[]>('/api/audits', {
      params: { auditType: 'custom-template' }  // ✅ Matches field
    });
  }

  getCustomAudit(id: string) {
    return this.http.get<AuditInstance>(`/api/audits/${id}`);  // Existing[file:6]
  }

  createCustomAudit(payload: any) {
    return this.http.post<AuditInstance>('/api/audits', {  // Existing[file:6]
      ...payload,
      type: 'custom'
    });
  }
}
