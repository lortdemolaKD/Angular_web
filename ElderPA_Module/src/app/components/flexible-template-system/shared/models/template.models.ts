
// In your Types.ts file
import {BasicTableColumnOptions} from '../../../Types';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'checkbox' | 'radio' | 'select' | 'table' | 'question' | 'section';

export type TableColumnType = 'text' | 'textarea' | 'number' | 'date' | 'time' | 'checkbox' | 'select';

/**
 * Extended Audit Field with additional builder-specific properties
 */
export interface AuditField {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  options?: string[];
  tableConfig?: TableConfiguration;
  placeholder?: string;
  auditData?: {
    score?: number;           // Current score (0-5)
    maxScore?: number;        // Max score from metadata (5)
    evidence?: string[];      // Evidence chips
    evidenceText?: string;    // Evidence textarea
    actionRequired?: string;  // "None"/"Update Required"
    status?: 'not-started' | 'in-progress' | 'complete' | 'action'; // Status
  };
  // Extended properties for builder
  helpText?: string;
  defaultValue?: any;
  validation?: FieldValidation;
  conditional?: ConditionalLogic;
  metadata?: FieldMetadata;

}

/**
 * Table Configuration
 */
export interface TableConfiguration {
  headers: string[];
  rows: number;
  colTypes?: TableColumnType[];
  colOptions?: BasicTableColumnOptions[];
  /** Pre-fill first column for each row (e.g. audit questions). */
  defaultFirstColumnValues?: string[];
  minRows?: number;
  maxRows?: number;
  allowAddRows?: boolean;
  allowRemoveRows?: boolean;
}

/**
 * Field Validation Rules
 */
export interface FieldValidation {
  // Text validation
  minLength?: number;
  maxLength?: number;
  pattern?: string; // Regex pattern

  // Number validation
  min?: number;
  max?: number;
  step?: number;

  // Date validation
  minDate?: string;
  maxDate?: string;

  // Custom validation
  customValidator?: string; // Function name or expression
  customMessage?: string;
}

/**
 * Conditional Logic for showing/hiding fields
 */
export interface ConditionalLogic {
  dependsOn: string; // Field ID this depends on
  condition: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan' | 'isEmpty' | 'isNotEmpty';
  value?: any;
  action: 'show' | 'hide' | 'enable' | 'disable' | 'require';
}

/**
 * Field Metadata for internal use
 */
export interface FieldMetadata {
  createdAt?: string;
  createdBy?: string;
  modifiedAt?: string;
  modifiedBy?: string;
  order?: number;
  section?: string; // Section grouping
  tags?: string[];
  domain?: "Safe" | "Effective" | "Caring" | "Responsive" | "WellLed";
  regulationId?: string;
  scoreMax?: number;
}

/**
 * Custom Audit Template
 */
export interface CustomAuditTemplate {
  id: string;
  name: string;
  description?: string;
  type: TemplateType;
  fields: AuditField[];

  // Organization/Location
  locationId?: string;
  organizationId?: string;

  // Metadata
  metadata?: TemplateMetadata;

  // Settings
  settings?: TemplateSettings;

  // Versioning
  version?: number;
  parentTemplateId?: string; // For template inheritance

  // Status
  status?: TemplateStatus;
}

/**
 * Template Type
 */
export type TemplateType =
  | 'audit'           // CQC-style audits
  | 'report'          // General reports
  | 'weekly-report'   // Weekly reports
  | 'monthly-report'  // Monthly reports
  | 'incident-report' // Incident reporting
  | 'inspection'      // Inspection checklists
  | 'assessment'      // Care assessments
  | 'custom';         // Custom templates

/**
 * Template Metadata
 */
export interface TemplateMetadata {
  createdBy?: string;
  createdAt?: string;
  modifiedAt?: string;
  modifiedBy?: string;
  version?: number;

  // Categorization
  category?: string;
  tags?: string[];

  // Usage tracking
  usageCount?: number;
  lastUsed?: string;

  // Publishing
  isPublished?: boolean;
  publishedAt?: string;
  publishedBy?: string;

  // Sharing
  isShared?: boolean;
  sharedWith?: string[]; // User IDs or organization IDs
}

