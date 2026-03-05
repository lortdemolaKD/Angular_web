import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuditEvidence } from '../components/Types';

@Injectable({ providedIn: 'root' })
export class EvidenceService {
  constructor(private http: HttpClient) {}

  // Evidence library (search/list)
  list(filters: { companyId?: string; locationId?: string; q?: string } = {}): Observable<AuditEvidence[]> {
    let params = new HttpParams();
    if (filters.companyId) params = params.set('companyId', filters.companyId);
    if (filters.locationId) params = params.set('locationId', filters.locationId);
    if (filters.q) params = params.set('q', filters.q);
    return this.http.get<AuditEvidence[]>('/api/evidence', { params });
  }

  // Create TEXT evidence (library item)
  createText(payload: Partial<AuditEvidence>): Observable<AuditEvidence> {
    // payload: { type:'text', description, content, uploadedBy, uploadedAt, ... }
    return this.http.post<AuditEvidence>('/api/evidence', payload);
  }

  // Upload FILE evidence (library item + stored file)
  uploadFile(file: File, meta: { description?: string; uploadedBy?: string } = {}): Observable<AuditEvidence> {
    const fd = new FormData();
    fd.append('file', file);
    if (meta.description) fd.append('description', meta.description);
    if (meta.uploadedBy) fd.append('uploadedBy', meta.uploadedBy);
    return this.http.post<AuditEvidence>('/api/evidence/upload', fd);
  }

  // Attach evidence to a specific audit question row
  attachToQuestion(auditId: string, templateQuestionId: string, evidence: AuditEvidence) {
    return this.http.post(`/api/audits/${auditId}/questions/${templateQuestionId}/evidence`, evidence);
  }

  // Remove evidence from a question row (by evidence id)
  removeFromQuestion(auditId: string, templateQuestionId: string, evidenceId: string) {
    return this.http.delete(
      `/api/audits/${auditId}/questions/${templateQuestionId}/evidence/${evidenceId}`
    );
  }
}
