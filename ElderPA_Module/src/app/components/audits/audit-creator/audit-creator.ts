import { Component, OnInit, signal, computed } from '@angular/core';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDropList, CdkDragDrop, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';

import { MOCK_REGULATIONS, CUSTOM_LIBRARY } from '../../mock-data';
import { CSTButton } from '../../cst-button/cst-button';
import { EvidenceDialog, EvidenceDialogResult } from '../evidence-dialog/evidence-dialog';
import {
  AuditInstance,
  AuditQuestionInstance,
  AuditEvidence,
  AuditTemplate,
  AuditFrequency,
  TemplateAuditType,
  RegulationSubsection,
  CompanyType,
  UserType,
  LocationDepartment,
  Role, AuditField
} from '../../Types';
import {
  CustomAuditTemplate,
  AuditResponse,
  TableConfiguration, AuditQuestion
} from '../../flexible-template-system/shared/models/template.models';
import { buildCustomResponsesFromQuestions } from '../shared/custom-audit-responses.util';

type RegulationItem = typeof MOCK_REGULATIONS.items[number] & {
  type?: 'Regulation' | 'Custom';
  subsections?: any[];
  domain?: string;
};
type RegulationClause = any;

import { AuthService } from '../../../Services/Auth.service';
import { CompanyService } from '../../../Services/Company.service';
import { AuditService } from '../../..//Services/audit.service';
import { AuditTemplateService } from '../../../Services/audit-template.service';
import { EvidenceService } from '../../../Services/evidence.service';
import { RecurringAuditService } from '../../../Services/recurring-audit.service';
import { LocationService } from '../../../Services/location.service';
import { firstValueFrom } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatExpansionPanelHeader, MatExpansionPanelTitle } from '@angular/material/expansion';
import { LocalStorageService } from '../../../Services/LocalStorage.service';
import { Ccga } from '../../ccga/ccga';
import { FlexibleTemplateSystem } from '../../flexible-template-system/flexible-template-system';
import {MatSnackBar} from '@angular/material/snack-bar';
import { WalkthroughRegistryService } from '../../../Services/walkthrough-registry.service';

type DbLocation = {
  id: string;
  name: string;
  departments?: LocationDepartment[];
};

@Component({
  selector: 'app-audit-creator',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    CSTButton,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    FlexibleTemplateSystem,
  ],
  templateUrl: './audit-creator.html',
  styleUrls: ['./audit-creator.css']
})
export class AuditCreator implements OnInit {

  // Core Audit State
  audits = signal<AuditInstance[]>([]);
  selectedAudit = signal<AuditInstance | null>(null);

  auditTitle = signal('');
  auditType = signal<'baseline' | 'registered_manager' | 'provider' | 'custom-template'>('baseline');
  auditDate = signal(new Date().toISOString().slice(0, 10));
  questions = signal<AuditQuestionInstance[]>([]);

  // Templates State - SEPARATED
  customTemplates = signal<any[]>([]); // { type: 'custom', fields: [] }
  normalTemplates = signal<any[]>([]); // { name, auditType, sections: [] }

  selectedNormalTemplateId = signal<string | null>(null);
  selectedCustomTemplateId = signal<string | null>(null);
  /** When editing an existing custom audit whose template is not in the list, we fetch and store it here. */
  fetchedCustomTemplate = signal<CustomAuditTemplate | null>(null);

  // Company/User
  company: CompanyType | null = null;
  user: UserType | null = null;

  // Location Selection
  locationId = signal<string | null>(null);
  departmentId = signal<string | null>(null);
  subDepartmentId = signal<string | null>(null);
  locations: DbLocation[] = [];
  companyId = signal<string | null>(null);

  selectedLocation = computed(() => this.locations.find(l => l.id === this.locationId()) ?? null);
  availableDepartments = computed(() => this.selectedLocation()?.departments ?? []);
  availableSubDepartments = computed(() => {
    const depId = this.departmentId();
    const dep = this.selectedLocation()?.departments?.find(d => d.id === depId);
    return dep?.subDepartments ?? [];
  });

  // Current template with type checking
  currentNormalTemplate = computed<AuditTemplate | undefined>(() => {
    const templateId = this.selectedNormalTemplateId();
    if (!templateId) return undefined;
    const template = this.normalTemplates().find(t => (t as any).id === templateId || (t as any)._id === templateId);
    return template as AuditTemplate | undefined;
  });

  currentCustomTemplate = computed<CustomAuditTemplate | undefined>(() => {
    const templateId = this.selectedCustomTemplateId();
    if (!templateId) return this.fetchedCustomTemplate() ?? undefined;
    const idStr = String(templateId);
    const template = this.customTemplates().find(
      t => String((t as any).id) === idStr || String((t as any)._id) === idStr
    );
    return (template as CustomAuditTemplate) ?? this.fetchedCustomTemplate() ?? undefined;
  });

  // Consolidated current template for UI
  currentTemplate = computed(() => {
    return this.activeTab() === 'daily' ? this.currentCustomTemplate() : this.currentNormalTemplate();
  });

  /** True if this audit is a custom (Daily) audit – by auditType, templateType, or backend flags. */
  private isCustomAudit(a: AuditInstance): boolean {
    if (this.normalizeAuditTypeForUi(a.auditType) === 'custom-template') return true;
    const tt = (a as any).templateType as string | undefined;
    if (tt === 'custom-checklist' || tt === 'custom-table' || tt === 'custom') return true;
    if ((a as any).type === 'custom' || (a as any).isCustom === true) return true;
    return false;
  }

  /** Audits that are custom-template only (for filtering if needed). */
  dailyAudits = computed(() =>
    this.audits().filter(a => this.isCustomAudit(a))
  );

  /** Audits that are not custom (regulation/advanced only) – for Advanced tab "Edit existing audit" dropdown. */
  advancedAudits = computed(() =>
    this.audits().filter(a => !this.isCustomAudit(a))
  );

  /** Audit id (API often returns _id only). */
  private auditId(a: AuditInstance | null): string {
    if (!a) return '';
    return String((a as any).id ?? (a as any)._id ?? '');
  }

  /** Template to show in Daily: real custom template, synthetic from audit questions, or minimal placeholder so "No template provided" never shows. */
  dailyDisplayTemplate = computed<CustomAuditTemplate | undefined>(() => {
    if (this.activeTab() !== 'daily') return undefined;
    const fromList = this.currentCustomTemplate();
    if (fromList) return fromList;
    const audit = this.selectedAudit();
    const questions = audit?.questions ?? [];
    if (audit && questions.length > 0) {
      const fields: AuditField[] = questions.map((q, i) => {
        const custom = (q as any).customFields;
        const fieldType = (custom?.fieldType as any) || 'question';
        const fieldId = q.templateQuestionId || `field-${i}`;
        return {
          id: fieldId,
          type: fieldType === 'question' ? 'question' : (fieldType === 'table' ? 'table' : fieldType === 'checkbox' || fieldType === 'checkboxes' ? 'checkbox' : 'text'),
          label: q.text || (q as any).clauseLabel || 'Question',
          required: false,
          metadata: { domain: q.domain, regulationId: q.regulationId, scoreMax: 5 },
          ...(custom?.tableConfig && { tableConfig: custom.tableConfig }),
          ...(custom?.options && { options: custom.options }),
        } as AuditField;
      });
      return {
        id: String((audit as any).templateId ?? this.auditId(audit) ?? 'audit-fallback'),
        name: (audit as any).title || 'Audit',
        type: 'audit',
        fields,
        status: 'active',
      } as CustomAuditTemplate;
    }
    // Selected audit but no questions (or not loaded yet): show minimal template so form never shows "No template provided"
    if (audit) {
      return {
        id: String((audit as any).templateId ?? this.auditId(audit) ?? 'audit-placeholder'),
        name: (audit as any).title || 'Audit',
        type: 'audit',
        fields: [{
          id: 'audit-info',
          type: 'text',
          label: 'Audit details',
          required: false,
          placeholder: `Audit: ${(audit as any).title ?? 'Untitled'} – ${audit.date}. ${questions.length === 0 ? 'No form questions in this audit.' : ''}`,
        } as AuditField],
        status: 'active',
      } as CustomAuditTemplate;
    }
    return undefined;
  });

