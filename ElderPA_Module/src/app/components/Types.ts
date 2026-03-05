import { Type } from '@angular/core';
import {
  ConditionalLogic,
  FieldMetadata,
  FieldValidation,
  ResponseStatus
} from './flexible-template-system/shared/models/template.models';


/** Roles (match backend strings exactly) */
export type Role =
  | 'SystemAdmin'
  | 'OrgAdmin'
  | 'RegisteredManager'
  | 'Supervisor'
  | 'CareWorker'
  | 'SeniorCareWorker'
  | 'Auditor';

export interface LocationStats {
  occupancy?: number;
  capacity?: number;
  activeCases?: number;
  maxCases?: number;
}

// Represents a care location/site belonging to an organisation (Company).
export interface LocationType {
  // Primary identifiers
  _id?: string;                 // Mongo ObjectId
  id?: string;                  // Optional normalized id
  companyId?: string;           // Owning organisation (Company._id)

  // Legacy identifiers (kept for backward compatibility)
  cmpID?: string;
  locationID?: string;

  // CQC-related
  code?: string;                // Human-friendly code (often mapped from CQC location id)
  cqcLocationId?: string;       // Explicit CQC location identifier
  CQCnumber?: string;           // Optional alias if needed in UI

  // Core details
  name: string;
  type: 'CareHome' | 'HomeCare';
  icon?: string;
  address?: string;
  contactInfo?: string;
  primaryManager?: string;

  // Structure & metrics
  staff?: staffType[];
  stats?: LocationStats;
  departments?: LocationDepartment[];
  homeCareMetrics?: HomeCareMetrics;
  performance?: PerformanceSet;
  areas?: string[];
  wings?: string[];
  roomList?: Room[];
  roomGroups?: RoomGroup[];
  clientGroups?: ClientGroup[];
}

// Represents an organisation (group/provider) that owns one or more locations.
export interface CompanyType {
  _id: string;                           // Mongo primary key (string ObjectId)
  name: string;
  director?: string;
  companyNumber?: string;

  // CQC provider‑level identifier
  CQCnumber?: string;                    // Frontend naming
  CQC_number?: string;                   // Optional mirror of backend field

  address?: string;
  registeredIn?: 'England' | 'Wales' | 'Scotland';
  adminContact?: string;
  icon?: string;

  // Service configuration
  serviceTypes?: string[];

  // Relations / legacy
  Locations?: string[];                  // Legacy location id list
  companyID?: string;                    // Legacy alias (use _id primarily)

  // Backend extras
  ownerAdminId?: string;                 // Populated ref to Account
  createdAt?: string;                    // ISODate
  updatedAt?: string;
  deletedAt?: string | null;             // Soft delete
}

export interface Room {
  number: string;
  type: string;
  area: string;
  wing?: string;
  facilities: string[];
  roomGroup?: RoomGroup;
  occupiedClientGroup?: ClientGroup | null;
}

export interface FeeEnhancement {
  type: string;
  value: number;
}

export interface FeeRule {
  careBand: string;
  dependency: string;
  rate: number;
  enhancements: FeeEnhancement[];
}

export interface RoomGroup {
  name: string;
  feeRules: FeeRule[];
}

export interface ClientGroup {
  name: string;
  enhancements: FeeEnhancement[];
}

export interface UserType {
  name: string;
  role: Role;
  companyId?: string | null;
  locationId?: string | null;
  /** Profile photo URL (stored on server, e.g. /uploads/avatars/xxx.jpg) */
  avatarUrl?: string | null;
  companies?: string[];
  locations?: string[];
  managers?: string[];
}

export interface DashboardIndicator {
  name: string;
  value: number;
  growthRate: number;
}

export interface staffType {
  id: string;
  role: Role | 'Nurses' | 'Care staff';
}

export type DynamicRow = Record<string, any>;

/** Cell/column type for rendering and alignment */
export type DataTableColumnType =
  | 'text'
  | 'numeric'
  | 'date'
  | 'datetime'
  | 'status'
  | 'badge'
  | 'icon'
  | 'avatar'
  | 'tags'
  | 'progress'
  | 'link'
  | 'actions';

