import { Component, computed, effect, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuditDataService } from '../../../Services/audit-data.service';
import { ScoringService } from '../../../Services/scoring.service';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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
import { AuditField, AuditResponse, CustomAuditTemplate } from '../../flexible-template-system/shared/models/template.models';
import {AuditService} from '../../../Services/audit.service';
import {AuditTemplateService} from '../../../Services/audit-template.service';
import { WalkthroughRegistryService } from '../../../Services/walkthrough-registry.service';
import { buildCustomResponsesFromQuestions } from '../shared/custom-audit-responses.util';
import { isAuditLibDebug, isWorkerTimetableTitle, logWorkerTimetableAuditsData } from '../audit-lib-debug';

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
  readonly #route = inject(ActivatedRoute);
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
  readonly #pendingSelectAuditId = signal<string | null>(null);
  readonly #auditHttp = inject(AuditService);
  readonly #lastAdminLoadKey = signal<string>('');

  #auditId(a: AuditInstance | null | undefined): string {
    return String((a as any)?.id ?? (a as any)?._id ?? '').trim();
  }

  /**
   * When merging location-only API results (same query as Bonus/YGP), drop rows that clearly belong
   * to another company. Audits with missing companyId are kept — they are the usual case for custom
   * location audits that only show up under ?locationId=.
   *
   * If the audit's `locationId` is one of this company's known sites, always keep it: the request
   * was scoped to that site. Older audits sometimes have a stale/wrong `companyId` string (duplicate
   * org rows, legacy IDs), which would otherwise hide February while March still matches.
   */
  #auditBelongsToCompanyScope(
    a: AuditInstance,
    companyId: string | null,
    knownLocationIds: string[]
  ): boolean {
    const auditLoc = String((a as any).locationId ?? '').trim();
    if (auditLoc && knownLocationIds.includes(auditLoc)) {
      return true;
    }
    if (!companyId) return true;
    const cid =
      (a as any).companyId ??
      (a as any).companyID ??
      (a as any).cmpId ??
      (a as any).cmpID;
    if (cid == null || cid === '') return true;
    return String(cid).trim() === String(companyId).trim();
  }

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
        targetId: 'auditPanel.listFiltersToolbar',
        title: 'Grouping and date range',
        description:
          'Group by: choose how rows are organised (for example by type, location, or status). Groups appear as collapsible sections with counts. Date range: set From and To to only show audits whose schedule date falls in that range (inclusive). The filter runs first, then grouping is applied. If nothing matches, you will see a “no audits” message. Clear range removes the date filter.',
        panelPlacement: 'right',
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
        // Admin: scope locations to current company to avoid cross-company audit leakage.
        const cur = this.#companyService.getCurrentCompany();
        const companyId =
          (cur as any)?.id ??
          (cur as any)?._id ??
          (cur as any)?.companyID ??
          this.#ls.getID('companyID') ??
          null;
        this.#locationService.list(companyId || undefined).subscribe({
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

    // Admin: once locations are known, reload audits so location-scoped audits appear.
    effect(() => {
      if (!this.#authService.isAdmin()) return;
      const cur = this.#companyService.getCurrentCompany();
      const companyId =
        (cur as any)?.id ??
        (cur as any)?._id ??
        (cur as any)?.companyID ??
        this.#ls.getID('companyID') ??
        '';
      const locIds = this.locations().map((l) => l.locationID).filter(Boolean).join(',');
      const key = `${companyId}::${locIds}`;
      if (!companyId || !locIds) return;
      if (this.#lastAdminLoadKey() === key) return;
      this.#lastAdminLoadKey.set(key);
      this.#loadAudits();
    });
    effect(() => {
      const list = this.auditsWithStatus();
      if (!this.selectedAudit() && list.length > 0) {
        this.selectedAudit.set(list[0] as AuditInstance);
      }
    });

    // Allow deep-link selection from planner/widget: /CCGA/AuditLib?auditId=...
    this.#route.queryParams.subscribe((p) => {
      const id = String(p?.['auditId'] ?? '').trim();
      this.#pendingSelectAuditId.set(id || null);
    });
    effect(() => {
      const pendingId = this.#pendingSelectAuditId();
      if (!pendingId) return;
      const found = this.audits().find((a) => {
        const id = String((a as any)?.id ?? (a as any)?._id ?? '').trim();
        return id === pendingId;
      });
      if (!found) return;
      this.selectedAudit.set(found);
      this.#pendingSelectAuditId.set(null);
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
      // Fallback: synthesize a template from the audit questions so tables still render.
      const audit = this.selectedAudit();
      const questions = audit?.questions ?? [];
      if (audit && questions.length > 0) {
        const fields: AuditField[] = questions.map((q: any, i: number) => {
          const custom = q?.customFields;
          const fieldType = (custom?.fieldType as string | undefined) ?? 'text';
          const id = String(custom?.fieldId ?? q?.templateQuestionId ?? `field-${i}`);
          const label = String(q?.text ?? q?.clauseLabel ?? `Field ${i + 1}`);
          const base: any = { id, label, required: false };
          if (fieldType === 'table') return { ...base, type: 'table', tableConfig: custom?.tableConfig } as any;
          if (fieldType === 'checkbox') return { ...base, type: 'checkbox' } as any;
          if (fieldType === 'textarea') return { ...base, type: 'textarea' } as any;
          if (fieldType === 'number') return { ...base, type: 'number' } as any;
          if (fieldType === 'date') return { ...base, type: 'date' } as any;
          if (fieldType === 'question') return { ...base, type: 'question' } as any;
          return { ...base, type: 'text' } as any;
        });
        this.customTemplate.set({
          id: String((audit as any).templateId ?? audit.id ?? (audit as any)._id ?? 'audit-synth'),
          name: String((audit as any).title ?? 'Audit'),
          type: 'audit',
          fields,
          status: 'active',
        } as unknown as CustomAuditTemplate);
      } else {
        this.customTemplate.set(null);
      }
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
    // Some backend deployments only return location-scoped custom audits when locationId is passed.
    // Bonus/YGP use GET /api/audits?locationId=... (no companyId); those rows can be missing companyId
    // on the document, so companyId+locationId queries omit them. Merge location-only results per
    // known location, then filter to the current company (see #auditBelongsToCompanyScope).
    const locIds = this.locations()
      .map((l) => l.locationID)
      .filter((id): id is string => !!id);
    if (isAuditLibDebug()) {
      console.groupCollapsed('[AuditLib] load audits (admin)');
      console.log('companyId', companyId);
      console.log('locationIds', locIds);
      console.groupEnd();
    }
    const calls = [
      this.#auditHttp.list({ companyId }).pipe(catchError(() => of([] as AuditInstance[]))),
      ...locIds.map((locationId) =>
        this.#auditHttp.list({ companyId, locationId }).pipe(catchError(() => of([] as AuditInstance[])))
      ),
      ...(companyId
        ? locIds.map((locationId) =>
            this.#auditHttp.list({ locationId }).pipe(
              catchError(() => of([] as AuditInstance[])),
              map((items) =>
                (items ?? []).filter((a) =>
                  this.#auditBelongsToCompanyScope(a, companyId, locIds)
                )
              )
            )
          )
        : []),
    ];
    forkJoin(calls).subscribe((lists) => {
      const merged = (lists ?? []).flat();
      const timetableMatches = (merged ?? []).filter((a) => isWorkerTimetableTitle((a as any)?.title));
      if (isAuditLibDebug()) {
        console.groupCollapsed('[AuditLib] audits fetched (admin)');
        console.log('raw lists sizes', (lists ?? []).map((x) => (x ?? []).length));
        console.log('merged count', merged.length);
        console.log(
          'timetable matches',
          timetableMatches.map((a) => ({
            id: this.#auditId(a),
            title: (a as any).title,
            auditType: (a as any).auditType,
            companyId: (a as any).companyId,
            locationId: (a as any).locationId,
            templateId: (a as any).templateId,
            questionsCount: (a as any)?.questions?.length ?? 0,
            hasCustomFields: ((a as any)?.questions ?? []).some((q: any) => !!q?.customFields),
            hasResponses: !!(a as any)?.responses || !!(a as any)?.formResponse,
          }))
        );
        console.log(
          'merged summary (all)',
          merged.map((a) => ({
            id: this.#auditId(a),
            title: (a as any).title,
            companyId: (a as any).companyId,
            locationId: (a as any).locationId,
            q: (a as any)?.questions?.length ?? 0,
          }))
        );
        console.groupEnd();
      }
      if (isAuditLibDebug()) {
        logWorkerTimetableAuditsData(merged, 'merged API result (may include duplicates before dedupe)');
      }
      this.#setAuditsFromResponse(merged);
    });
  }

  ngOnDestroy() {
    this.companyChangeSub?.unsubscribe();
  }

  #setAuditsFromResponse(list: AuditInstance[]) {
    const byId = new Map<string, AuditInstance>();
    (list ?? []).forEach((a) => {
      const id = this.#auditId(a) || `audit-${Math.random()}`;
      const next = { ...a, id } as AuditInstance;
      // Prefer the one with questions payload if duplicates exist.
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, next);
        return;
      }
      const prevQ = (prev.questions ?? []).length;
      const nextQ = ((next as any).questions ?? []).length;
      if (nextQ > prevQ) byId.set(id, next);
    });
    const finalList = Array.from(byId.values());
    this.audits.set(finalList);
    if (isAuditLibDebug()) {
      console.table(
        finalList.map((a) => ({
          id: this.#auditId(a),
          title: String((a as any).title ?? ''),
          companyId: String((a as any).companyId ?? ''),
          locationId: String((a as any).locationId ?? ''),
          q: (a as any)?.questions?.length ?? 0,
        }))
      );
      logWorkerTimetableAuditsData(finalList, 'deduped library (what the table shows)');
    }
  }

  onAuditSelected(audit: AuditInstance) {
    if (isAuditLibDebug()) {
      console.log('[AuditLib] audit selected (list row)', {
        id: String((audit as any)?.id ?? (audit as any)?._id ?? ''),
        title: (audit as any)?.title,
        companyId: (audit as any)?.companyId,
        locationId: (audit as any)?.locationId,
        questions: (audit as any)?.questions?.length ?? 0,
      });
    }
    this.selectedAudit.set(audit);
    this.selectedQuestion.set(null);

    // The list endpoint may omit full question/customFields payloads; fetch the full audit by id
    // so the read-only "Responses (full audit)" view is not empty.
    const id = String((audit as any)?.id ?? (audit as any)?._id ?? '').trim();
    if (!id) return;
    this.#auditHttp
      .get(id)
      .pipe(catchError(() => of(audit)))
      .subscribe((full) => {
        if (!full) return;
        if (isWorkerTimetableTitle((full as any)?.title) && isAuditLibDebug()) {
          logWorkerTimetableAuditsData(
            [{ ...(full as any), id: (full as any).id ?? (full as any)._id ?? id } as AuditInstance],
            'GET /api/audits/:id (full payload after select)'
          );
        }
        this.selectedAudit.set({ ...(full as any), id: (full as any).id ?? (full as any)._id ?? id } as AuditInstance);
      });
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

    let responses = buildCustomResponsesFromQuestions(audit.questions);
    const stored = (audit as any).responses ?? (audit as any).formResponse;
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      const nested = (stored as any).responses;
      const flat = nested && typeof nested === 'object' ? nested : stored;
      if (flat && typeof flat === 'object' && !Array.isArray(flat)) {
        responses = { ...responses, ...flat };
      }
    }

    return {
      id: audit.id!,
      templateId: audit.templateId!,
      date: audit.date,
      responses
    };
  });
}