  /**
   * Same response building as Audit Library (audit-panel getCustomResponses).
   * Use this so Daily view displays custom audit data exactly like the library.
   */
  private getCustomResponsesFromAudit(audit: AuditInstance): AuditResponse {
    const responses = buildCustomResponsesFromQuestions(audit.questions);
    return {
      id: this.auditId(audit),
      templateId: String((audit as any).templateId ?? ''),
      date: audit.date,
      locationId: (audit as any).locationId ?? undefined,
      responses,
      status: (audit as any).status ?? 'draft',
      submittedBy: (audit as any).submittedBy ?? undefined,
      submittedAt: (audit as any).submittedAt ?? undefined,
    };
  }

  /** True when the selected audit has custom form data (same check as Audit Library isSelectedCustom). */
  private isSelectedAuditCustom(audit: AuditInstance | null): boolean {
    return (audit?.questions ?? []).some(q => !!(q as any).customFields);
  }

  /** Response to show in Daily form: use Audit Library logic for custom audits, else fallback mapping. */
  dailyDisplayResponse = computed<AuditResponse | undefined>(() => {
    if (this.activeTab() !== 'daily') return undefined;
    const audit = this.selectedAudit();
    if (!audit) return undefined;
    // Use same system as Audit Library when audit has custom questions (same template + getCustomResponses shape)
    if (this.isSelectedAuditCustom(audit)) {
      return this.getCustomResponsesFromAudit(audit);
    }
    const template = this.dailyDisplayTemplate();
    const questions = audit?.questions ?? [];
    let responses = this.convertQuestionsToResponsesWithIndex(questions);
    const stored = (audit as any).responses ?? (audit as any).formResponse;
    if (stored && typeof stored === 'object') responses = { ...responses, ...stored };
    if (template?.fields?.length && questions.length > 0) {
      template.fields.forEach((field, i) => {
        if (i < questions.length && !(field.id in responses)) {
          const q = questions[i];
          const custom = (q as any).customFields;
          if (q.evidence?.length > 0 || (custom?.fieldType === 'question') || (q.score != null && (q.evidenceSummaryText != null || q.actionRequired != null))) {
            responses[field.id] = { score: q.score ?? 0, evidence: q.evidenceSummaryText ?? '', actionRequired: q.actionRequired ?? 'None', ...(custom?.rawResponse && typeof (custom as any).rawResponse === 'object' ? (custom as any).rawResponse : {}) };
          } else if (custom?.value !== undefined) {
            responses[field.id] = custom.value;
          } else {
            responses[field.id] = q.score ?? q.text ?? '';
          }
        }
      });
    }
    return {
      id: this.auditId(audit),
      templateId: String((audit as any).templateId ?? this.selectedCustomTemplateId() ?? ''),
      date: audit.date,
      locationId: (audit as any).locationId ?? this.locationId() ?? undefined,
      departmentId: audit.departmentId ?? undefined,
      subDepartmentId: audit.subDepartmentId ?? undefined,
      responses,
      status: (audit as any).status ?? 'draft',
      submittedBy: (audit as any).submittedBy ?? this.user?.name ?? undefined,
      submittedAt: (audit as any).submittedAt ?? undefined,
      completedBy: (audit as any).completedBy ?? undefined,
      completedAt: (audit as any).completedAt ?? undefined,
    };
  });

  // Existing audit response for editing (form mode) – used when we need custom-template-specific path
  existingAuditResponse = computed<AuditResponse | undefined>(() => {
    const audit = this.selectedAudit();
    if (!audit || this.auditType() !== 'custom-template') return undefined;

    return {
      id: audit.id ?? (audit as any)._id,
      templateId: String((audit as any).templateId ?? this.selectedCustomTemplateId() ?? ''),
      date: audit.date,
      locationId: (audit as any).locationId || this.locationId() || undefined,
      departmentId: audit.departmentId || undefined,
      subDepartmentId: audit.subDepartmentId || undefined,
      responses: this.convertQuestionsToResponses(audit.questions),
      status: (audit as any).status || 'draft',
      submittedBy: (audit as any).submittedBy || this.user?.name || undefined,
      submittedAt: (audit as any).submittedAt || undefined,
      completedBy: (audit as any).completedBy || undefined,
      completedAt: (audit as any).completedAt || undefined
    };
  });

  /** True only for Manager (Monthly) audits that are scored; baseline/provider are not. */
  private isScoredAuditType(auditType: string | undefined): boolean {
    if (!auditType) return false;
    const normalized = String(auditType).toLowerCase().replace(/_/g, '');
    return normalized === 'registeredmanager';
  }

  // Advanced (regulation) audits: template + response for FlexibleTemplateSystem form
  // Only scored audits (registered_manager / Monthly) get score fields; baseline/provider show evidence & action only.
  regulationTemplateFromQuestions = computed<CustomAuditTemplate | undefined>(() => {
    const qs = this.questions();
    if (this.activeTab() !== 'advanced' || !qs.length) return undefined;
    const scored = this.isScoredAuditType(this.auditType());
    const scoreMax = scored ? 5 : 0;
    const fields: AuditField[] = qs.map((q) => ({
      id: q.templateQuestionId,
      type: 'question' as const,
      label: q.text,
      required: false,
      metadata: {
        domain: q.domain,
        regulationId: q.regulationId,
        scoreMax,
      },
    }));
    return {
      id: this.selectedNormalTemplateId() ?? 'regulation-draft',
      name: this.auditTitle() || 'Regulation audit',
      type: 'audit',
      fields,
      status: 'active',
    } as CustomAuditTemplate;
  });

  regulationResponseFromQuestions = computed<AuditResponse | undefined>(() => {
    const qs = this.questions();
    const audit = this.selectedAudit();
    if (this.activeTab() !== 'advanced' || !qs.length) return undefined;
    const responses: Record<string, any> = {};
    qs.forEach((q) => {
      responses[q.templateQuestionId] = {
        score: q.score ?? 0,
        evidence: q.evidenceSummaryText ?? '',
        actionRequired: q.actionRequired ?? 'None',
      };
    });
    return {
      id: audit?.id ?? '',
      templateId: this.selectedNormalTemplateId() ?? '',
      date: this.auditDate(),
      locationId: this.locationId() ?? undefined,
      departmentId: this.departmentId() ?? undefined,
      subDepartmentId: this.subDepartmentId() ?? undefined,
      responses,
      status: (audit as any)?.status ?? 'draft',
      submittedBy: this.user?.name,
    };
  });

  // Evidence Context Menu
  showEvidenceMenu = false;
  evidenceMenuPosition = { x: 0, y: 0 };
  activeEvidenceQuestionId: string | null = null;

  // Pending Audit ID
  private pendingAuditId: string | null = null;

  // Regulations
  readonly regulations = signal<RegulationItem[]>([
    ...MOCK_REGULATIONS.items as any[],
    ...CUSTOM_LIBRARY.items as any[]
  ]);

  get allRegulations() { return this.regulations(); }

  availableRegs = signal<RegulationItem[]>([...this.regulations()]);
  selectedRegs = signal<RegulationItem[]>([]);

  // Custom Regulations
  customRegs = signal<RegulationItem[]>([]);
  currentCustomRegId = signal<string | null>(null);

  newCustomReg: Partial<RegulationItem> = {
    code: '',
    title: '',
    description: '',
    domain: 'WellLed',
    type: 'Custom' as any,
    appliesTo: 'Both' as any
  };

  newCustomSub: Partial<RegulationSubsection> = {
    label: '',
    text: '',
    defaultIncluded: true,
    domain: 'WellLed',
    appliesTo: 'Both' as any
  };

  currentCustomReg = computed(() => {
    const id = this.currentCustomRegId();
    return id ? this.customRegs().find(r => r.id === id) : undefined;
  });

  // Recurring Audits
  isRecurring = signal(false);
  recurringFrequency = signal<AuditFrequency>('Monthly');
  recurringTemplateAuditType = signal<TemplateAuditType>('baseline');
  generateMonthsAhead = signal(3); // 6, 12

  // UI State
  activeTab = signal<'daily' | 'advanced'>('daily'); // 'daily' | 'advanced'

  showChecklistBuilder = false;
  showTableBuilder = false;
  newQuestionText = '';

  tableHeaders: string[] = [];
  tableRows: string[][] = [];

