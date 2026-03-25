import { Injectable, computed, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuditInstance } from '../components/Types';
import { catchError, map, of, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuditDataService {
  private readonly API_BASE = '/api/audits';

  // DB standard: start empty, load from API
  private readonly _audits = signal<AuditInstance[]>([]);
  readonly audits = computed(() => this._audits());

  constructor(private http: HttpClient) {}

  private normalizeAudit(a: AuditInstance & { _id?: string }): AuditInstance {
    const id = a.id ?? (a._id != null ? String(a._id) : '');
    return { ...a, id } as AuditInstance;
  }

  /** Builds params and returns observable for loading audits (caller can subscribe). */
  loadForContextObservable(companyId?: string | null, locationId?: string | null, templateId?: string | null) {
    let params = new HttpParams();
    if (companyId) params = params.set('companyId', companyId);
    if (locationId) params = params.set('locationId', locationId);
    if (templateId) params = params.set('templateId', templateId);
    return this.http.get<AuditInstance[]>(this.API_BASE, { params }).pipe(
      map((items) => (items ?? []).map((a) => this.normalizeAudit(a as any))),
      tap((items) => this._audits.set(items)),
      catchError((err) => {
        console.error('loadForContext error', err);
        this._audits.set([]);
        return of([]);
      })
    );
  }

  /** Loads audits from DB and updates internal state (subscribes). */
  loadForContext(companyId?: string | null, locationId?: string | null, templateId?: string | null) {
    return this.loadForContextObservable(companyId, locationId, templateId).subscribe();
  }
  async approveAudit(auditId: string): Promise<void> {
    await this.http.patch(`/api/audits/${auditId}`, { status: 'Complete' }).toPromise();
    // Optional: Notify via your email service
  }
  /** Convenience wrapper: only by locationId */
  loadForLocation(locationId: string) {
    return this.loadForContext(null, locationId, null);
  }

  /** Convenience wrapper: only by templateId */
  loadForTemplate(templateId: string) {
    return this.loadForContext(null, null, templateId);
  }

  /** GET one audit by id from DB (and optionally merge into cache). */
  fetchById(auditId: string) {
    return this.http.get<AuditInstance>(`${this.API_BASE}/${auditId}`).pipe(
      map((audit) => this.normalizeAudit(audit as any)),
      tap((audit) => {
        if (!audit) return;
        const audits = [...this._audits()];
        const idx = audits.findIndex(a => a.id === audit.id);
        if (idx >= 0) audits[idx] = audit;
        else audits.push(audit);
        this._audits.set(audits);
      })
    );
  }

  /** Create audit in DB (POST /api/audits). */
  create(audit: Partial<AuditInstance>) {
    return this.http.post<AuditInstance>(this.API_BASE, audit).pipe(
      tap((created) => {
        const audits = [...this._audits()];
        audits.unshift(created);
        this._audits.set(audits);
      })
    );
  }

  /** Patch audit in DB (PATCH /api/audits/:id). */
  patch(id: string, update: Partial<AuditInstance>) {
    return this.http.patch<AuditInstance>(`${this.API_BASE}/${id}`, update).pipe(
      tap((updated) => {
        const audits = [...this._audits()];
        const idx = audits.findIndex(a => a.id === updated.id);
        if (idx >= 0) audits[idx] = updated;
        else audits.push(updated);
        this._audits.set(audits);
      })
    );
  }

  /** Local helpers (still useful for UI) */
  getAuditsByType(type: 'baseline' | 'registered_manager' | 'provider'): AuditInstance[] {
    return this._audits().filter(a => a.auditType === type);
  }

  getAuditById(auditId: string): AuditInstance | undefined {
    return this._audits().find(a => a.id === auditId);
  }

  /** Optional: keep these for local optimistic updates if you still want them */
  saveAuditLocal(audit: AuditInstance): void {
    const audits = [...this._audits()];
    const index = audits.findIndex(a => a.id === audit.id);
    if (index >= 0) audits[index] = audit;
    else audits.push(audit);
    this._audits.set(audits);
  }

  deleteAuditLocal(auditId: string): void {
    this._audits.set(this._audits().filter(a => a.id !== auditId));
  }
  getAllAudits(): Promise<AuditInstance[]> {
    return Promise.resolve(this.audits());
  }
}
