import mongoose from "mongoose";

const AuditEvidenceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true }, // text/file
    description: { type: String },
    content: { type: String }, // for text evidence
    fileUrl: { type: String }, // for uploaded file
    uploadedBy: { type: String },
    uploadedAt: { type: String }, // keep UI shape (ISO string)
  },
  { _id: false }
);

const AuditQuestionInstanceSchema = new mongoose.Schema(
  {
    templateQuestionId: { type: String, required: true },
    regulationId: { type: String },
    regulationClauseId: { type: String },
    clauseLabel: { type: String },
    text: { type: String, required: true },
    domain: { type: String },
    customFields: {
      type: mongoose.Schema.Types.Mixed,  // Any JSON: tables, objects, arrays
      default: {}
    },
    fieldType: {
      type: String, enum: ['table', 'text', 'question', 'checkboxes'],
      default: 'text'
    },
    score: { type: Number, default: 0 },
    evidence: { type: [AuditEvidenceSchema], default: [] },

    evidenceSummaryText: { type: String },
    actionRequired: { type: String },
    assignedTo: { type: String },
    targetDate: { type: String }, // ISO string

    completed: { type: String }, // "Y" | "N"
    completionStatus: { type: String }, // NotStarted/InProgress/Completed
    defaultIncluded: { type: Boolean, default: true },
  },
  { _id: false }
);

const AuditInstanceSchema = new mongoose.Schema(
  {
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "AuditTemplate", required: true, index: true },

    auditType: { type: String }, // baseline/registeredmanager/provider
    date: { type: String, required: true }, // ISO string (match UI)
    title:{ type: String , required: true},
    auditorId: { type: String },

    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", index: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", index: true },

    departmentId: { type: String },
    subDepartmentId: { type: String },

    questions: { type: [AuditQuestionInstanceSchema], default: [] },

    overallScore: { type: Number },
    domainScores: { type: Object }, // { Safe: 80, Effective: 75, ... }

    status: { type: String, default: "InProgress" }, // InProgress/Complete/NotComplete
  },
  { timestamps: true }
);

export default mongoose.model("AuditInstance", AuditInstanceSchema);