/** Filter type per column */
export type DataTableFilterType = 'text' | 'select' | 'date' | 'dateRange' | 'numberRange';

/** Filter definition for a column */
export interface DataTableColumnFilterDef {
  type: DataTableFilterType;
  /** For select: option values */
  options?: { value: string | number; label: string }[];
  /** Placeholder for text filter */
  placeholder?: string;
  min?: number;
  max?: number;
}

/** Single column definition for the data table */
export interface DataTableColumnDef {
  id: string;
  label: string;
  type?: DataTableColumnType;
  sortable?: boolean;
  filterable?: boolean;
  filter?: DataTableColumnFilterDef;
  editable?: boolean;
  visible?: boolean;
  minWidth?: number;
  maxWidth?: number;
  width?: string;
  align?: 'start' | 'center' | 'end';
  headerTooltip?: string;
  /** For status/badge: optional mapping of value → label */
  options?: Record<string, string>;
  /** Order for column reorder (lower = left) */
  order?: number;
  /** Progress: 0-100 or value/max */
  progressMax?: number;
}

export type DataTableDensity = 'comfortable' | 'compact';

/** Pagination state (client-side or server-side) */
export interface DataTablePageState {
  pageIndex: number;
  pageSize: number;
  totalCount?: number;
}

/** Full config for the enhanced data table (optional; legacy config still supported) */
export interface DataTableConfig {
  /** Column definitions (preferred over ordering + labelMapping) */
  columns: DataTableColumnDef[];
  caption?: string;
  /** ARIA description for accessibility */
  ariaLabel?: string;
  sortable?: boolean;
  density?: DataTableDensity;
  stickyHeader?: boolean;
  /** Number of leading columns to freeze (e.g. 1 for first column) */
  frozenColumns?: number;
  /** Row selection: 'none' | 'single' | 'multiple' */
  selection?: 'none' | 'single' | 'multiple';
  /** Show global search input */
  search?: boolean;
  searchPlaceholder?: string;
  /** Pagination */
  pagination?: boolean;
  pageSizeOptions?: number[];
  /** Loading and empty state */
  emptyMessage?: string;
  emptyActionLabel?: string;
  /** Enable column visibility toggle */
  columnVisibility?: boolean;
  /** Enable column reorder via drag */
  columnReorder?: boolean;
  /** Enable column resize */
  columnResize?: boolean;
}

/** Saved view: name + state to restore */
export interface DataTableViewState {
  id: string;
  name: string;
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  columnWidths?: Record<string, number>;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc' | 'none';
  filters: Record<string, unknown>;
  density?: DataTableDensity;
}

export interface DynamicTableConfig {
  columns?: string[];
  labelMapping?: Record<string, string>;
  ordering?: string[];
  stretch?: boolean;
  sortable?: boolean;
  sortableColumns?: string[];
  caption?: string;
  ariaLabel?: string;
  density?: DataTableDensity;
  stickyHeader?: boolean;
  emptyMessage?: string;
  emptyActionLabel?: string;
  columnDefs?: DataTableColumnDef[];
  search?: boolean;
  searchPlaceholder?: string;
  pagination?: boolean;
  pageSizeOptions?: number[];
  /** Number of leading columns to freeze on horizontal scroll */
  frozenColumns?: number;
  /** Row selection: 'none' | 'single' | 'multiple' */
  selection?: 'none' | 'single' | 'multiple';
  /** Show column visibility toggle menu */
  columnVisibility?: boolean;
  /** Allow drag-and-drop column reorder */
  columnReorder?: boolean;
  /** Allow column resize handles */
  columnResize?: boolean;
  /** Saved views (name + state); enable UI */
  savedViews?: boolean;
  /** Mobile: render as cards instead of table */
  mobileCardLayout?: boolean;
  /** Enable export (CSV/Excel) button */
  export?: boolean;
  /** Server-side mode: data/totalCount from server, emit sort/filter/page/search */
  serverSide?: boolean;
}

