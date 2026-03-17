import { Component, computed, effect, signal, inject, OnDestroy } from '@angular/core';
import { skip } from 'rxjs';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuditDataService } from '../../../Services/audit-data.service';
import { ScoringService } from '../../../Services/scoring.service';

import {AuditInstance, AuditQuestionInstance,  LocationType} from '../../Types';
import { AuditList } from '../audit-list/audit-list';
import { QuestionList } from '../question-list/question-list';
import { EvidenceList } from '../evidence-list/evidence-list';
import { CSTButton } from '../../cst-button/cst-button';

import { AuthService } from '../../../Services/Auth.service';
import { CompanyService } from '../../../Services/Company.service';
import { LocalStorageService } from '../../../Services/LocalStorage.service';
import { FormRendererComponent } from '../../flexible-template-system/modes/form-mode/form-renderer.component';
import { LocationService } from '../../../Services/location.service';
import {AuditResponse, CustomAuditTemplate} from '../../flexible-template-system/shared/models/template.models';
import {AuditService} from '../../../Services/audit.service';
import {AuditTemplateService} from '../../../Services/audit-template.service';

@Component({
  selector: 'app-audit-panel',
  standalone: true,
  imports: [CommonModule, RouterModule, KeyValuePipe, AuditList, QuestionList, EvidenceList, CSTButton, FormRendererComponent],
  templateUrl: './audit-panel.html',
  styleUrl: './audit-panel.css'
})
export class AuditPanel implements OnDestroy {
  readonly #auditService = inject(AuditDataService);
  readonly #router = inject(Router);
  readonly #scoringService = inject(ScoringService);
  readonly #authService = inject(AuthService);
  readonly #companyService = inject(CompanyService);
  readonly #ls = inject(LocalStorageService);

  readonly audits = signal<AuditInstance[]>([]);
  readonly selectedAudit = signal<AuditInstance | null>(null);
  readonly selectedQuestion = signal<AuditQuestionInstance | null>(null);

  readonly isAdmin = signal(false); // SystemAdmin, OrgAdmin, etc.
  readonly auditsWithStatus = computed(() =>
    this.audits().map(a => ({
      ...a,
      status: (a.questions ?? []).every(q => (q.evidence ?? []).length > 0) ? 'Complete' : 'Not Complete',
      isCustom: (a.questions ?? []).some(q => !!q.customFields) // Detect custom data
    }))
  );
  readonly auditListData = computed(() =>
    this.audits().map(a => ({
      ...a,
      status: (a.questions ?? []).every(q => (q.evidence ?? []).length > 0) ? 'Complete' : 'Not Complete'
    })) as AuditInstance[]
  );
  readonly selectedAuditQuestions = computed(() => this.selectedAudit()?.questions ?? []);
  readonly selectedEvidence = computed(() => this.selectedQuestion()?.evidence ?? []);
  readonly overallScore = computed(() => {
    const audit = this.selectedAudit();
    return audit ? this.#scoringService.computeOverallScore(audit) : 0;
  });
  readonly domainScores = computed(() => {
    const audit = this.selectedAudit();
    return audit ? this.#scoringService.computeDomainScores(audit) : {};
  });

  /** True when audit has domain scores from measures */
  readonly hasDomainScores = computed(() => Object.keys(this.domainScores()).length > 0);
  /** True when we should show overall score (audit has score or has domain scores) */
  readonly hasOverallScore = computed(() => {
    const score = this.overallScore();
    const domains = this.domainScores();
    return (score != null && score > 0) || Object.keys(domains).length > 0;
  });

  /** Timeline events for the selected audit (creation, updates, submission, status) with "who" */
  readonly auditTimeline = computed(() => {
    const a = this.selectedAudit();
    if (!a) return [];
    const createdDate = a.createdAt || a.date || '';
    type Event = { label: string; date: string; by?: string; type: 'created' | 'updated' | 'submitted' | 'completed' | 'status' };
    const events: Event[] = [];
    if (createdDate) {
      events.push({ label: 'Created', date: createdDate, by: a.createdBy, type: 'created' });
    }
    if (a.updatedAt && a.updatedAt !== createdDate) {
      events.push({ label: 'Last updated', date: a.updatedAt, by: a.updatedBy, type: 'updated' });
    }
    if (a.submittedAt) {
      events.push({ label: 'Submitted', date: a.submittedAt, by: a.submittedBy, type: 'submitted' });
    }
    if (a.completedAt) {
      events.push({ label: 'Completed', date: a.completedAt, by: a.completedBy, type: 'completed' });
    }
    if (a.status && a.status !== 'Not Complete') {
      events.push({ label: 'Status: ' + a.status, date: a.updatedAt || a.createdAt || '', by: a.updatedBy, type: 'status' });
    }
    events.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
    return events;
  });

  readonly locations = signal<LocationType[]>([]);
  readonly #locationService = inject(LocationService);

  private companyChangeSub?: { unsubscribe: () => void };

