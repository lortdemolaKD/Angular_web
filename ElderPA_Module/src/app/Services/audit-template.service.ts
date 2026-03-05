import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuditTemplate, CustomAuditTemplate } from '../components/Types';

@Injectable({
  providedIn: 'root'
})
export class AuditTemplateService {
  constructor(private http: HttpClient) {}

  // ========== Regular Audit Templates (existing) ==========

  list(companyId?: string): Observable<AuditTemplate[]> {
    let params = new HttpParams();
    if (companyId) params = params.set('companyId', companyId);
    return this.http.get<AuditTemplate[]>('/api/auditTemplates', { params });
  }

  get(id: string): Observable<AuditTemplate> {
    return this.http.get<AuditTemplate>(`/api/auditTemplates/${id}`);
  }

  create(payload: Partial<AuditTemplate>): Observable<AuditTemplate> {
    return this.http.post<AuditTemplate>('/api/auditTemplates', payload);
  }

  update(id: string, payload: Partial<AuditTemplate>): Observable<AuditTemplate> {
    return this.http.patch<AuditTemplate>(`/api/auditTemplates/${id}`, payload);
  }

  // ========== Custom Audit Templates (NEW) ==========

  /**
   * List custom templates with optional filters
   */
  listCustom(filters?: {
    organizationId?: string;
    locationId?: string;
    type?: string;
    status?: string;
    createdBy?: string;
  }): Observable<CustomAuditTemplate[]> {
    let params = new HttpParams();

    if (filters?.locationId) params = params.set('locationId', filters.locationId);
    if (filters?.type) params = params.set('type', filters.type);
    if (filters?.status) params = params.set('status', filters.status);

    return this.http.get<CustomAuditTemplate[]>('/api/customAuditTemplates', { params });
  }

  /**
   * Get a single custom template by ID
   */
  getCustom(id: string): Observable<CustomAuditTemplate> {
    return this.http.get<CustomAuditTemplate>(`/api/customAuditTemplates/${id}`);
  }

  /**
   * Create a new custom template
   */
  createCustom(payload: Partial<CustomAuditTemplate>): Observable<CustomAuditTemplate> {
    return this.http.post<CustomAuditTemplate>('/api/customAuditTemplates', payload);
  }

  /**
   * Update an existing custom template
   */
  updateCustom(id: string, payload: Partial<CustomAuditTemplate>): Observable<CustomAuditTemplate> {
    return this.http.patch<CustomAuditTemplate>(`/api/customAuditTemplates/${id}`, payload);
  }

  /**
   * Archive (soft delete) a custom template
   */
  deleteCustom(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/api/customAuditTemplates/${id}`);
  }

  /**
   * Clone an existing template
   */
  cloneCustom(id: string, options: {
    newName?: string;
    newOrganizationId?: string;
    newLocationId?: string;
  }): Observable<CustomAuditTemplate> {
    return this.http.post<CustomAuditTemplate>(`/api/customAuditTemplates/${id}/clone`, options);
  }

  /**
   * Publish a template (change from draft to active)
   */
  publishCustom(id: string, publishedBy: string): Observable<CustomAuditTemplate> {
    return this.http.post<CustomAuditTemplate>(`/api/customAuditTemplates/${id}/publish`, { publishedBy });
  }
}