export interface AuditEvidence {
  id: string;
  type: 'text' | 'file' | 'audit';
  description?: string;
  content?: string;
  fileUrl?: string;
  uploadedBy?: string;
  uploadedAt: string;
}

export interface LocationDepartment {
  id: string;
  name: string;
  subDepartments: { id: string; name: string }[];
}

export interface TemplateQuestion {
  id: string;
  text: string;
  domain: 'Safe' | 'Effective' | 'Caring' | 'Responsive' | 'WellLed';
  regulations: RegulationRef[];
  requiresEvidence: boolean;
  answerType?: 'boolean' | 'scale' | 'text' | 'number';
  guidance?: string;
  weight: number;
}

export interface TemplateSection {
  id: string;
  title: string;
  description: string;
  questions: TemplateQuestion[];
}

export interface RegulationRef {
  id: string;
  title: string;
  description: string;
}

// In your Types.ts file
export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'checkbox' | 'radio' | 'select' | 'table' | 'question' | 'section';

export type TableColumnType = 'text' | 'textarea' | 'number' | 'date' | 'time' | 'checkbox' | 'select';


export interface BasicTableConfig {
  headers: string[];
  rows: number;
  colTypes?: TableColumnType[];
  colOptions?: BasicTableColumnOptions[];
}
export interface BasicTableColumnOptions {
  options: string[];
}
// Basic Audit Field (simplified for backward compatibility)
export interface AuditField {
  metadata?: FieldMetadata;  // Add this line
  helpText?: string;
  defaultValue?: any;
  validation?: FieldValidation;
  conditional?: ConditionalLogic;
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  options?: string[];
  tableConfig?: BasicTableConfig;
  placeholder?: string;
}

export interface CustomAuditTemplate {
  id: string;
  name: string;
  description?: string;
  type?: TemplateType;
  fields: AuditField[];

  // Organization/Location
  locationId?: string;
  organizationId?: string;

  // Metadata (createdBy now OPTIONAL and nested)
  metadata?: {
    createdBy?: string;
    createdAt?: string;
    modifiedAt?: string;
    modifiedBy?: string;
    version?: number;
    category?: string;
    tags?: string[];
    usageCount?: number;
    lastUsed?: string;
    isPublished?: boolean;
    publishedAt?: string;
    publishedBy?: string;
    isShared?: boolean;
    sharedWith?: string[];
  };

  // Settings
  settings?: {
    allowMultipleSubmissions?: boolean;
    requireAllFields?: boolean;
    showProgressBar?: boolean;
    notifyOnSubmit?: boolean;
    notificationRecipients?: string[];
    isScheduled?: boolean;
    scheduleFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    scheduledDays?: number[];
    requiresApproval?: boolean;
    approvers?: string[];
    layout?: 'single-page' | 'multi-page' | 'wizard';
    theme?: 'default' | 'compact' | 'spacious';
    retentionDays?: number;
    archiveAfterDays?: number;
  };

  // Versioning
  version?: number;
  parentTemplateId?: string;

  // Status
  status?: 'draft' | 'active' | 'archived' | 'deprecated' | 'pending';

  // Legacy support (DEPRECATED - use metadata.createdBy instead)
  createdBy?: string; // OPTIONAL for backward compatibility
  createdAt?: string; // OPTIONAL for backward compatibility
}
export type TemplateType =
  | 'audit'
  | 'report'
  | 'weekly-report'
  | 'monthly-report'
  | 'incident-report'
  | 'inspection'
  | 'assessment'
  | 'custom';
export interface AuditResponse {
  id: string;
  templateId: string;
  locationId?: string;
  departmentId?: string;
  subDepartmentId?: string;
  date: string;
  responses: Record<string, any>;

  // Metadata
  submittedBy?: string;
  submittedAt?: string;

  // Workflow
  status?: 'draft' | 'submitted' | 'approved' | 'rejected' | 'archived';
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;

  // Scoring
  totalScore?: number;
  maxScore?: number;
  scorePercentage?: number;

  // Completion tracking
  completedBy?: string;
  completedAt?: string;
}