  constructor() {
    this.#loadAudits();
    // When admin switches company in navbar, reload audits for the new company
    this.companyChangeSub = this.#companyService.currentCompany$
      .pipe(skip(1))
      .subscribe(() => {
        if (this.#authService.isAdmin()) this.#loadAudits();
      });
    effect(() => {
      this.isAdmin.set(this.#authService.isAdmin()); // e.g., ['SystemAdmin', 'OrgAdmin'].includes(role)
    });
    // Locations: non-admin sees only their assigned location; admin uses list (needs companyId from elsewhere)
    effect(() => {
      const isAdmin = this.#authService.isAdmin();
      if (!isAdmin) {
        this.#locationService.listMyAssigned().subscribe({
          next: (dbLocs) => {
            const typedLocs: LocationType[] = (dbLocs ?? []).map(loc => ({
              locationID: loc.id,
              cmpID: loc.companyId,
              name: loc.name,
              type: loc.type as 'CareHome' | 'HomeCare',
              departments: loc.departments ?? [],
            }));
            this.locations.set(typedLocs);
          },
          error: () => this.locations.set([])
        });
      } else {
        this.#locationService.list(/* companyId from app context if needed */).subscribe({
          next: (dbLocs) => {
            const typedLocs: LocationType[] = (dbLocs ?? []).map(loc => ({
              locationID: loc.id,
              cmpID: loc.companyId,
              name: loc.name,
              type: loc.type as 'CareHome' | 'HomeCare',
              departments: loc.departments ?? [],
            }));
            this.locations.set(typedLocs);
          },
          error: () => this.locations.set([])
        });
      }
    });
    effect(() => {
      const list = this.auditsWithStatus();
      if (!this.selectedAudit() && list.length > 0) {
        this.selectedAudit.set(list[0] as AuditInstance);
      }
    });
    effect(() => {
      const audit = this.selectedAudit();
      const isCustom = this.isSelectedCustom(); // your computed or method

      if (!audit || !audit.templateId || !isCustom) {
        this.customTemplate.set(null);
        return;
      }

      // Kick off async load (no async in effect body)
      this.loadCustomTemplate(audit.templateId);
    });
  }
  private async loadCustomTemplate(templateId: string) {
    try {
      const tmpl = await this.#templateService.getCustom(templateId).toPromise();
      // Type assertion if service returns broader type
      this.customTemplate.set(tmpl as CustomAuditTemplate ?? null);
    } catch (err) {
      console.error('Failed to load template:', err);
      this.customTemplate.set(null);
    }
  }
  #loadAudits() {
    const user = this.#authService.getCurrentUser();
    const isAdmin = this.#authService.isAdmin();
    if (!isAdmin && user && (user as any).locationId) {
      this.#auditService
        .loadForContextObservable(null, (user as any).locationId, null)
        .subscribe((items) => this.#setAuditsFromResponse(items ?? []));
      return;
    }
    // Admin: scope to current company so audit library only shows audits for that company's locations
    const companyId = this.#companyService.getCurrentCompany()?._id ?? this.#ls.getID('companyID') ?? null;
    this.#auditService
      .loadForContextObservable(companyId, null, null)
      .subscribe((items) => this.#setAuditsFromResponse(items ?? []));
  }

  ngOnDestroy() {
    this.companyChangeSub?.unsubscribe();
  }

  #setAuditsFromResponse(list: AuditInstance[]) {
    const audits = list.map(a => ({
      ...a,
      id: a.id || a._id?.toString() || `audit-${Math.random()}`
    }));
    this.audits.set(audits);
  }

  onAuditSelected(audit: AuditInstance) {
    console.log('Audit selected:', audit);
    this.selectedAudit.set(audit);
    this.selectedQuestion.set(null);
  }

  onQuestionSelected(q: AuditQuestionInstance) {
    this.selectedQuestion.set(q);
  }

  async onApproveAudit(audit: AuditInstance) {
    if (!this.isAdmin()) return;
    // Call service to update status to 'Approved'
    await this.#auditService.approveAudit(audit.id); // Implement in service
    await this.#loadAudits(); // Refresh
  }

  createNewAudit() {
    this.#router.navigate(['/ccga/audit-creator']);
  }

  editSelectedAudit() {
    const audit = this.selectedAudit();
    if (!audit) return;
    this.#router.navigate(['/ccga/audit-creator'], {queryParams: {auditId: audit.id}});
  }

  protected moveTo(path: string) {
    this.#router.navigate([path]);
  }

  private findLocation(locationId?: string): LocationType | null {
    if (!locationId) return null;
    return this.locations().find(l => l.locationID === locationId) ?? null;
  }

  getLocationName(locationId?: string): string {
    return this.findLocation(locationId)?.name ?? 'Unknown';
  }

  getDepartmentName(locationId?: string, departmentId?: string): string {
    const loc = this.findLocation(locationId);
    const dept = loc?.departments?.find((d: any) => d.id === departmentId);
    return dept?.name ?? '';
  }

  getSubDepartmentName(locationId?: string, departmentId?: string, subDepartmentId?: string): string {
    const loc = this.findLocation(locationId);
    const dept = loc?.departments?.find((d: any) => d.id === departmentId);
    const sub = dept?.subDepartments?.find((s: any) => s.id === subDepartmentId);
    return sub?.name ?? '';
  }

  readonly isSelectedCustom = computed(() => {
    const audit = this.selectedAudit();
    if (!audit) return false;
    return (audit.questions ?? []).some(q => !!q.customFields);
  });

  readonly #templateService = inject(AuditTemplateService);  // Your service
  readonly customTemplate = signal<CustomAuditTemplate | null>(null);

  getCustomResponses(): AuditResponse {
    const audit = this.selectedAudit();
    if (!audit) {
      return { id: '', templateId: '', date: '', responses: {} } as AuditResponse;
    }

    const responses: Record<string, any> = {};
    audit.questions?.forEach(q => {
      if (q.templateQuestionId && q.customFields) {
        const cf = q.customFields;
        // Use normalized value; renderer will know field.type from template
        responses[q.templateQuestionId] = cf.value ?? cf.rawResponse ?? null;
      }
    });

    return {
      id: audit.id!,
      templateId: audit.templateId!,
      date: audit.date,
      responses
    };
  }
}