/**
 * Template Settings
 */
export interface TemplateSettings {
  // Submission settings
  allowMultipleSubmissions?: boolean;
  requireAllFields?: boolean;
  showProgressBar?: boolean;

  // Notifications
  notifyOnSubmit?: boolean;
  notificationRecipients?: string[];

  // Scheduling
  isScheduled?: boolean;
  scheduleFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  scheduledDays?: number[]; // Day of week (0-6) or day of month (1-31)

  // Workflow
  requiresApproval?: boolean;
  approvers?: string[];

  // Display
  layout?: 'single-page' | 'multi-page' | 'wizard';
  theme?: 'default' | 'compact' | 'spacious';

  // Data retention
  retentionDays?: number;
  archiveAfterDays?: number;
}

/**
 * Template Status
 */
export type TemplateStatus =
  | 'draft'       // Being created/edited
  | 'active'      // Published and in use
  | 'archived'    // No longer in use
  | 'deprecated'  // Replaced by newer version
  | 'pending';    // Awaiting approval

/**
 * Audit Response
 */
export interface AuditResponse {
  id: string;
  templateId: string;
  locationId?: string;
  date: string;
  responses: Record<string, any>;

  // Metadata
  submittedBy?: string;
  submittedAt?: string;
// ADD THESE FIELDS:
  completedBy?: string;
  completedAt?: string;
  // Workflow
  status?: ResponseStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;

  // Scoring (for audit templates)
  totalScore?: number;
  maxScore?: number;
  scorePercentage?: number;

  // Attachments
  attachments?: ResponseAttachment[];

  // Comments
  comments?: ResponseComment[];
}
export interface AuditQuestion {
  id: string;
  type: FieldType;  // 'text' | 'textarea' | etc.
  label: string;
  required?: boolean;
  value: any;  // string | number | boolean | any[] | table data
  score?: number;  // For 'question' type
  evidence?: string;  // For 'question' type
  options?: string[];  // Dropdown/checkbox values
  tableData?: any[][];  // [[row1col1, row1col2], [row2col1, ...]]
  isValid?: boolean;
  validationErrors?: string[];
}
export interface AuditQuestionBackend {
  fieldType: string;           // "text", "table", "question", etc.
  score?: number;              // 0-5 for scoring fields
  defaultIncluded: boolean;    // Always true for auto-generated
  evidence?: string[];         // [] for question evidence
  fieldId?: string;            // Link to original template field.id
  label?: string;              // Human-readable name
  required?: boolean;
  value?: any;                 // User response (string | number | array)
  tableData?: any[][];         // For table fields
  validationErrors?: string[]; // Optional
}
/**
 * Response Status
 */
export type ResponseStatus =
  | 'draft'       // Being filled out
  | 'submitted'   // Submitted for review
  | 'approved'    // Approved
  | 'rejected'    // Rejected
  | 'archived';   // Archived

/**
 * Response Attachment
 */
export interface ResponseAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: string;
  fieldId?: string; // Which field this is attached to
}

/**
 * Response Comment
 */
export interface ResponseComment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  fieldId?: string; // Field-specific comment
  isInternal?: boolean; // Internal notes vs public comments
}

/**
 * Template Category
 */
export interface TemplateCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string; // For nested categories
  order?: number;
}

/**
 * Palette Item (for builder UI)
 */
export interface PaletteItem {
  type: FieldType | 'section';
  label: string;
  icon: string;
  description: string;
  defaultConfig?: Partial<AuditField>;
  category?: 'basic' | 'advanced' | 'layout' | 'audit';
}

/**
 * Builder Configuration
 */
export interface BuilderConfig {
  availableFieldTypes: FieldType[];
  enableAdvancedFeatures: boolean;
  enableConditionalLogic: boolean;
  enableValidation: boolean;
  maxFieldsPerTemplate?: number;
  allowedTemplateTypes?: TemplateType[];
}

/**
 * Form Submission Result
 */
export interface FormSubmissionResult {
  success: boolean;
  responseId?: string;
  errors?: FormError[];
  warnings?: string[];
  message?: string;
}

/**
 * Form Error
 */
export interface FormError {
  fieldId: string;
  fieldLabel: string;
  errorType: 'required' | 'validation' | 'format' | 'custom';
  message: string;
}