export type ServiceType = 'CareHome' | 'HomeCare' | 'Both';

export interface RegulationSubsection {
  id: string;
  label: string;
  text: string;
  appliesTo: 'Both' | string;
  defaultIncluded?: boolean;
  domain?: string;
  children?: RegulationSubsection[];
}

export interface RegulationSource {
  publisher: 'CQC' | string;
  hubUrl: string;
  regulationUrl?: string;
  versionDate?: string;
}

export interface RegulationLibrary {
  id: string;
  title: string;
  source: RegulationSource;
  items: RegulationItem[];
}

export interface RegulationItem {
  id: string;
  code: string;
  title: string;
  type: 'Regulation' | 'Appendix' | 'Custom';
  description?: string;
  appliesTo: ServiceType;
  source?: RegulationSource;
  subsections: RegulationClause[];
}

export interface RegulationClause {
  id: string;
  label: string;
  text: string;
  included?: boolean;
  defaultIncluded?: boolean;
  guidance?: string;
  appliesTo: ServiceType;
  domain?: 'Safe' | 'Effective' | 'Caring' | 'Responsive' | 'WellLed';
  tags?: string[];
  children?: RegulationClause[];
}

export type AuditFrequency = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annually' | 'AdHoc';
export type TemplateAuditType = 'baseline' | 'registered_manager' | 'provider';

export interface AuditTemplate {
  id: string;
  name: string;
  auditType?: TemplateAuditType;
  version: string;
  createdAt: string;
  sections: TemplateSection[];
  regulationIds?: string[];
  responsibleRoles?: string[];
  frequency?: AuditFrequency;
  fields?: AuditField[];
}

export type YesNo = 'Y' | 'N';
export type QuestionCompletion = 'NotStarted' | 'InProgress' | 'Awaiting Approval' | 'Completed';

export type CustomFieldType =
  | 'checkbox'
  | 'text'
  | 'textarea'
  | 'question'
  | 'dropdown'
  | 'radio'
  | 'table'
  | 'number'
  | 'date';

export interface CustomField {
  id: string;
  type: CustomFieldType;
  label: string;
  placeholder?: string;
  config?: {
    options?: string[];
    headers?: string[];
    rows?: string[][];
    rowsCount?: number;
    colsCount?: number;
    min?: number;
    max?: number;
    step?: number;
    multiSelect?: boolean;
    required?: boolean;
  };
  required?: boolean;
  defaultValue?: any;
}

export interface AuditQuestionInstance {
  templateQuestionId: string;
  templateType?: string;

  regulationId?: string;
  regulationClauseId?: string;
  clauseLabel?: string;
  customFields?: {
    fieldType?: string,  // Any JSON: tables, objects, arrays
    value?:  any,
    rawResponse?:  any,  // Full form data
    options?:  any,
    tableConfig?:  any,
    default?: {}
  },
  text: string;
  domain: 'Safe' | 'Effective' | 'Caring' | 'Responsive' | 'WellLed';
  score: number;
  evidence: AuditEvidence[];

  evidenceSummaryText?: string;
  actionRequired?: string;
  assignedTo?: string;
  targetDate?: string;
  completed?: YesNo;
  completionStatus?: QuestionCompletion;
  defaultIncluded?: boolean;

  // Custom-field support
  customConfig?: CustomField;
  customValue?: any;
  customValidation?: { isValid: boolean; error?: string };
}

export interface AuditInstance {
  _id?: string;
  id: string;
  title?: string;
  templateId: string;
  auditType: 'baseline' | 'registered_manager' | 'provider' | 'custom-template';
  date: string;

  auditorId?: string;
  locationId?: string;

  departmentId?: string;
  subDepartmentId?: string;

  questions: AuditQuestionInstance[];
  overallScore?: number;
  domainScores?: Record<string, number>;
  // Metadata
  submittedBy?: string;
  submittedAt?: string;
  completedBy?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;

  status?: 'Complete' | 'Not Complete' | ResponseStatus;
  templateType?: 'regulation' | 'custom-checklist' | 'custom-table';

