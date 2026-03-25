import { Component, computed, effect, signal, inject, OnDestroy } from '@angular/core';
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
import { WalkthroughRegistryService } from '../../../Services/walkthrough-registry.service';
import { buildCustomResponsesFromQuestions } from '../shared/custom-audit-responses.util';

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
  readonly #walkthrough = inject(WalkthroughRegistryService);

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
    this.#walkthrough.register('/CCGA/AuditLib', [
      {
        targetId: 'auditPanel.pageTitle',
        title: 'Audit Library',
        description:
          'Audit Library is where you review audits that belong to your company. The left side gives you an audit table (including score, type, and completion status). Select an audit to see its details, and use the right panel to inspect questions/evidence or view the full read-only responses.',
      },
      {
        targetId: 'auditPanel.newAuditButton',
        title: 'New audit',
        description:
          'Create a new audit. Use this when you need to start a new audit cycle (or a new audit for the chosen scope). You can later edit the audit in the Audit Creator.',
      },
      {
        targetId: 'auditPanel.auditsListHeader',
        title: 'Audit list',
        description:
          'This table contains all audits for your company. You can select an audit to open it. Some audits require approval (they are not completed yet and must be approved by higher authorities). The table also shows key information like score and audit type.',
      },
      {
        targetId: 'auditPanel.approveAuditButton',
        title: 'Approve audit',
        description:
          'If you have admin permissions, use “Approve audit” to approve this audit. Approving updates the audit status and influences connected data across the system (for example scoring and any indicators that depend on it).',
      },
      {
        targetId: 'auditPanel.questionsOrResponsesHeader',
        title: 'Questions & evidence',
        description:
          'This panel is view-only in the library. You can switch between questions/evidence and full responses, but you cannot edit here. If you need to make changes, open the audit in the Audit Creator instead.',
      },
    ]);

    // Admin: reload when company is set/changed (API uses `id`, not `_id` — first load must run after company fetch)
    this.companyChangeSub = this.#companyService.currentCompany$.subscribe(() => {
      if (this.#authService.isAdmin()) this.#loadAudits();
    });
    if (!this.#authService.isAdmin()) {
      this.#loadAudits();
    }
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
    // Admin: scope to current company (CompanyService maps API → `id`, not Mongo `_id`)
    const cur = this.#companyService.getCurrentCompany();
    const companyId =
      (cur as any)?.id ??
      (cur as any)?._id ??
      (cur as any)?.companyID ??
      this.#ls.getID('companyID') ??
      null;
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
    this.#router.navigate(['/CCGA/AuditCreator']);
  }

  editSelectedAudit() {
    const audit = this.selectedAudit();
    if (!audit) return;
    const auditId = audit.id || (audit as any)._id?.toString?.();
    if (!auditId) return;
    this.#router.navigate(['/CCGA/AuditCreator'], { queryParams: { auditId } });
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

  // Memoized response object prevents readonly form from rebuilding every change detection cycle.
  readonly selectedCustomResponse = computed<AuditResponse>(() => {
    const audit = this.selectedAudit();
    if (!audit) {
      return { id: '', templateId: '', date: '', responses: {} } as AuditResponse;
    }

    const responses = buildCustomResponsesFromQuestions(audit.questions);

    return {
      id: audit.id!,
      templateId: audit.templateId!,
      date: audit.date,
      responses
    };
  });
}