/**
 * Template Statistics
 */
export interface TemplateStatistics {
  templateId: string;
  totalResponses: number;
  completedResponses: number;
  averageCompletionTime?: number; // in seconds
  averageScore?: number;
  lastResponseDate?: string;
  popularityScore?: number;
}

/**
 * Template Version History
 */
export interface TemplateVersion {
  versionNumber: number;
  templateSnapshot: CustomAuditTemplate;
  createdBy: string;
  createdAt: string;
  changeDescription?: string;
  changesSummary?: VersionChanges;
}

/**
 * Version Changes Summary
 */
export interface VersionChanges {
  fieldsAdded: number;
  fieldsRemoved: number;
  fieldsModified: number;
  metadataChanged: boolean;
  settingsChanged: boolean;
}

/**
 * Template Search Criteria
 */
export interface TemplateSearchCriteria {
  query?: string;
  type?: TemplateType;
  category?: string;
  tags?: string[];
  status?: TemplateStatus;
  createdBy?: string;
  organizationId?: string;
  locationId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'name' | 'createdAt' | 'modifiedAt' | 'usageCount';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Template Export Options
 */
export interface TemplateExportOptions {
  format: 'json' | 'csv' | 'pdf' | 'excel';
  includeMetadata: boolean;
  includeResponses?: boolean;
  dateRange?: {
    from: string;
    to: string;
  };
}

/**
 * Template Import Result
 */
export interface TemplateImportResult {
  success: boolean;
  template?: CustomAuditTemplate;
  errors?: string[];
  warnings?: string[];
  duplicateFields?: string[];
}

/**
 * Field Type Definitions (Extended)
 */
export type ExtendedFieldType = FieldType | 'file' | 'signature' | 'calculation' | 'rating' | 'slider';

/**
 * Question Field Configuration (for audit questions)
 */
export interface QuestionFieldConfig {
  scoreMin?: number;
  scoreMax?: number;
  scoreStep?: number;
  requireEvidence?: boolean;
  requireAction?: boolean;
  evidenceMinLength?: number;
  evidenceMaxLength?: number;
}

/**
 * Calculation Field Configuration
 */
export interface CalculationFieldConfig {
  formula: string; // Expression like "field1 + field2"
  dependsOn: string[]; // Field IDs used in calculation
  displayFormat?: 'number' | 'currency' | 'percentage';
  decimalPlaces?: number;
}

/**
 * Rating Field Configuration
 */
export interface RatingFieldConfig {
  maxRating: number; // e.g., 5 for 5-star rating
  allowHalf?: boolean;
  icon?: 'star' | 'heart' | 'thumb' | 'circle';
  labels?: string[]; // Labels for each rating level
}

/**
 * File Upload Configuration
 */
export interface FileUploadConfig {
  allowedTypes?: string[]; // e.g., ['image/*', 'application/pdf']
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  requirePreview?: boolean;
}

/**
 * Signature Configuration
 */
export interface SignatureConfig {
  requireFullName?: boolean;
  requireDate?: boolean;
  requireTitle?: boolean;
  signatureType?: 'draw' | 'type' | 'upload';
}

/**
 * Template Permissions
 */
export interface TemplatePermissions {
  canView: string[]; // User IDs or role names
  canEdit: string[];
  canDelete: string[];
  canSubmit: string[];
  canApprove: string[];
  isPublic?: boolean;
}

/**
 * Bulk Operation Result
 */
export interface BulkOperationResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  errors: Array<{
    itemId: string;
    error: string;
  }>;
}

/**
 * Template Clone Options
 */
export interface TemplateCloneOptions {
  newName: string;
  includeMetadata?: boolean;
  includeSettings?: boolean;
  resetUsageStats?: boolean;
  newOrganizationId?: string;
  newLocationId?: string;
}

/**
 * Type Guards
 */
export function isTableField(field: AuditField): field is AuditField & { tableConfig: TableConfiguration } {
  return field.type === 'table' && !!field.tableConfig;
}

export function isQuestionField(field: AuditField): field is AuditField & { type: 'question' } {
  return field.type === 'question';
}