  constructor(
    private auditService: AuditService,
    private snackbar: MatSnackBar,
    private templateService: AuditTemplateService,
    private evidenceService: EvidenceService,
    private router: Router,
    private ls: LocalStorageService,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private authService: AuthService,
    private companyService: CompanyService,
    private http: HttpClient,
    private recurringAuditService: RecurringAuditService,
    private locationService: LocationService,
    private walkthrough: WalkthroughRegistryService,
  ) {
    this.pendingAuditId = this.route.snapshot.queryParamMap.get('auditId');
    const routeLocationId = this.route.snapshot.queryParamMap.get('locationId');
    if (routeLocationId) {
      this.locationId.set(routeLocationId);
    }
  }

  // LIFECYCLE
  ngOnInit(): void {
    this.walkthrough.register('/CCGA/AuditCreator', [
      {
        targetId: 'auditCreator.pageTitle',
        title: 'Audit Creator',
        description:
          'Audit Creator is the system for creating audits and adjusting them as your work evolves. The page is separated into two modes: Daily for flexible, on-the-fly audits, and Advanced for regulation-aligned audits. You can build, preview, generate from templates, save drafts or finalized audits, and then continue from where you left off in the Compliance Audit Hub.',
      },
      {
        targetId: 'auditCreator.tabDaily',
        title: 'Daily mode',
        description:
          'Daily mode is the flexible “on the fly” creator. It uses the template builder (custom canvas) so you can quickly assemble audit fields. The toolbox provides elements such as short/long text, numbers, checkboxes, radio groups, drop-downs, date pickers, data tables, and audit questions. Drag elements onto the canvas, select them, and set their properties (for example: required, labels, placeholders, validation rules, and advanced JSON/metadata). You can also duplicate, delete, and move elements. Finally, switch to preview to see how the audit will look once completed.',
      },
      {
        targetId: 'auditCreator.tabAdvanced',
        title: 'Advanced mode',
        description:
          'Advanced mode is more structured and regulation-driven. You use the regulation library to choose which required questions belong in each section. You can add multiple regulations, and you can generate audits from templates. Advanced mode also supports recurring audits—so once you configure a schedule (monthly, weekly, daily, quarterly, annually, or ad hoc), the system can create the next audits automatically. You can also generate baselines for future periods (for example the next 3/6/12 months) based on a frequency.',
      },
      {
        targetId: 'auditCreator.saveAuditButton',
        title: 'Save audit',
        description:
          'Save your work. Both templates and audits are stored in the same database, so they appear in the Audit Library and can be reused in the relevant editors. After saving, you can open/edit them later as needed. Export (PDF) is available if required, but it’s usually not needed.',
        scrollTo: 'bottom',
      },
      {
        targetId: 'auditCreator.cancelButton',
        title: 'Cancel',
        description:
          'Cancel your current draft if you want to stop or start over. If you cancel, you can return later and build from scratch again when ready.',
        scrollTo: 'bottom',
      },
      {
        targetId: 'auditCreator.returnButton',
        title: 'Back to Compliance Audit Hub',
        description:
          'Return to the Compliance Audit Hub (main page) so you can continue reviewing audits, create new ones, or open the library.',
        panelPlacement: 'left',
        scrollTo: 'top',
      },
    ]);

    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.user = user;

    const role = user.role as Role;
    const isOrgAdminLike = role === 'SystemAdmin' || role === 'OrgAdmin';
    const isCompanyManagerLike = role === 'RegisteredManager' || role === 'Supervisor';
    const isLocationScoped = role === 'CareWorker' || role === 'SeniorCareWorker' || role === 'Auditor';

    const routeLocationId = this.route.snapshot.queryParamMap.get('locationId');
    if (routeLocationId) {
      this.locationId.set(routeLocationId);
    }

    // Org-wide roles
    if (isOrgAdminLike) {
      this.companyService.currentCompany$.subscribe({
        next: (c: any) => {
          const id = c?.id ?? c?.companyID ?? null;
          if (!id) {
            this.locations = [];
            this.locationId.set(null);
            return;
          }
          this.companyId.set(id);
          this.locationId.set(this.locationId() ?? null);
          this.departmentId.set(null);
          this.subDepartmentId.set(null);

          const params = new HttpParams().set('companyId', id);
          this.http.get<DbLocation[]>('/api/locations', { params })
            .subscribe({
              next: (locs) => {
                this.locations = locs ?? [];
                this.ensureLocationSetForAdvanced();
                this.loadTemplates();
                this.loadAudits();
              },
              error: (err) => console.error('Load locations failed', err)
            });

          this.loadCustomRegs();
        },
        error: (err) => console.error('currentCompany error', err)
      });
      return;
    }

    // Non-org-admin roles
    const companyId = (user as any).companyId ?? this.ls.getID('companyID') ?? null;
    const assignedLocationId = (user as any).locationId ?? this.ls.getID('locationID') ?? null;

    if (companyId) {
      this.companyId.set(companyId);
      if (!this.locationId() && isLocationScoped && !isCompanyManagerLike) {
        if (assignedLocationId) this.locationId.set(assignedLocationId);
      }

      if (companyId) {
        // Location-scoped roles: use only the user's assigned location (audits are per location)
        if (isLocationScoped && !isCompanyManagerLike) {
          this.locationService.listMyAssigned().subscribe({
            next: (locs) => {
              this.locations = locs ?? [];
              if (assignedLocationId) this.locationId.set(assignedLocationId);
              else if (this.locations.length > 0) this.locationId.set(this.locations[0].id);
              this.loadTemplates();
              this.loadAudits();
            },
            error: (err) => console.error('Load locations failed', err)
          });
        } else {
          const params = new HttpParams().set('companyId', companyId);
          this.http.get<DbLocation[]>('/api/locations', { params })
            .subscribe({
              next: (locs) => {
                this.locations = locs ?? [];
                this.ensureLocationSetForAdvanced();
                if (isLocationScoped && this.locationId()) {
                  const ok = this.locations.some(l => l.id === this.locationId());
                  if (!ok) this.locationId.set(this.locations[0]?.id ?? null);
                }
                this.loadTemplates();
                this.loadAudits();
              },
              error: (err) => console.error('Load locations failed', err)
            });
        }
      } else {
        this.loadTemplates();
        this.loadAudits();
      }

      this.loadCustomRegs();
    }
  }

  // LOADING - UPDATED FOR DUAL MODE
  loadAudits() {
    const companyId = (this.company as any)?.id ?? (this.company as any)?.companyID ?? undefined;
    const rawLocationId = this.locationId();
    const locationId = rawLocationId && rawLocationId !== 'null' ? rawLocationId : undefined;

    // Filter audits by tab type
    // Daily -> Baseline, Custom
    // Advanced -> RegisteredManager, Provider
    let auditTypes: string[] = [];
    if (this.activeTab() === 'daily') {
      auditTypes = ['custom-template'];
    } else {
      auditTypes = ['baseline','registeredmanager', 'provider'];
    }

    this.auditService.list({
      companyId,
      locationId,
      auditType: auditTypes.join(',')
    })
      .subscribe(items => {
        this.audits.set(items ?? []);

        const auditId = this.pendingAuditId;
        if (auditId) {
          const want = String(auditId);
          const match = (items ?? []).find(
            (a) => String(a.id ?? '') === want || String((a as any)._id ?? '') === want
          );
          if (match) this.selectAudit(match);
        }

        // Only auto-select first audit in Advanced; Daily defaults to "Create new"
        if (this.activeTab() === 'advanced' && !this.selectedAudit() && (items ?? []).length > 0) {
          this.selectAudit((items ?? [])[0]);
        }
      });
  }

  // UPDATED: Load both template types separately
  loadTemplates() {
    const organizationId = this.companyId();
    const locationId = this.locationId();
    // Non-admin: ensure we pass their location so Daily tab gets templates (server also scopes by req.user.locationId)
    const user = this.authService.getCurrentUser();
    const effectiveLocationId = locationId || (user as any)?.locationId || undefined;

    // Load BOTH regular templates AND custom templates
    const regularPromise = this.templateService.list(organizationId || undefined);
    const customPromise = this.templateService.listCustom({
      organizationId: organizationId || undefined,
      locationId: effectiveLocationId
    });
    console.log('Loading templates...');
    console.log(firstValueFrom(regularPromise),'   ' ,customPromise);
    Promise.all([firstValueFrom(regularPromise), firstValueFrom(customPromise)])
      .then(([regular, custom]) => {
        // Filter regular templates (Advanced Tab)
        const cleanRegulars = (regular || []).filter((t: any) =>
          t.name !== 'Untitled Template'
        ).map((t: any) => ({ ...t, templateType: 'normal' }));

        // Filter custom templates (Daily Tab) - remove drafts/untitled
        const cleanCustoms = (custom || []).filter((t: any) =>
          t.name !== 'Untitled Template'
        ).map((t: any) => ({ ...t, templateType: 'custom' }));

        this.normalTemplates.set(cleanRegulars);
        this.customTemplates.set(cleanCustoms);

        console.log('Templates loaded:', cleanRegulars.length, 'normal |', cleanCustoms.length, 'custom');
      })
      .catch(err => {
        console.error('Failed to load templates', err);
        this.normalTemplates.set([]);
        this.customTemplates.set([]);
      });
  }

