// seed/performanceTemplates.seed.js
// Performance indicator templates. Audit-sourced indicators are calculated from
// CustomAuditTemplate instances (master audits); match by metadata.key = auditTemplateKey.
// resetPeriod (weekly/monthly/yearly) determines which audits are aggregated.

/** New standard: indicator definition. Audit-sourced use auditTemplateKey + auditFieldId (no auditTemplateId). */
function ind(id, name, unit, defaultTarget = 0, opts = {}) {
  const sourceType = opts.sourceType ?? "manual";
  return {
    id,
    name,
    unit,
    defaultTarget,
    defaultCurrent: opts.defaultCurrent ?? 0,
    sourceType,
    auditTemplateId: null,
    auditTemplateKey: sourceType === "audit" ? (opts.auditTemplateKey ?? null) : null,
    auditFieldId: sourceType === "audit" ? (opts.auditFieldId ?? null) : null,
    aggregation: opts.aggregation ?? "sum",
    resetPeriod: opts.resetPeriod ?? "monthly",
  };
}

export const CAREHOME_TEMPLATE = {
  locationType: "CareHome",
  key: "default",
  name: "CareHome Default",
  categories: [
    {
      id: "carehome-kpi",
      type: "KPI",
      title: "Performance / quality",
      indicators: [
        ind("kpi-bed-occupancy", "Bed occupancy rate", "%", 90, { sourceType: "manual" }),
        ind("kpi-falls-rate", "Falls rate", "per 1,000 resident-days", 5, { sourceType: "manual" }),
        ind("kpi-pressure-ulcer", "Pressure ulcer incidence", "per 1,000 resident-days", 1, { sourceType: "manual" }),
        ind("kpi-malnutrition", "Malnutrition screening compliance", "%", 95, { sourceType: "manual" }),
        ind("kpi-activities", "Activities participation rate", "% residents/week", 70, { sourceType: "manual" }),
      ],
    },
    {
      id: "carehome-kfi",
      type: "KFI",
      title: "Financial",
      indicators: [
        ind("kfi-food-cost", "Food procurement cost", "GBP", 0, { sourceType: "manual" }),
        ind("kfi-agency-overtime", "Agency spend / overtime expenditure", "GBP", 0, { sourceType: "manual" }),
        ind("kfi-cpobd", "Cost per occupied bed day (CPOBD)", "GBP", 0, { sourceType: "manual" }),
        ind("kfi-fee-yield", "Revenue per occupied bed / fee yield", "GBP", 0, { sourceType: "manual" }),
      ],
    },
    {
      id: "carehome-kci",
      type: "KCI",
      title: "Controls / compliance",
      indicators: [
        ind("kci-med-errors", "Medication error rate", "per 1,000 administrations", 0.5, { sourceType: "manual" }),
        ind("kci-safeguarding", "Safeguarding concerns raised this month", "count", 0, {
          sourceType: "audit",
          auditTemplateKey: "monthly-safeguarding",
          auditFieldId: "msg-concerns-raised",
          aggregation: "sum",
          resetPeriod: "monthly",
        }),
        ind("kci-ipc-audit", "IPC audit pass rate", "%", 95, { sourceType: "manual" }),
        ind("kci-training", "Mandatory training completion", "%", 95, { sourceType: "manual" }),
        ind("kci-complaints", "Complaints responded within policy timeframe", "%", 95, { sourceType: "manual" }),
      ],
    },
  ],
};