export function hasOptions(field: AuditField): field is AuditField & { options: string[] } {
  return ['checkbox', 'radio', 'select'].includes(field.type) && !!field.options;
}

export function isConditionalField(field: AuditField): field is AuditField & { conditional: ConditionalLogic } {
  return !!field.conditional;
}

/**
 * Utility Types
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Constants
 */
export const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = {
  allowMultipleSubmissions: false,
  requireAllFields: false,
  showProgressBar: true,
  notifyOnSubmit: false,
  requiresApproval: false,
  layout: 'single-page',
  theme: 'default'
};

export const DEFAULT_TABLE_CONFIG: TableConfiguration = {
  headers: ['Column 1', 'Column 2'],
  rows: 1,
  colTypes: ['text', 'text'],
  minRows: 1,
  maxRows: 50,
  allowAddRows: true,
  allowRemoveRows: true
};

export const FIELD_TYPE_ICONS: Record<string, string> = {
  text: 'short_text',
  textarea: 'notes',
  number: 'looks_one',
  checkbox: 'check_box',
  radio: 'radio_button_checked',
  select: 'arrow_drop_down_circle',
  date: 'calendar_today',
  table: 'table_chart',
  question: 'help_outline',
  section: 'title',
  file: 'attach_file',
  signature: 'draw',
  calculation: 'calculate',
  rating: 'star',
  slider: 'tune'
};

export const FIELD_TYPE_NAMES: Record<string, string> = {
  text: 'Short Text',
  textarea: 'Long Text',
  number: 'Number',
  checkbox: 'Checkbox',
  radio: 'Radio Group',
  select: 'Dropdown',
  date: 'Date',
  table: 'Table',
  question: 'Audit Question',
  section: 'Section Header',
  file: 'File Upload',
  signature: 'Signature',
  calculation: 'Calculation',
  rating: 'Rating',
  slider: 'Slider'
};

/**
 * Validators
 */
export class TemplateValidator {
  static validateTemplate(template: CustomAuditTemplate): FormError[] {
    const errors: FormError[] = [];

    // Validate template name
    if (!template.name || template.name.trim().length === 0) {
      errors.push({
        fieldId: 'name',
        fieldLabel: 'Template Name',
        errorType: 'required',
        message: 'Template name is required'
      });
    }

    // Validate fields
    if (!template.fields || template.fields.length === 0) {
      errors.push({
        fieldId: 'fields',
        fieldLabel: 'Fields',
        errorType: 'required',
        message: 'Template must have at least one field'
      });
    }

    // Validate field IDs are unique
    const fieldIds = new Set<string>();
    template.fields?.forEach((field, index) => {
      if (fieldIds.has(field.id)) {
        errors.push({
          fieldId: field.id,
          fieldLabel: field.label,
          errorType: 'validation',
          message: `Duplicate field ID: ${field.id}`
        });
      }
      fieldIds.add(field.id);

      // Validate field label
      if (!field.label || field.label.trim().length === 0) {
        errors.push({
          fieldId: field.id,
          fieldLabel: `Field ${index + 1}`,
          errorType: 'required',
          message: 'Field label is required'
        });
      }
    });

    return errors;
  }

  static validateField(field: AuditField): FormError[] {
    const errors: FormError[] = [];

    if (!field.id) {
      errors.push({
        fieldId: 'id',
        fieldLabel: 'Field ID',
        errorType: 'required',
        message: 'Field ID is required'
      });
    }

    if (!field.label) {
      errors.push({
        fieldId: field.id,
        fieldLabel: 'Label',
        errorType: 'required',
        message: 'Field label is required'
      });
    }

    // Type-specific validation
    if (hasOptions(field)) {
      if (!field.options || field.options.length === 0) {
        errors.push({
          fieldId: field.id,
          fieldLabel: field.label,
          errorType: 'validation',
          message: 'Field must have at least one option'
        });
      }
    }

    if (isTableField(field)) {
      if (!field.tableConfig.headers || field.tableConfig.headers.length === 0) {
        errors.push({
          fieldId: field.id,
          fieldLabel: field.label,
          errorType: 'validation',
          message: 'Table must have at least one column'
        });
      }
    }

    return errors;
  }
}