  loadCustomRegs() {
    const all = [...MOCK_REGULATIONS.items, ...this.customRegs()] as any[];
    all.sort((a, b) => String(a.code).localeCompare(String(b.code)));
    this.regulations.set(all);

    const selectedIds = new Set(this.selectedRegs().map(r => r.id));
    this.availableRegs.set(all.filter(r => !selectedIds.has(r.id)));
  }

  /** Normalize audit type for UI (dropdown uses registered_manager; API may return registeredmanager). */
  private normalizeAuditTypeForUi(auditType: string | undefined): 'baseline' | 'registered_manager' | 'provider' | 'custom-template' {
    if (!auditType) return 'baseline';
    const lower = String(auditType).toLowerCase().replace(/_/g, '').replace(/\s/g, '');
    if (lower === 'registeredmanager') return 'registered_manager';
    if (lower === 'customtemplate') return 'custom-template';
    if (auditType === 'provider' || lower === 'provider') return 'provider';
    if (auditType === 'baseline' || lower === 'baseline') return 'baseline';
    return auditType as any;
  }

  // AUDIT SELECTION - UPDATED FOR DUAL MODE
  selectAudit(audit: AuditInstance) {
    console.log('selectAudit', audit);

    // Core audit metadata (normalize type so UI dropdown and scored-vs-not logic match)
    this.selectedAudit.set(audit);
    this.auditTitle.set((audit as any).title ?? (audit.auditType + ' audit'));
    this.auditType.set(this.normalizeAuditTypeForUi(audit.auditType));
    this.auditDate.set(audit.date);
    this.locationId.set((audit as any).locationId ?? null);
    this.departmentId.set(audit.departmentId ?? null);
    this.subDepartmentId.set(audit.subDepartmentId ?? null);

    // Set template ID if exists (normalize type: API may return CustomTemplate etc.)
    const normType = this.normalizeAuditTypeForUi(audit.auditType);
    if ((audit as any).templateId) {
      const tid = String((audit as any).templateId);
      // In Daily tab, always use audit's templateId as the display template so we show full template (e.g. 36 fields), not just synthetic from 2 questions
      if (this.activeTab() === 'daily') {
        this.selectedCustomTemplateId.set(tid);
        this.selectedNormalTemplateId.set(null);
        const inList = this.customTemplates().some(
          t => String((t as any).id) === tid || String((t as any)._id) === tid
        );
        if (!inList) {
          this.templateService.getCustom(tid).subscribe({
            next: (tpl) => this.fetchedCustomTemplate.set({ ...tpl, type: (tpl as any).type ?? 'audit' } as any),
            error: () => this.fetchedCustomTemplate.set(null),
          });
        } else {
          this.fetchedCustomTemplate.set(null);
        }
      } else {
        if (normType !== 'custom-template') this.fetchedCustomTemplate.set(null);
        if (normType === 'custom-template') {
          this.selectedCustomTemplateId.set(tid);
          this.selectedNormalTemplateId.set(null);
        } else {
          this.selectedNormalTemplateId.set(tid);
          this.selectedCustomTemplateId.set(null);
        }
      }
    } else if (normType !== 'custom-template') {
      this.fetchedCustomTemplate.set(null);
    }

    // Questions from audit
    const auditQuestions = audit.questions ?? [];
    this.questions.set(auditQuestions);

    // Only rebuild regulation selections for non-custom audits
    if (normType !== 'custom-template') {
      // Rebuild selected regs from questions
      const usedRegIds = new Set(
        auditQuestions
          .map(q => q.regulationId)
          .filter(id => typeof id === 'string' && !!id)
      );

      const allRegs = this.regulations();
      const selectedRegs = allRegs.filter(r => usedRegIds.has(r.id));
      const availableRegs = allRegs.filter(r => !usedRegIds.has(r.id));

      this.selectedRegs.set(
        [...selectedRegs].sort((a: any, b: any) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
      );
      this.availableRegs.set(availableRegs);

      // Add clauses if needed
      for (const reg of selectedRegs) {
        this.addRegulationClausesToAudit(reg, { includeAll: true });
        if (this.getQuestionsByRegulation(reg.id).length === 0) {
          const fallbackId = this.stableRegulationQuestionId(reg.id, 'main');
          this.questions.set([
            ...this.questions(),
            {
              templateQuestionId: fallbackId,
              regulationId: reg.id,
              text: reg.description ?? reg.title ?? 'Regulation added',
              domain: 'WellLed',
              score: 0,
              evidence: [],
              clauseLabel: '-',
              evidenceSummaryText: '',
              actionRequired: 'None',
              assignedTo: '',
              targetDate: '',
              completed: 'N',
              defaultIncluded: true
            } as any
          ]);
        }
      }
    }
  }

  createNewAudit() {
    this.selectedAudit.set(null);
    this.selectedNormalTemplateId.set(null);
    this.selectedCustomTemplateId.set(null);

    this.auditTitle.set('');
    this.auditType.set('baseline');
    this.auditDate.set(new Date().toISOString().slice(0, 10));
    this.questions.set([]);
    this.departmentId.set(null);
    this.subDepartmentId.set(null);
    this.pendingAuditId = null;

    // reset regulations
    this.selectedRegs.set([]);
    this.availableRegs.set([...this.regulations()]);
  }

  onAuditIdSelected(auditId: string | null) {
    if (auditId == null || auditId === '') {
      this.selectedAudit.set(null);
      this.fetchedCustomTemplate.set(null);
      if (this.activeTab() === 'daily') this.auditType.set('custom-template');
      return;
    }
    this.auditService.get(auditId).subscribe(item => {
      if (!item) return;
      this.selectAudit(item);
      const normType = this.normalizeAuditTypeForUi(item.auditType);
      if (this.activeTab() === 'daily' && normType === 'custom-template') {
        const tid = this.selectedCustomTemplateId();
        if (tid) {
          const idStr = String(tid);
          const inList = this.customTemplates().some(
            t => String((t as any).id) === idStr || String((t as any)._id) === idStr
          );
          if (!inList) {
            this.templateService.getCustom(tid).subscribe({
              next: (tpl) => this.fetchedCustomTemplate.set({ ...tpl, type: (tpl as any).type ?? 'audit' }),
              error: () => this.fetchedCustomTemplate.set(null),
            });
          } else {
            this.fetchedCustomTemplate.set(null);
          }
        } else {
          this.fetchedCustomTemplate.set(null);
        }
      } else {
        this.fetchedCustomTemplate.set(null);
      }
    });
  }

  onLocationChange(id: string) {
    this.locationId.set(id || null);
    this.departmentId.set(null);
    this.subDepartmentId.set(null);
    this.loadAudits();
  }

  onDepartmentChange(id: string) {
    this.departmentId.set(id || null);
    this.subDepartmentId.set(null);
  }

  // TEMPLATE SELECTION - UPDATED FOR DUAL MODE (Custom vs Normal)
  createAuditFromTemplate(templateId: string | null) {
    if (!templateId) return;

    // Search in both lists
    const Ntemplate = this.normalTemplates().find(t => (t as any).id === templateId || (t as any)._id === templateId);
    const Ctemplate = this.customTemplates().find(t => (t as any).id === templateId || (t as any)._id === templateId);

    if (!Ntemplate && !Ctemplate) return;

    // Case 1: Custom Template (Daily)
    if (Ctemplate) {
      this.selectedAudit.set(null);
      this.selectedCustomTemplateId.set(templateId);
      this.selectedNormalTemplateId.set(null); // Clear other
      this.auditDate.set(new Date().toISOString().slice(0, 10));

      this.auditType.set('custom-template');
      this.auditTitle.set(Ctemplate.name ?? '');
      this.questions.set([]); // Will be populated from form responses
    }
    // Case 2: Normal Regulation Template (Advanced)
    else if (Ntemplate) {
      this.selectedAudit.set(null);
      this.selectedNormalTemplateId.set(templateId);
      this.selectedCustomTemplateId.set(null); // Clear other
      this.auditDate.set(new Date().toISOString().slice(0, 10));

      this.auditTitle.set(Ntemplate.name ?? '');
      this.auditType.set((Ntemplate.auditType as any) ?? 'baseline');

      // Build questions from regulation sections (stable ids for reliability)
      const rows: AuditQuestionInstance[] = [];
      let sectionIndex = 0;
      for (const section of Ntemplate.sections ?? []) {
        let qIndex = 0;
        for (const q of section.questions ?? []) {
          const regId = this.normalizeRegulationId(q.regulations?.[0]?.id ?? '');
          const stableId = regId ? this.stableRegulationQuestionId(regId, `s${sectionIndex}-q${qIndex}`) : `reg-${sectionIndex}-${qIndex}-${Date.now()}`;
          rows.push({
            templateQuestionId: stableId,
            templateType: 'regulation',
            regulationId: regId,
            text: q.text,
            domain: q.domain ?? 'WellLed',
            score: 0,
            evidence: [],
            evidenceSummaryText: '',
            actionRequired: 'None',
            assignedTo: '',
            targetDate: '',
            completed: 'N',
            defaultIncluded: true
          } as unknown as AuditQuestionInstance);
          qIndex++;
        }
        sectionIndex++;
      }
      this.questions.set(rows);

      // Update regulation selections
      const selectedIds = new Set(rows.map(r => r.regulationId).filter(Boolean));
      const allRegs = this.regulations();

      const selected = allRegs
        .filter(r => selectedIds.has(r.id))
        .sort((a: any, b: any) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));

      const available = allRegs.filter(r => !selectedIds.has(r.id));

      this.selectedRegs.set(selected);
      this.availableRegs.set(available);
    }
  }

