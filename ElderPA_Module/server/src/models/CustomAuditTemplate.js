import mongoose from "mongoose";

// Field Configuration Schema
const FieldValidationSchema = new mongoose.Schema(
  {
    minLength: Number,
    maxLength: Number,
    pattern: String,
    min: Number,
    max: Number,
    step: Number,
    minDate: String,
    maxDate: String,
    customValidator: String,
    customMessage: String
  },
  { _id: false }
);

const ConditionalLogicSchema = new mongoose.Schema(
  {
    dependsOn: { type: String, required: true },
    condition: {
      type: String,
      enum: ['equals', 'notEquals', 'contains', 'greaterThan', 'lessThan', 'isEmpty', 'isNotEmpty'],
      required: true
    },
    value: mongoose.Schema.Types.Mixed,
    action: {
      type: String,
      enum: ['show', 'hide', 'enable', 'disable', 'require'],
      required: true
    }
  },
  { _id: false }
);

const TableConfigurationSchema = new mongoose.Schema(
  {
    headers: { type: [String], required: true },
    rows: { type: Number, required: true },
    colTypes: [String],
    colOptions: [mongoose.Schema.Types.Mixed],
    defaultFirstColumnValues: [String],
    minRows: Number,
    maxRows: Number,
    allowAddRows: { type: Boolean, default: true },
    allowRemoveRows: { type: Boolean, default: true }
  },
  { _id: false }
);

const FieldMetadataSchema = new mongoose.Schema(
  {
    createdAt: String,
    createdBy: String,
    modifiedAt: String,
    modifiedBy: String,
    order: Number,
    section: String,
    tags: [String]
  },
  { _id: false }
);

// Audit Field Schema
const AuditFieldSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['text', 'textarea', 'number', 'date', 'checkbox', 'radio', 'select', 'table', 'question', 'section']
    },
    label: { type: String, required: true },
    required: { type: Boolean, default: false },
    options: [String],
    tableConfig: TableConfigurationSchema,
    placeholder: String,
    helpText: String,
    defaultValue: mongoose.Schema.Types.Mixed,
    validation: FieldValidationSchema,
    conditional: ConditionalLogicSchema,
    metadata: FieldMetadataSchema
  },
  { _id: false }
);

// Template Metadata Schema
const TemplateMetadataSchema = new mongoose.Schema(
  {
    key: String, // stable key for matching (e.g. key-metrics auditTemplateKey)
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
    modifiedAt: Date,
    modifiedBy: String,
    version: { type: Number, default: 1 },
    category: String,
    tags: [String],
    usageCount: { type: Number, default: 0 },
    lastUsed: Date,
    isPublished: { type: Boolean, default: false },
    publishedAt: Date,
    publishedBy: String,
    isShared: { type: Boolean, default: false },
    sharedWith: [String]
  },
  { _id: false }
);

// Template Settings Schema
const TemplateSettingsSchema = new mongoose.Schema(
  {
    allowMultipleSubmissions: { type: Boolean, default: false },
    requireAllFields: { type: Boolean, default: false },
    showProgressBar: { type: Boolean, default: true },
    notifyOnSubmit: { type: Boolean, default: false },
    notificationRecipients: [String],
    isScheduled: { type: Boolean, default: false },
    scheduleFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']
    },
    scheduledDays: [Number],
    requiresApproval: { type: Boolean, default: false },
    approvers: [String],
    layout: {
      type: String,
      enum: ['single-page', 'multi-page', 'wizard'],
      default: 'single-page'
    },
    theme: {
      type: String,
      enum: ['default', 'compact', 'spacious'],
      default: 'default'
    },
    retentionDays: Number,
    archiveAfterDays: Number
  },
  { _id: false }
);

// Main Custom Audit Template Schema
const CustomAuditTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    type: {
      type: String,
      enum: ['audit', 'report', 'weekly-report', 'monthly-report', 'incident-report', 'inspection', 'assessment', 'custom'],
      default: 'audit'
    },
    fields: [{ type: mongoose.Schema.Types.Mixed, required: true }],

    // Organization/Location
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: false,  // ← Add this
      default: null
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      default: null
    },

    // Metadata
    metadata: TemplateMetadataSchema,

    // Settings
    settings: TemplateSettingsSchema,

    // Versioning
    version: { type: Number, default: 1 },
    parentTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: "CustomAuditTemplate" },

    // Status
    status: {
      type: String,
      enum: ['draft', 'active', 'archived', 'deprecated', 'pending'],
      default: 'draft'
    },

    // Legacy support (for backward compatibility)
    createdBy: String
  },
  {
    timestamps: true // Adds createdAt and updatedAt automatically
  }
);

// Indexes for performance
CustomAuditTemplateSchema.index({ organizationId: 1, status: 1 });
CustomAuditTemplateSchema.index({ locationId: 1, status: 1 });
CustomAuditTemplateSchema.index({ 'metadata.createdBy': 1 });
CustomAuditTemplateSchema.index({ type: 1 });

// Pre-save middleware to update metadata

export default mongoose.model("CustomAuditTemplate", CustomAuditTemplateSchema);
