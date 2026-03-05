// models/PerformanceSet.js
import mongoose from "mongoose";

const IndicatorHistorySchema = new mongoose.Schema(
  { date: { type: String, required: true }, value: { type: Number, required: true } },
  { _id: false }
);

const IndicatorSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    target: { type: Number, required: true },
    current: { type: Number, required: true },
    unit: { type: String, default: "" },
    status: { type: String, enum: ["Green", "Amber", "Red"], required: true },
    trend: { type: String, enum: ["Improving", "Stable", "Declining"], required: true },
    history: { type: [IndicatorHistorySchema], default: [] },
    // Audit-sourced: copied from template for recalc
    sourceType: { type: String, enum: ["manual", "audit"], default: "manual" },
    auditTemplateId: { type: String, default: null },
    auditTemplateKey: { type: String, default: null },
    auditFieldId: { type: String, default: null },
    aggregation: { type: String, enum: ["sum", "average", "count"], default: "sum" },
    resetPeriod: { type: String, enum: ["weekly", "monthly", "yearly"], default: "monthly" },
    /** Consecutive periods in breach (Red); used to create alert after 2 weeks/months. */
    consecutiveBreachCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const PerformanceCategorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ["KPI", "KFI", "KCI"], required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    indicators: { type: [IndicatorSchema], default: [] },
  },
  { _id: false }
);

const AlertSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    indicatorId: { type: String, required: true },
    severity: { type: String, enum: ["Low", "Medium", "High", "Critical"], required: true },
    message: { type: String, required: true },
    firstDetected: { type: String, required: true },
    lastDetected: { type: String, required: true },
    active: { type: Boolean, required: true },
    location: { type: String, default: "" },
  },
  { _id: false }
);

const TaskCommentSchema = new mongoose.Schema(
  { date: { type: String, required: true }, text: { type: String, required: true } },
  { _id: false }
);

const ActionTaskSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    alertId: { type: String, required: true },
    assignedBy: { type: String, required: true },
    assignedTo: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    dueDate: { type: String, required: true },
    status: { type: String, enum: ["Open", "InProgress", "Completed", "Overdue"], required: true },
    comments: { type: [TaskCommentSchema], default: [] },
  },
  { _id: false }
);

const PerformanceSetSchema = new mongoose.Schema(
  {
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true },
    templateId: { type: String,  required: true },
    period: { type: String, required: true }, // e.g. 2025-W05 [file:1]

    categories: { type: [PerformanceCategorySchema], default: [] },
    alerts: { type: [AlertSchema], default: [] },
    tasks: { type: [ActionTaskSchema], default: [] },

    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
  },
  { timestamps: true }
);

// one performance set per location per period
PerformanceSetSchema.index({ locationId: 1, period: 1 }, { unique: true }); // unique compound indexes enforce uniqueness [web:220]

export const PerformanceSet = mongoose.model("PerformanceSet", PerformanceSetSchema);