  private normalizeRegulationId(id: string | null | undefined): string {
    const raw = (id ?? '').trim();
    if (!raw) return raw;
    if (raw.startsWith('FS-REG-')) return raw;
    const m = /Reg\s*(\d+)/i.exec(raw);
    if (m) return `FS-REG-${m[1]}`;
    return raw;
  }

  // CUSTOM TEMPLATE METHODS NEW – used when loading existing custom audit into form
  private convertQuestionsToResponses(questions: AuditQuestionInstance[]): Record<string, any> {
    return this.convertQuestionsToResponsesWithIndex(questions ?? []);
  }

  /** Same as above but uses field-${i} when templateQuestionId is missing (matches synthetic template in Daily). */
  private convertQuestionsToResponsesWithIndex(questions: AuditQuestionInstance[]): Record<string, any> {
    const responses: Record<string, any> = {};
    (questions ?? []).forEach((q, i) => {
      const fieldId = q.templateQuestionId || `field-${i}`;
      const custom = (q as any).customFields;
      // Scorable/evidence question type (regulation or custom 'question' field)
      if (q.evidence?.length > 0 || (custom?.fieldType === 'question') || (q.score != null && (q.evidenceSummaryText != null || q.actionRequired != null))) {
        responses[fieldId] = {
          score: q.score ?? 0,
          evidence: q.evidenceSummaryText ?? '',
          actionRequired: q.actionRequired ?? 'None',
          ...(custom?.rawResponse && typeof custom.rawResponse === 'object' ? custom.rawResponse : {}),
        };
      } else if (custom?.value !== undefined) {
        // Table, checkbox, text, number, date – use stored custom value
        responses[fieldId] = custom.value;
      } else {
        responses[fieldId] = q.score ?? q.text ?? '';
      }
    });
    return responses;
  }

  convertResponsesToQuestions(
    responses: Record<string, any>,
    template: CustomAuditTemplate | AuditTemplate
  ): AuditQuestion[] {
    const fields = template.fields || [];

    return fields.map(field => {
      const responseValue = responses[field.id];

      const question: AuditQuestion = {
        id: field.id,
        type: field.type,
        label: field.label,
        required: field.required || false,
        value: this.normalizeFieldValue(field, responseValue)
      };

      // Type-specific mapping
      switch (field.type) {
        case 'question':
          question.score = responseValue?.score ?? 0;
          question.evidence = responseValue?.evidence ?? '';
          break;

        case 'table':
          question.tableData = this.normalizeTableData(
            responseValue,
            field.tableConfig || { headers: [], rows: 1 }
          );
          break;

        case 'checkbox':
        case 'select':
        case 'radio':
          question.value = Array.isArray(responseValue) ? responseValue : [responseValue];
          question.options = field.options || [];
          break;
      }

      return question;
    });
  }

  private normalizeFieldValue(field: AuditField, value: any): any {
    if (value === undefined || value === null || value === '') return null;

    switch (field.type) {
      case 'number': return Number(value) || 0;
      case 'date': return value ? new Date(value).toISOString() : null;
      case 'checkbox': return Array.isArray(value) ? value : [value];
      default: return value;
    }
  }

  private normalizeTableData(tableResponse: any, config: TableConfiguration): any[][] {
    if (!tableResponse || !Array.isArray(tableResponse)) return [];

    return tableResponse.map((row: any[]) =>
      (config.headers || []).map((_, colIdx) => row[colIdx] ?? '')
    );
  }



  // Handle template save (builder mode)
  onTemplateSaved(template: CustomAuditTemplate): void {
    console.log('Template saved:', template);
    this.templateService.createCustom(template).subscribe({
      next: (saved) => {
        console.log('Template created successfully:', saved);
        // Add template type marker
        const markedTemplate = { ...saved, templateType: 'custom' as const };
        // Update local templates list
        this.customTemplates.update(list => [...list, markedTemplate]);
        // Select the newly created template
        this.selectedCustomTemplateId.set(saved.id);
        alert('Template saved successfully!');
      },
      error: (err) => {
        console.error('Failed to save template:', err);
        alert('Failed to save template. Please try again.');
      }
    });
  }

  // Handle form submission (form mode)
  onFormChange(data: { responses: Record<string, any> }): void {
    console.log('Form changed:', data);
    // Optional: Implement auto-save draft functionality
  }

  /** Shared: compute domain and overall score from questions (Daily + Advanced). */
  private computeDomainScoresAndOverall(
    auditQuestions: AuditQuestionInstance[],
    options?: { onlyScorableCustomFields?: boolean }
  ): { domainScores: Record<string, number>; overallScore: number } {
    const uniqueDomains = Array.from(new Set(auditQuestions.map((q) => q.domain)));
    const domainScores: Record<string, number> = {};

    uniqueDomains.forEach((domain) => {
      const domainQuestions = auditQuestions.filter((q) => {
        if (q.domain !== domain) return false;
        if (options?.onlyScorableCustomFields && (q.customFields as any)?.fieldType !== 'question') return false;
        return true;
      });
      const totalScore = domainQuestions.reduce((sum, q) => sum + (q.score ?? 0), 0);
      const questionCount = domainQuestions.length;
      const maxScore = questionCount * 5;
      domainScores[domain] =
        questionCount > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    });

    const overallScore =
      uniqueDomains.length > 0
        ? Math.round(
            Object.values(domainScores).reduce((a, b) => a + b, 0) / uniqueDomains.length
          )
        : 0;
    return { domainScores, overallScore };
  }

  /** Single save pipeline: create or patch audit (Daily + Advanced). */
  private saveAuditFromResponse(payload: {
    auditQuestions: AuditQuestionInstance[];
    domainScores: Record<string, number>;
    overallScore: number;
    title: string;
    templateId: string;
    auditType: AuditInstance['auditType'];
    date: string;
    locationId?: string;
    departmentId?: string;
    subDepartmentId?: string;
    status?: string;
    submittedBy?: string;
  }): void {
    const body: Partial<AuditInstance> = {
      title: payload.title,
      templateId: payload.templateId,
      auditType: payload.auditType,
      date: payload.date,
      locationId: payload.locationId,
      departmentId: payload.departmentId,
      subDepartmentId: payload.subDepartmentId,
      domainScores: payload.domainScores,
      overallScore: payload.overallScore,
      questions: payload.auditQuestions,
      status: payload.status as any,
      auditorId: payload.submittedBy,
    };
    const existing = this.selectedAudit();
    if (existing?.id) {
      this.auditService.patch(existing.id, body).subscribe({
        next: (updated) => {
          this.selectAudit(updated);
          this.snackbar.open('Audit updated!', 'OK');
        },
        error: (err) => console.error('Update failed:', err),
      });
    } else {
      this.auditService.create(body).subscribe({
        next: (created) => {
          this.audits.update((audits) => [created, ...audits]);
          this.selectAudit(created);
          this.snackbar.open('Audit created!', 'OK');
        },
        error: (err) => console.error('Create failed:', err),
      });
    }
  }

