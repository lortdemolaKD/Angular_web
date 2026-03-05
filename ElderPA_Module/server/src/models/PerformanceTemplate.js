// models/PerformanceTemplate.js
import mongoose from "mongoose";

const IndicatorTemplateSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    unit: { type: String, default: "" },
    defaultTarget: { type: Number, default: 0 },
    defaultCurrent: { type: Number, default: 0 },
    // Audit-sourced: value is calculated from custom (basic) audits
    sourceType: { type: String, enum: ["manual", "audit"], default: "manual" },
    auditTemplateId: { type: String, default: null },
    auditTemplateKey: { type: String, default: null }, // e.g. "monthly-billing-hours" to resolve template by name/key
    auditFieldId: { type: String, default: null },    // response field id that holds the value
    aggregation: { type: String, enum: ["sum", "average", "count"], default: "sum" },
    resetPeriod: { type: String, enum: ["weekly", "monthly", "yearly"], default: "monthly" },
  },
  { _id: false }
);

const CategoryTemplateSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ["KPI", "KFI", "KCI"], required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    indicators: { type: [IndicatorTemplateSchema], default: [] },
  },
  { _id: false }
);

const PerformanceTemplateSchema = new mongoose.Schema(
  {
    locationType: { type: String, enum: ["CareHome", "HomeCare", "Both"], required: true },

    // admin-friendly id for picking a template in UI
    key: { type: String, required: true, trim: true },   // e.g. "default", "v1", "2026"
    name: { type: String, required: true, trim: true },  // e.g. "CareHome Default 2026"

    // optional: one active template per type
    isActive: { type: Boolean, default: false },

    categories: { type: [CategoryTemplateSchema], default: [] },

    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
  },
  { timestamps: true }
);

// allow multiple per type, but prevent duplicate keys within same type
PerformanceTemplateSchema.index(
  { locationType: 1, key: 1 },
  { unique: true } // compound unique index enforces uniqueness on the combination [web:200]
);

export const PerformanceTemplate = mongoose.model("PerformanceTemplate", PerformanceTemplateSchema);