export const HOMECARE_TEMPLATE = {
  locationType: "HomeCare",
  key: "default",
  name: "HomeCare Default",
  categories: [
    {
      id: "homecare-kpi",
      type: "KPI",
      title: "Performance / quality",
      indicators: [
        ind("kpi-client-count", "Current client count", "count", 0, {
          sourceType: "audit",
          auditTemplateKey: "weekly-summary",
          auditFieldId: "ws-client-count",
          aggregation: "average",
          resetPeriod: "monthly",
        }),
        ind("kpi-care-plans-reviewed", "Care plans reviewed this month", "count", 0, {
          sourceType: "audit",
          auditTemplateKey: "care-plan-review",
          auditFieldId: "care-reviewed",
          aggregation: "sum",
          resetPeriod: "monthly",
        }),
      ],
    },
    {
      id: "homecare-kfi",
      type: "KFI",
      title: "Financial",
      indicators: [
        ind("kfi-delivered-hours", "Delivered hours total", "hours", 600, {
          sourceType: "audit",
          auditTemplateKey: "weekly-summary",
          auditFieldId: "ws-delivered-hours",
          aggregation: "sum",
          resetPeriod: "monthly",
        }),
        ind("kfi-monthly-hours-actual", "Monthly hours actual (from Monthly Hours Log)", "hours", 600, {
          sourceType: "audit",
          auditTemplateKey: "monthly-hours-log",
          auditFieldId: "mhl-table",
          aggregation: "sum",
          resetPeriod: "monthly",
        }),
        ind("kfi-staff-capacity-hours", "Staff capacity hours", "hours", 600, {
          sourceType: "audit",
          auditTemplateKey: "weekly-summary",
          auditFieldId: "ws-staff-capacity-hours",
          aggregation: "sum",
          resetPeriod: "monthly",
        }),
      ],
    },
    {
      id: "homecare-kci",
      type: "KCI",
      title: "Controls / compliance",
      indicators: [
        ind("kci-careplan-reviewed", "Care plans reviewed (actual)", "count", 0, {
          sourceType: "audit",
          auditTemplateKey: "care-plan-review",
          auditFieldId: "care-actual-reviewed",
          aggregation: "sum",
          resetPeriod: "monthly",
        }),
        ind("kci-training-courses-completed", "Training courses completed at month end", "count", 0, {
          sourceType: "audit",
          auditTemplateKey: "training-compliance",
          auditFieldId: "train-courses-completed",
          aggregation: "sum",
          resetPeriod: "monthly",
        }),
        ind("kci-safeguarding-concerns", "Safeguarding concerns raised this month", "count", 0, {
          sourceType: "audit",
          auditTemplateKey: "monthly-safeguarding",
          auditFieldId: "msg-concerns-raised",
          aggregation: "sum",
          resetPeriod: "monthly",
        }),
        ind("kci-safeguarding-resolved", "Safeguarding concerns resolved/closed", "count", 0, {
          sourceType: "audit",
          auditTemplateKey: "monthly-safeguarding",
          auditFieldId: "msg-resolved",
          aggregation: "sum",
          resetPeriod: "monthly",
        }),
        ind("kci-staff-total-employed", "Total care staff employed", "count", 0, {
          sourceType: "audit",
          auditTemplateKey: "staff-compliance",
          auditFieldId: "staff-total-employed",
          aggregation: "average",
          resetPeriod: "monthly",
        }),
      ],
    },
  ],
};

/**
 * Master audit templates (from MASTER AUDIT CSV seed) that feed key matrix KPI/KFI/KCI.
 * Template key = metadata.key on CustomAuditTemplate. Field ids = template field ids.
 * Indicators use auditTemplateKey + auditFieldId only (auditTemplateId always null).
 * After running seed:master-audits and seed performance templates, run
 * syncAndRecalculateKeyMatrix.js or POST sync-from-template + recalculate-from-audits.
 */
export const AUDIT_TEMPLATE_DEFINITIONS_FOR_INDICATORS = [
  { templateKey: "weekly-summary", name: "Weekly Summary", resetPeriod: "monthly", fields: [{ id: "ws-client-count", label: "Current client count", type: "number" }, { id: "ws-delivered-hours", label: "Delivered hours", type: "number" }, { id: "ws-staff-capacity-hours", label: "Staff capacity hours", type: "number" }] },
  { templateKey: "care-plan-review", name: "Monthly Care Plan Review Compliance Audit", resetPeriod: "monthly", fields: [{ id: "care-reviewed", label: "Care plans reviewed", type: "number" }, { id: "care-actual-reviewed", label: "Actual care plans reviewed", type: "number" }] },
  { templateKey: "staff-compliance", name: "Monthly Staff Compliance Summary Audit", resetPeriod: "monthly", fields: [{ id: "staff-total-employed", label: "Total care staff employed", type: "number" }] },
  { templateKey: "training-compliance", name: "Monthly Training Compliance Audit", resetPeriod: "monthly", fields: [{ id: "train-courses-completed", label: "Courses completed at month end", type: "number" }, { id: "train-courses-assigned", label: "Courses assigned", type: "number" }] },
  { templateKey: "monthly-safeguarding", name: "Monthly Safeguarding Audit", resetPeriod: "monthly", fields: [{ id: "msg-concerns-raised", label: "Safeguarding concerns raised", type: "number" }, { id: "msg-resolved", label: "Concerns resolved/closed", type: "number" }] },
  { templateKey: "monthly-hours-log", name: "Monthly Hours Log", resetPeriod: "monthly", fields: [{ id: "mhl-table", label: "Hours table (sum of numeric cells)", type: "table" }] },
];