  onFormSubmit(response: AuditResponse): void {
    const template = this.currentCustomTemplate();
    if (!template) {
      console.error('No custom template');
      return;
    }
    const auditQuestions = this.convertCustomTemplateToAuditQuestions(
      template,
      response.responses || {}
    );
    const { domainScores, overallScore } = this.computeDomainScoresAndOverall(
      auditQuestions,
      { onlyScorableCustomFields: true }
    );
    this.saveAuditFromResponse({
      auditQuestions,
      domainScores,
      overallScore,
      title: this.auditTitle() || template.name,
      templateId: template.id,
      auditType: this.auditType(),
      date: this.auditDate(),
      locationId: this.locationId() ?? undefined,
      departmentId: this.departmentId() ?? undefined,
      subDepartmentId: this.subDepartmentId() ?? undefined,
      status: response.status,
      submittedBy: response.submittedBy,
    });
  }

  /** Convert regulation form response back to AuditQuestionInstance[] (merge with current questions). */
  private convertRegulationResponseToQuestions(response: AuditResponse): AuditQuestionInstance[] {
    const responses = response.responses || {};
    const qs = this.questions();
    return qs.map((q) => {
      const r = responses[q.templateQuestionId];
      if (!r) return q;
      const evidenceText = typeof r.evidence === 'string' ? r.evidence : (r.evidence ?? '');
      const evidenceItems: any[] = evidenceText
        ? [{
            id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            type: 'text',
            description: 'User evidence',
            content: evidenceText,
            uploadedBy: this.user?.name ?? 'auditor',
            uploadedAt: new Date().toISOString(),
          }]
        : Array.isArray(q.evidence) ? q.evidence : [];
      return {
        ...q,
        score: Number(r.score) ?? 0,
        evidenceSummaryText: evidenceText,
        actionRequired: r.actionRequired ?? 'None',
        evidence: evidenceItems,
        completed: r.score !== undefined && r.score !== null ? 'Y' : (q.completed ?? 'N'),
      } as AuditQuestionInstance;
    });
  }

  /** Advanced (regulation) form submit: same pipeline as Daily. */
  onAdvancedFormSubmit(response: AuditResponse): void {
    const templateId = this.selectedNormalTemplateId();
    if (!templateId) {
      this.snackbar.open('Select a template first.', 'OK');
      return;
    }
    const auditQuestions = this.convertRegulationResponseToQuestions(response);
    const scored = this.isScoredAuditType(this.auditType());
    const { domainScores, overallScore } = scored
      ? this.computeDomainScoresAndOverall(auditQuestions)
      : { domainScores: {} as Record<string, number>, overallScore: 0 };
    this.saveAuditFromResponse({
      auditQuestions,
      domainScores,
      overallScore,
      title: this.auditTitle() || 'Regulation audit',
      templateId,
      auditType: this.auditType(),
      date: this.auditDate(),
      locationId: this.locationId() ?? undefined,
      departmentId: this.departmentId() ?? undefined,
      subDepartmentId: this.subDepartmentId() ?? undefined,
      status: response.status,
      submittedBy: response.submittedBy ?? this.user?.name,
    });
  }

// audit-creator.ts
  private convertCustomTemplateToAuditQuestions(
    template: CustomAuditTemplate,
    responses: Record<string, any>
  ): AuditQuestionInstance[] {
    return template.fields.map(field => {
      const rawValue = responses[field.id];

      // 1. Handle Question Type (Scorable)
      if (field.type === 'question') {
        const qResponse = rawValue || {};
        const evidenceItems: any[] = qResponse.evidence
          ? [{
            id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique ID
            type: 'text', // or 'file'
            description: 'User evidence',
            content: qResponse.evidence, // ✅ Backend expects "content" for text
            uploadedBy: 'auditor', // or from auth context
            uploadedAt: new Date().toISOString()
          }]
          : [];
        return {
          templateQuestionId: field.id,
          templateType: 'custom-field' as const,
          text: field.label,
          domain: (field.metadata?.domain || 'WellLed') as any,
          regulationId: field.metadata?.regulationId || 'Unknown',
          score: Number(qResponse.score) || 0,

          // ✅ Required: evidence array
          evidence: evidenceItems,
          evidenceSummaryText: qResponse.evidence || '',
          actionRequired: qResponse.actionRequired || 'None',
          completed: qResponse.score !== undefined ? 'Y' as const : 'N' as const,
          defaultIncluded: true,
          customFields: {
            rawResponse: qResponse,
            fieldType: field.type,
            fieldId: field.id
          }
        } as AuditQuestionInstance;
      }

      // 2. Handle Data Fields (Text, Number, etc.) - NON-SCORABLE
      else {
        return {
          templateQuestionId: field.id,
          templateType: 'custom-field' as const,
          text: field.label,

          // ✅ Dummy but VALID data for non-questions
          domain: 'WellLed' as const,  // ✅ Valid enum value
          regulationId: 'INFO-' + field.id.slice(-6), // Unique dummy reg
          score: 0,

          // ✅ REQUIRED: Empty evidence array
          evidence: [],
          evidenceSummaryText: '',
          actionRequired: 'N/A',
          completed: 'Y' as const,  // Data fields are "complete"
          defaultIncluded: false,   // Exclude from scoring?
          customFields: {
            value: this.normalizeResponseValue(field, rawValue),
            options: field.options,
            tableConfig: field.tableConfig,
            fieldType: field.type,
            fieldId: field.id
          }
        } as AuditQuestionInstance;
      }
    });
  }



  private normalizeResponseValue(field: AuditField, response: any): any {
    if (response === undefined || response === null) return null;
    const value = response.value ?? response;  // Handle {value: x} or raw x

    if (value === undefined || value === null || value === '') return null;

    switch (field.type) {
      case 'number': return Number(value) || 0;
      case 'date': return value ? new Date(value).toISOString().slice(0, 10) : null;
      case 'checkbox': return Array.isArray(value) ? value : value ? [value] : [];
      case 'table': return Array.isArray(value) ? value : [];
      default: return String(value);
    }
  }
  onModeChanged(mode: 'builder' | 'form' | 'preview'): void {
    console.log('Mode changed to:', mode);
  }

  onTemplateChanged(template: CustomAuditTemplate): void {
    console.log('Template changed:', template);
  }
  onTemplateSelectChange(newId: string): void {
    console.log('🔄 PARENT: Template select changed to:', newId);
    this.selectedCustomTemplateId.set(newId);
    const newTemplate = this.currentCustomTemplate();
    console.log('🔄 PARENT: currentCustomTemplate() now:', newTemplate?.name, newTemplate?.id);
  }

  // Switch to builder mode for creating a new template
  createNewCustomTemplate(): void {
    this.selectedAudit.set(null);
    this.selectedCustomTemplateId.set(null); // Clear selection
    this.selectedNormalTemplateId.set(null); // Clear selection

    this.auditType.set('custom-template');
    this.auditTitle.set('');
    this.auditDate.set(new Date().toISOString().slice(0, 10));
    this.questions.set([]);
  }

  // Edit existing custom template audit
  editCustomTemplateAudit(audit: AuditInstance): void {
    if ((audit as any).templateId) {
      this.selectedCustomTemplateId.set((audit as any).templateId);
      this.selectedNormalTemplateId.set(null);
    }
    this.selectAudit(audit);
  }

  // EVIDENCE METHODS
  openEvidenceMenu(event: MouseEvent, q: AuditQuestionInstance) {
    event.preventDefault();
    event.stopPropagation();
    this.activeEvidenceQuestionId = q.templateQuestionId;
    this.evidenceMenuPosition = { x: event.clientX, y: event.clientY };
    this.showEvidenceMenu = true;
  }

  closeEvidenceMenu() {
    this.showEvidenceMenu = false;
    this.activeEvidenceQuestionId = null;
  }