  rowIndex?: number;
  colIndex?: number;
}

export interface AuditSummary {
  completed: number;
  outstanding: number;
  percentComplete: number;
  percentOutstanding: number;
}

export interface CLOEScore {
  Safe: number;
  Effective: number;
  Caring: number;
  Responsive: number;
  WellLed: number;
}

export interface MasterAuditSummary {
  averageScore: number;
  scores: CLOEScore;
}

export interface Regulation {
  id: string;
  title: string;
  description: string;
}

export interface PerformanceSet {
  id: string;
  period: string;
  createdAt: string;
  categories: PerformanceCategory[];
  alerts: Alert[];
  tasks: ActionTask[];
}

export interface PerformanceCategory {
  id: string;
  type: 'KPI' | 'KFI' | 'KCI';
  title: string;
  description: string;
  indicators: Indicator[];
}

export interface Indicator {
  id: string;
  name: string;
  target: number;
  current: number;
  unit: string;
  status: 'Green' | 'Amber' | 'Red';
  trend: 'Improving' | 'Stable' | 'Declining';
  history: IndicatorHistoryPoint[];
  /** When 'audit', current value is derived from custom (basic) audits */
  sourceType?: 'audit' | 'manual';
  /** For audit-sourced: 'monthly' | 'yearly' */
  resetPeriod?: string;
  auditTemplateId?: string;
  auditTemplateKey?: string;
  auditFieldId?: string;
  aggregation?: 'sum' | 'average' | 'count';
}

export interface IndicatorHistoryPoint {
  date: string;
  value: number;
}

export interface Alert {
  id: string;
  indicatorId: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  message: string;
  firstDetected: string;
  lastDetected: string;
  active: boolean;
  location: string;
}

export interface ActionTask {
  id: string;
  alertId: string;
  assignedBy: string;
  assignedTo: string;
  category: string;
  description: string;
  dueDate: string;
  status: 'Open' | 'InProgress' | 'Completed' | 'Overdue';
  comments: TaskComment[];
}

export interface TaskComment {
  date: string;
  text: string;
}

export interface ChartData {
  series: number[];
  categories: string[];
  target?: number;
  markers: number[];
}

export interface CalendarEvent {
  title: string;
  start: Date;
  end?: Date;
  color?: { primary: string; secondary?: string };
  recurring?: boolean;
  rrule?: any;
}

export interface DayEvent {
  title: string;
  start: Date;
  color?: { primary: string; secondary?: string };
}

export interface MonthDay {
  date: any; // moment.Moment if you're using moment; keep `any` unless you import moment types
  events: DayEvent[];
}

export interface Widget {
  id: number;
  label: string;
  content?: Type<any>;
  contentKey: WidgetContentKey;
  metricType?: 'KPI' | 'KFI' | 'KCI' | 'SAT' | 'CLOE' | 'Indicator';
  locationId?: string;
  /** When set, only this indicator is shown in location KPI/KFI/KCI bar charts (single selection). */
  selectedIndicatorId?: string | null;
  /** @deprecated Use selectedIndicatorId for single selection. */
  selectedIndicatorIds?: string[];
  rows?: number;
  cols?: number;
  minCols?: number;
  minRows?: number;
  maxCols?: number;
  maxRows?: number;
  backgroundColor?: string;
  color?: string;
}

export type WidgetContentKey =
  | 'alerts'
  | 'bar'
  | 'location'
  | 'radialGauge'
  | 'radialBarChart'
  | 'tasksBoard'
  | 'governancePlanner'
  | 'auditCompletion'
  | 'riskOverview'
  | 'locationsSummary'
  | 'alertsCount'
  | 'tasksCount'
  | 'companySnapshot'
  | 'indicatorSummary';

export interface HomeCareCoverage {
  centerAddress?: string;
  radiusMiles?: number;
  areas?: string[];
}

export interface HomeCareMetrics {
  activeCases: number;
  maxCases: number;
  billingHours?: number;
  rateCard?: string;
  capacityOverview?: string;
  coverage?: HomeCareCoverage;
}