  clearEvidence() {
    const audit = this.selectedAudit();
    const qid = this.activeEvidenceQuestionId;
    if (!audit || !qid) return;

    this.auditService.patchQuestion(audit.id, qid, {
      evidence: '',
      evidenceSummaryText: ''
    } as any).subscribe(updated => {
      this.selectAudit(updated);
      this.closeEvidenceMenu();
    });
  }

  manageEvidence() {
    const audit = this.selectedAudit();
    const qid = this.activeEvidenceQuestionId;
    if (!audit || !qid) return;

    const q = this.questions().find(x => x.templateQuestionId === qid);
    if (!q) return;

    this.closeEvidenceMenu();

    const dialogRef = this.dialog.open(EvidenceDialog, {
      width: '760px',
      data: {
        title: 'Manage evidence',
        evidenceSummaryText: (q as any).evidenceSummaryText ?? '',
        evidence: q.evidence ?? []
      }
    });

    dialogRef.afterClosed().subscribe((result: EvidenceDialogResult | undefined) => {
      if (!result) return;
      this.auditService.patchQuestion(audit.id, qid, {
        evidence: result.evidence,
        evidenceSummaryText: result.evidenceSummaryText
      } as any).subscribe(updated => this.selectAudit(updated));
    });
  }

  uploadFileEvidence(questionId: string, file: File, description: string) {
    const audit = this.selectedAudit();
    if (!audit) return;

    this.evidenceService.uploadFile(file, { description, uploadedBy: this.user?.name })
      .subscribe((ev: AuditEvidence) => {
        const q = this.questions().find(x => x.templateQuestionId === questionId);
        const next = [...(q?.evidence ?? []), ev];

        this.auditService.patchQuestion(audit.id, questionId, {
          evidence: next
        } as any).subscribe(updated => this.selectAudit(updated));
      });
  }

  // SAVE AUDIT - REGULATION MODE ONLY - UPDATED
  saveAudit() {
    const audit = this.selectedAudit();
    const auditType = this.auditType();

    // If custom template type, don't use this method
    if (auditType === 'custom-template') {
      console.warn('Use flexible template form submit for custom templates');
      return;
    }

    if (!audit) {
      const templateId = this.selectedNormalTemplateId();
      if (!templateId) {
        alert('Select a template first (templateId is required).');
        return;
      }
    }

    // If audit exists, patch header + questions (table edits)
    if (audit) {
      const scored = this.isScoredAuditType(this.auditType());
      const { domainScores, overallScore } = scored
        ? this.computeDomainScoresAndOverall(this.questions())
        : { domainScores: {} as Record<string, number>, overallScore: 0 };
      this.auditService.patch(audit.id, {
        auditType: this.auditType(),
        date: this.auditDate(),
        locationId: this.locationId() ?? undefined,
        departmentId: this.departmentId() ?? undefined,
        subDepartmentId: this.subDepartmentId() ?? undefined,
        domainScores,
        overallScore,
        questions: this.questions().map(q => ({
          templateQuestionId: q.templateQuestionId,
          templateType: q.templateType || 'regulation',
          regulationId: q.regulationId,
          text: q.text,
          domain: q.domain,
          score: q.score ?? 0,
          evidence: q.evidence ?? [],
          defaultIncluded: q.defaultIncluded ?? true,
          evidenceSummaryText: q.evidenceSummaryText ?? '',
          actionRequired: q.actionRequired ?? 'None',
          assignedTo: q.assignedTo ?? '',
          targetDate: q.targetDate ?? '',
          completed: q.completed ?? 'N',
          clauseLabel: (q as any).clauseLabel,
          regulationClauseId: (q as any).regulationClauseId,
        })) as any,
      }).subscribe({
        next: (updated) => {
          this.selectAudit(updated);
          this.snackbar.open('Audit saved.', 'OK');
        },
        error: (err) => console.error('Patch failed', err),
      });
      return;
    }

    // Create new audit
    const payload: Partial<AuditInstance> = {
      title: this.auditTitle() || undefined,
      templateId: this.selectedNormalTemplateId() || undefined,
      auditType: this.auditType(),
      date: this.auditDate(),
      locationId: this.locationId() || undefined,
      departmentId: this.departmentId() || undefined,
      subDepartmentId: this.subDepartmentId() || undefined,
      questions: this.questions().map(q => ({
        templateQuestionId: q.templateQuestionId,
        templateType: q.templateType || 'regulation', // as any,
        regulationId: q.regulationId,
        text: q.text,
        domain: q.domain,
        score: q.score ?? 0,
        evidence: q.evidence ?? [],
        completionStatus: 'Awaiting Approval',
        defaultIncluded: q.defaultIncluded ?? true,
        evidenceSummaryText: q.evidenceSummaryText ?? '',
        actionRequired: q.actionRequired ?? 'None',
        assignedTo: q.assignedTo ?? '',
        targetDate: q.targetDate ?? '',
        completed: q.completed ?? 'N' // as any
      })) as any
    };

    console.log('Sending audit payload:', payload);

    this.auditService.create(payload).subscribe({
      next: (created) => {
        this.audits.update(audits => [created, ...audits]);
        this.selectAudit(created);
      },
      error: (err) => console.error('Create failed:', err.error)
    });
  }

  // CUSTOM REGULATION METHODS
  addCustomReg() {
    const reg: RegulationItem = {
      id: 'CUSTOM-' + crypto.randomUUID(),
      code: this.newCustomReg?.code?.trim() || 'CUST',
      title: this.newCustomReg?.title?.trim() || 'New custom reg',
      description: this.newCustomReg.description?.trim() || '',
      type: 'Custom' as any,
      appliesTo: this.newCustomReg.appliesTo || 'Both' as any,
      subsections: [] as any,
    };
    this.customRegs.update(list => [...list, reg]);
    this.currentCustomRegId.set(reg.id);

    this.newCustomReg = {
      code: '',
      title: '',
      description: '',
      domain: 'WellLed',
      type: 'Custom' as any,
      appliesTo: 'Both' as any
    };
  }

  addCustomSubsection() {
    const regId = this.currentCustomRegId();
    if (!regId || !this.newCustomSub.text?.trim()) return;

    const sub: RegulationSubsection = {
      id: regId + '-SUB-' + crypto.randomUUID().slice(0, 8),
      label: this.newCustomSub.label?.trim() || '',
      text: this.newCustomSub.text.trim(),
      appliesTo: this.newCustomSub.appliesTo || 'Both' as any,
      defaultIncluded: this.newCustomSub.defaultIncluded ?? true,
      domain: this.newCustomSub.domain || 'WellLed',
    };

    this.customRegs.update(list => list.map(reg => {
      if (reg.id === regId) {
        return {
          ...reg,
          subsections: [...(reg.subsections || []), sub]
        };
      }
      return reg;
    }));

    this.newCustomSub = {
      label: '',
      text: '',
      defaultIncluded: true,
      domain: 'WellLed',
      appliesTo: 'Both' as any
    };
  }

  deleteCustomReg(regId: string) {
    this.customRegs.update(list => list.filter(r => r.id !== regId) as any);
    if (this.currentCustomRegId() === regId) this.currentCustomRegId.set(null);
  }

  deleteCustomSub(regId: string, subId: string) {
    if (!regId) return;
    this.customRegs.update(list => list.map(reg => {
      if (reg.id === regId) {
        return {
          ...reg,
          subsections: (reg.subsections || []).filter((s: any) => s.id !== subId)
        };
      }
      return reg;
    }));
  }

  findById(regId: string): RegulationItem | undefined {
    return this.customRegs().find(r => r.id === regId);
  }

  // REGULATION DRAG-DROP
  dropRegulation(event: CdkDragDrop<any>) {
    const reg = event.item.data as RegulationItem;
    if (!reg) return;

    if (this.selectedRegs().some(r => r.id === reg.id)) return;

    const nextSelected = [...this.selectedRegs(), reg].sort((a: any, b: any) =>
      String(a.code).localeCompare(String(b.code), undefined, { numeric: true })
    );

    this.selectedRegs.set(nextSelected);
    this.availableRegs.set(this.availableRegs().filter(r => r.id !== reg.id));

    this.addRegulationClausesToAudit(reg, { includeAll: true });

    if (this.getQuestionsByRegulation(reg.id).length === 0) {
      const fallbackId = this.stableRegulationQuestionId(reg.id, 'main');
      this.questions.set([
        ...this.questions(),
        {
          templateQuestionId: fallbackId,
          regulationId: reg.id,
          text: reg.description ?? reg.title ?? 'Regulation added',
          domain: 'WellLed',
          score: 0,
          evidence: [],
          clauseLabel: '-',
          evidenceSummaryText: '',
          actionRequired: 'None',
          assignedTo: '',
          targetDate: '',
          completed: 'N',
          defaultIncluded: true
        } as any
      ]);
    }
  }

  removeRegulation(regId: string) {
    const reg = this.selectedRegs().find(r => r.id === regId);
    if (!reg) return;

    this.selectedRegs.set(this.selectedRegs().filter(r => r.id !== regId));
    this.availableRegs.set([...this.availableRegs(), reg]);
    this.questions.set(this.questions().filter(q => q.regulationId !== regId));
  }

  getQuestionsByRegulation(regId: string): AuditQuestionInstance[] {
    return this.questions().filter(q => q.regulationId === regId);
  }

  // CLAUSE HELPERS
  private getRegulationClauses(reg: any): RegulationClause[] {
    const raw = reg.subsections ?? reg.sections ?? reg.clauses ?? [];
    return Array.isArray(raw) ? raw : [];
  }

  private flattenClauses(clauses: RegulationClause[]): RegulationClause[] {
    const out: RegulationClause[] = [];
    const walk = (c: RegulationClause) => {
      out.push(c);
      const children = c.children ?? c.subsections ?? c.items ?? [];
      if (Array.isArray(children)) children.forEach(walk);
    };
    clauses.forEach(walk);
    return out;
  }

  private findQuestionForClause(regId: string, clause: any): AuditQuestionInstance | undefined {
    const clauseId = clause.id ?? clause.clauseId ?? null;
    const clauseLabel = clause.label ?? clause.code ?? clause.clauseLabel ?? '';
    const clauseText = clause.text ?? clause.requirement ?? clause.description ?? '';

    if (clauseId) {
      return (this.questions() as any[]).find(q => q.regulationId === regId && (q as any).regulationClauseId === clauseId);
    }
    return this.questions().find(q =>
      q.regulationId === regId &&
      q.text === clauseText &&
      (q as any).clauseLabel === clauseLabel
    );
  }

  /** Stable id for regulation questions: reg-{regulationId}-{clauseId} */
  private stableRegulationQuestionId(regulationId: string, clauseId: string): string {
    const safeReg = (regulationId ?? '').replace(/\s+/g, '-');
    const safeClause = (clauseId ?? '').replace(/\s+/g, '-');
    return `reg-${safeReg}-${safeClause}`;
  }

  private createQuestionFromClause(reg: RegulationItem, clause: any): AuditQuestionInstance {
    const clauseId = clause.id ?? clause.clauseId ?? `gen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const clauseLabel = clause.label ?? clause.code ?? clause.clauseLabel ?? '';
    const clauseText = clause.text ?? clause.requirement ?? clause.description ?? 'no text';
    const domain = clause.domain ?? 'WellLed';
    const templateQuestionId = this.stableRegulationQuestionId(reg.id, clauseId);

    return {
      templateQuestionId,
      regulationId: reg.id,
      text: clauseText,
      domain,
      score: 0,
      evidence: [],
      regulationClauseId: clauseId,
      clauseLabel,
      evidenceSummaryText: '',
      actionRequired: 'None',
      assignedTo: '',
      targetDate: '',
      completed: 'N',
      defaultIncluded: clause.defaultIncluded ?? false
    } as any;
  }

  private addRegulationClausesToAudit(reg: RegulationItem, opts: { includeAll: boolean }) {
    const clauses = this.flattenClauses(this.getRegulationClauses(reg));
    if (!clauses.length) return;

    const existing = this.questions();
    const toAdd: AuditQuestionInstance[] = [];

    for (const clause of clauses) {
      const already = this.findQuestionForClause(reg.id, clause);
      if (already) continue;
      if (!opts.includeAll) continue;

      toAdd.push(this.createQuestionFromClause(reg, clause));
    }

    if (toAdd.length > 0) {
      this.questions.set([...existing, ...toAdd]);
    }
  }

  /** Ensure location is set when on Advanced: prefer user's assigned, then stored, then first in list. */
  private ensureLocationSetForAdvanced(): void {
    if (this.locations.length === 0) return;
    const current = this.locationId();
    if (current && this.locations.some((l) => l.id === current)) return;
    const user = this.authService.getCurrentUser();
    const preferred = (user as any)?.locationId ?? this.ls.getID('locationID');
    const match = preferred ? this.locations.find((l) => l.id === preferred) : null;
    const id = match?.id ?? this.locations[0].id;
    this.onLocationChange(id);
  }

  // RECURRING AUDITS
  setTab(tab: 'daily' | 'advanced') {
    this.activeTab.set(tab);
    this.ls.setID('tabAudits', this.activeTab());
    this.loadAudits();
    if (tab === 'daily') {
      this.selectedNormalTemplateId.set(null);
      this.auditType.set('custom-template');
      this.loadTemplates();
      // Default to "Create new" so user can pick template; they can choose existing from dropdown
      this.selectedAudit.set(null);
    } else {
      this.selectedCustomTemplateId.set(null);
      this.ensureLocationSetForAdvanced();
    }
  }

  async generateRecurringFromCurrentDraft() {
    const template = this.currentTemplate();
    const templateId = template?.id;
    if (!template || !templateId) return;

    await this.recurringAuditService.generateRecurringAudits({
      template,
      templateId,
      startDate: this.auditDate(),
      monthsAhead: this.generateMonthsAhead(),
      frequency: this.recurringFrequency() as any,
      auditType: this.recurringTemplateAuditType(),
      locationId: this.locationId(),
      departmentId: this.departmentId(),
      subDepartmentId: this.subDepartmentId(),
      title: this.auditTitle(),
      existingAudits: this.audits(),
    });

    this.loadAudits();
  }

  // TABLE BUILDER
  showChecklistBuilderFn() {
    this.showChecklistBuilder = true;
    this.showTableBuilder = false;
  }

  showTableBuilderFn() {
    this.showTableBuilder = true;
    this.showChecklistBuilder = false;
    this.tableHeaders = ['Col1', 'Col2', 'Col3'];
    this.tableRows = [['', '', '']];
  }

  addTableColumn() {
    this.tableHeaders.push('Col' + (this.tableHeaders.length + 1));
    this.tableRows.forEach(row => row.push(''));
  }

  trackByIndex(index: number, _: any): number {
    return index;
  }

  addTableRow() {
    const newRow = this.tableHeaders.map(() => '');
    this.tableRows.push(newRow);
  }

  deleteTableColumn(colIdx: number) {
    this.tableHeaders.splice(colIdx, 1);
    this.tableRows.forEach(row => row.splice(colIdx, 1));
  }

  deleteTableRow(rowIdx: number) {
    this.tableRows.splice(rowIdx, 1);
  }

  // NAVIGATION
  cancel() {
    this.router.navigate(['CCGA']);
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (this.showEvidenceMenu) this.closeEvidenceMenu();
    }
  }

  moveTo(route: string) {
    this.router.navigate([route]);
  }

  handleTemplateDelete(template: CustomAuditTemplate): void {
    if (confirm(`Confirm delete "${template.name}"?`)) {  // Double-confirm if needed
      this.templateService.deleteCustom(template.id).subscribe({
        next: () => {
          this.customTemplates.set(
            this.customTemplates()
              .filter(t => t.id !== template.id)
          );
          this.snackbar.open('Template deleted', 'OK');
        },
        error: () => this.snackbar.open('Delete failed', 'Retry')
      });
    }
  }

  deleteSelectedAudit(): void {
    const audit = this.selectedAudit();
    const id = this.auditId(audit);
    if (!audit || !id) {
      this.snackbar.open('Select an audit first.', 'OK');
      return;
    }

    const title = (audit as any).title || 'Untitled audit';
    if (!confirm(`Delete audit "${title}"? This cannot be undone.`)) return;

    this.auditService.delete(id).subscribe({
      next: () => {
        this.audits.update((list) =>
          list.filter((a) => this.auditId(a) !== id)
        );
        this.createNewAudit();
        this.snackbar.open('Audit deleted.', 'OK');
      },
      error: () => this.snackbar.open('Failed to delete audit.', 'OK'),
    });
  }


}
