import express from "express";
import mongoose from "mongoose";
import { PerformanceSet } from "../models/PerformanceSet.js";
import { PerformanceTemplate } from "../models/PerformanceTemplate.js";
import { Location } from "../models/Location.js";
import { Account } from "../models/Account.js";
import AuditInstance from "../models/AuditInstance.js";
import CustomAuditTemplate from "../models/CustomAuditTemplate.js";

const router = express.Router();
const admin_ROLES = [
  "SystemAdmin",
  "OrgAdmin",
  "RegisteredManager",
];
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  next();
}
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

const requireAdmin = requireRole(admin_ROLES);

/** Parse performance set period (e.g. "2026-W19" or "2026-05") to year/month for audit date range. */
function yearMonthFromPeriod(period) {
  if (!period || typeof period !== "string") return null;
  const isoWeek = period.match(/^(\d{4})-W(\d{1,2})$/i);
  if (isoWeek) {
    const y = parseInt(isoWeek[1], 10);
    const w = parseInt(isoWeek[2], 10);
    if (w < 1 || w > 53) return null;
    const jan4 = new Date(y, 0, 4);
    const monOffset = jan4.getDay() === 0 ? -6 : 1 - jan4.getDay();
    const week1Mon = new Date(y, 0, 4 + monOffset);
    const targetMon = new Date(week1Mon);
    targetMon.setDate(week1Mon.getDate() + (w - 1) * 7);
    return { year: targetMon.getFullYear(), month: targetMon.getMonth() + 1 };
  }
  const yyyyMm = period.match(/^(\d{4})-(\d{2})$/);
  if (yyyyMm) {
    const m = parseInt(yyyyMm[2], 10);
    if (m >= 1 && m <= 12) return { year: parseInt(yyyyMm[1], 10), month: m };
  }
  return null;
}

// list/search by location+period (admin: any location; non-admin: only their assigned location)
router.get("/", requireAuth, async (req, res) => {
  const { locationId, period } = req.query;
  const filter = { deletedAt: null };

  if (!admin_ROLES.includes(req.user.role)) {
    // Non-admin: may only request performance sets for their assigned location
    let assignedLocId = req.user.locationId;
    if (!assignedLocId && req.user.id) {
      const account = await Account.findById(req.user.id).select("locationId").lean();
      assignedLocId = account?.locationId;
    }
    if (!assignedLocId || !mongoose.isValidObjectId(assignedLocId)) {
      return res.status(403).json({ message: "Forbidden: no location assigned" });
    }
    filter.locationId = new mongoose.Types.ObjectId(assignedLocId);
  } else {
    if (locationId) {
      if (!mongoose.isValidObjectId(locationId)) return res.status(400).json({ message: "Invalid locationId" });
      filter.locationId = new mongoose.Types.ObjectId(locationId);
    }
  }
  if (period) filter.period = period;

  const sets = await PerformanceSet.find(filter).sort({ createdAt: -1 }).lean();
  res.json(sets.map(mapPerformanceSet));
});

// get one
router.get("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

  const set = await PerformanceSet.findOne({ _id: id, deletedAt: null }).lean();
  if (!set) return res.status(404).json({ message: "Performance set not found" });

  res.json(mapPerformanceSet(set));
});

// create (enforce one per location+period via unique index)
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const input = req.body ?? {};
  if (!input.locationId) return res.status(400).json({ message: "locationId is required" });
  if (!mongoose.isValidObjectId(input.locationId)) return res.status(400).json({ message: "Invalid locationId" });
  if (!input.period) return res.status(400).json({ message: "period is required" });

  const set = await PerformanceSet.create({
    locationId: input.locationId,
    period: input.period,
    categories: input.categories ?? [],
    alerts: input.alerts ?? [],
    tasks: input.tasks ?? [],
  });

  res.status(201).json(mapPerformanceSet(set.toObject()));
});

// edit (PATCH = partial updates)
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

  const update = req.body ?? {};
  delete update.deletedAt;
  delete update.deletedBy;

  const set = await PerformanceSet.findOneAndUpdate(
    { _id: id, deletedAt: null },
    update,
    { new: true, runValidators: true } // enable update validators [web:284]
  ).lean();

  if (!set) return res.status(404).json({ message: "Performance set not found" });
  res.json(mapPerformanceSet(set));
});

/**
 * POST /api/performanceSets/:id/resolve-alert
 * Body: { alertId: string }
 * Removes the alert and all tasks linked to it (when RM marks issue as done / return to normal).
 */
router.post("/:id/resolve-alert", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const alertId = req.body?.alertId;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });
  if (!alertId || typeof alertId !== "string") return res.status(400).json({ message: "alertId is required" });

  const set = await PerformanceSet.findOne({ _id: id, deletedAt: null }).lean();
  if (!set) return res.status(404).json({ message: "Performance set not found" });

  const alerts = (set.alerts || []).filter((a) => a.id !== alertId);
  const tasks = (set.tasks || []).filter((t) => t.alertId !== alertId);

  const updated = await PerformanceSet.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { alerts, tasks },
    { new: true, runValidators: true }
  ).lean();

  if (!updated) return res.status(404).json({ message: "Performance set not found" });
  res.json(mapPerformanceSet(updated));
});

// soft delete
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

  const set = await PerformanceSet.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { deletedAt: new Date(), deletedBy: req.user.id },
    { new: true }
  ).lean();

  if (!set) return res.status(404).json({ message: "Performance set not found" });
  res.json({ ok: true });
});

/** Clone template categories into set shape (with audit fields). */
function cloneTemplateToSetCategories(templateCategories = []) {
  return (templateCategories || []).map((cat) => ({
    id: cat.id,
    type: cat.type,
    title: cat.title,
    description: cat.description ?? "",
    indicators: (cat.indicators ?? []).map((ind) => ({
      id: ind.id,
      name: ind.name,
      target: typeof ind.defaultTarget === "number" ? ind.defaultTarget : (typeof ind.target === "number" ? ind.target : 0),
      current: typeof ind.defaultCurrent === "number" ? ind.defaultCurrent : (typeof ind.current === "number" ? ind.current : 0),
      unit: ind.unit ?? "",
      status: ind.status ?? "Green",
      trend: ind.trend ?? "Stable",
      history: Array.isArray(ind.history) ? ind.history : [],
      sourceType: ind.sourceType ?? "manual",
      auditTemplateId: ind.auditTemplateId ?? null,
      auditTemplateKey: ind.auditTemplateKey ?? null,
      auditFieldId: ind.auditFieldId ?? null,
      aggregation: ind.aggregation ?? "sum",
      resetPeriod: ind.resetPeriod ?? "monthly",
      consecutiveBreachCount: ind.consecutiveBreachCount ?? 0,
    })),
  }));
}

/**
 * POST /api/performanceSets/:id/sync-from-template
 * Body: { replaceCategories?: boolean }
 * - replaceCategories: true → replace set categories with active template (new structure + audit indicators).
 * - else → copy audit fields into existing indicators by matching indicator id.
 */
router.post("/:id/sync-from-template", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const replaceCategories = req.body?.replaceCategories === true;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

  const set = await PerformanceSet.findOne({ _id: id, deletedAt: null }).lean();
  if (!set) return res.status(404).json({ message: "Performance set not found" });

  const location = await Location.findById(set.locationId).lean();
  if (!location) return res.status(404).json({ message: "Location not found" });

  const locationType = location.type === "Care Home" ? "CareHome" : location.type === "Home Care" ? "HomeCare" : location.type;
  const template = await PerformanceTemplate.findOne({
    isActive: true,
    locationType,
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (!template) return res.status(404).json({ message: `No active PerformanceTemplate for ${locationType}` });

  let updatedCategories;

  if (replaceCategories) {
    updatedCategories = cloneTemplateToSetCategories(template.categories);
  } else {
    const templateIndicatorsByCat = new Map();
    for (const cat of template.categories ?? []) {
      const byId = new Map((cat.indicators ?? []).map((ind) => [ind.id, ind]));
      templateIndicatorsByCat.set(cat.id, byId);
    }
    updatedCategories = (set.categories ?? []).map((cat) => {
      const tplIndicators = templateIndicatorsByCat.get(cat.id);
      const updatedIndicators = (cat.indicators ?? []).map((ind) => {
        const tpl = tplIndicators?.get(ind.id);
        if (!tpl) return ind;
        return {
          ...ind,
          sourceType: tpl.sourceType ?? ind.sourceType ?? "manual",
          auditTemplateId: tpl.auditTemplateId ?? ind.auditTemplateId,
          auditTemplateKey: tpl.auditTemplateKey ?? ind.auditTemplateKey,
          auditFieldId: tpl.auditFieldId ?? ind.auditFieldId,
          aggregation: tpl.aggregation ?? ind.aggregation ?? "sum",
          resetPeriod: tpl.resetPeriod ?? ind.resetPeriod ?? "monthly",
        };
      });
      return { ...cat, indicators: updatedIndicators };
    });
  }

  const updated = await PerformanceSet.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { categories: updatedCategories },
    { new: true, runValidators: true }
  ).lean();

  if (!updated) return res.status(404).json({ message: "Performance set not found" });
  res.json(mapPerformanceSet(updated));
});

/**
 * POST /api/performanceSets/:id/recalculate-from-audits
 * Recomputes indicator.current for all audit-sourced indicators from custom (basic) audits.
 * Uses indicator.resetPeriod (monthly/yearly) to determine date range and aggregates by sum/average/count.
 */
router.post("/:id/recalculate-from-audits", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

  const set = await PerformanceSet.findOne({ _id: id, deletedAt: null }).lean();
  if (!set) return res.status(404).json({ message: "Performance set not found" });

  const now = new Date();
  const locationId = String(set.locationId);
  const debug = { setId: id, locationId, categories: (set.categories || []).length, auditIndicators: 0, byIndicator: [] };

  // Use query override, else derive from set.period (e.g. 2026-W19 → May 2026), else current month
  const fromPeriod = yearMonthFromPeriod(set.period);
  const queryYear = req.query.year ? parseInt(req.query.year, 10) : (fromPeriod?.year ?? now.getFullYear());
  const queryMonth = req.query.month ? parseInt(req.query.month, 10) : (fromPeriod?.month ?? now.getMonth() + 1);
  debug.periodUsed = { year: queryYear, month: queryMonth, fromPeriod: !!fromPeriod };

  const getDateRange = (resetPeriod) => {
    if (resetPeriod === "yearly") {
      return { start: `${queryYear}-01-01`, end: `${queryYear}-12-31` };
    }
    const m = String(queryMonth).padStart(2, "0");
    const lastDay = new Date(queryYear, queryMonth, 0).getDate();
    return { start: `${queryYear}-${m}-01`, end: `${queryYear}-${m}-${String(lastDay).padStart(2, "0")}` };
  };

  /** Month name/label to 1-based month number (for table row labels like jan, feb, or numeric 1–12). */
  const monthLabelToNumber = (label) => {
    if (label == null) return null;
    const n = Number(label);
    if (!Number.isNaN(n) && n >= 1 && n <= 12) return Math.floor(n);
    const s = String(label).trim().toLowerCase().slice(0, 3);
    const map = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    return map[s] ?? null;
  };

  /** Extract a single numeric value from an audit question (custom template number, text, date, or table). */
  const extractValueFromQuestion = (q, fieldId) => {
    if (q.templateQuestionId !== fieldId) return null;
    const cf = q.customFields || {};
    const v = cf.value ?? cf.rawResponse ?? (typeof q.score === "number" ? q.score : null);
    if (v === undefined || v === null) return null;
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "object" && v !== null && typeof v.value === "number") return v.value;
    // Table (array of rows): sum all numeric cells for use as indicator value
    if (Array.isArray(v)) {
      let sum = 0;
      for (const row of v) {
        const arr = Array.isArray(row) ? row : (typeof row === "object" && row !== null ? Object.values(row) : []);
        for (const cell of arr) {
          const n = Number(cell);
          if (!Number.isNaN(n)) sum += n;
        }
      }
      return sum;
    }
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };

  /** Extract per-row values from a table question for chart history (one bar per row). Returns [{ date: "YYYY-MM", value }]. */
  const extractTableHistoryFromQuestion = (q, fieldId, year) => {
    if (q.templateQuestionId !== fieldId) return null;
    const cf = q.customFields || {};
    const v = cf.value ?? cf.rawResponse ?? null;
    if (!Array.isArray(v) || v.length === 0) return null;
    const yearNum = typeof year === "number" ? year : new Date().getFullYear();
    const out = [];
    for (const row of v) {
      const arr = Array.isArray(row) ? row : (typeof row === "object" && row !== null ? Object.values(row) : []);
      const first = arr[0];
      const monthNum = monthLabelToNumber(first);
      let rowSum = 0;
      for (let i = 1; i < arr.length; i++) {
        const n = Number(arr[i]);
        if (!Number.isNaN(n)) rowSum += n;
      }
      const dateStr = monthNum != null ? `${yearNum}-${String(monthNum).padStart(2, "0")}` : null;
      if (dateStr != null) out.push({ date: dateStr, value: rowSum });
    }
    return out.length ? out : null;
  };

  const updatedCategories = [];
  for (const cat of set.categories || []) {
    const updatedIndicators = [];
    for (const ind of cat.indicators || []) {
      if (ind.sourceType !== "audit" || (!ind.auditTemplateKey && !ind.auditTemplateId)) {
        updatedIndicators.push(ind);
        continue;
      }
      debug.auditIndicators += 1;
      const { start, end } = getDateRange(ind.resetPeriod || "monthly");

      let templateIds = [];
      let templatesMatched = [];
      if (ind.auditTemplateId) {
        templateIds = [new mongoose.Types.ObjectId(ind.auditTemplateId)];
      } else if (ind.auditTemplateKey) {
        const key = ind.auditTemplateKey.toLowerCase().replace(/\s+/g, "-");
        const templates = await CustomAuditTemplate.find({
          $or: [
            { name: new RegExp(key, "i") },
            { "metadata.key": key },
          ],
        }).lean();
        templateIds = templates.map((t) => t._id);
        templatesMatched = templates.map((t) => ({ id: String(t._id), name: t.name, metadataKey: t.metadata?.key }));
      }
      if (templateIds.length === 0) {
        debug.byIndicator.push({
          name: ind.name,
          fieldId: ind.auditFieldId,
          key: ind.auditTemplateKey,
          dateRange: { start, end },
          templatesMatched: [],
          templateIds: [],
          templatesFound: 0,
          audits: 0,
          auditSummary: [],
          values: [],
          valuesCount: 0,
          newCurrent: ind.current,
          hint: "No CustomAuditTemplate found for this key. Seed master audits or check metadata.key.",
        });
        updatedIndicators.push(ind);
        continue;
      }

      const audits = await AuditInstance.find({
        locationId: new mongoose.Types.ObjectId(locationId),
        date: { $gte: start, $lte: end },
        templateId: { $in: templateIds },
      }).lean();

      const values = [];
      const auditSummary = [];
      const tableHistoryByMonth = new Map(); // YYYY-MM -> { value, auditDate } so we merge all audits by month (last audit wins per month)
      let weeklyHistory = []; // one bar per audit for weekly-summary (e.g. Delivered hours per week)
      for (const audit of audits) {
        let foundInAudit = 0;
        let valueFromThisAudit = null;
        const auditYear = audit.date ? parseInt(String(audit.date).slice(0, 4), 10) : queryYear;
        for (const q of audit.questions || []) {
          const val = extractValueFromQuestion(q, ind.auditFieldId);
          if (val !== null) {
            values.push(val);
            if (valueFromThisAudit === null) valueFromThisAudit = val;
            foundInAudit += 1;
          }
          if (ind.auditFieldId === "mhl-table") {
            const rowHistory = extractTableHistoryFromQuestion(q, ind.auditFieldId, auditYear);
            if (rowHistory?.length) {
              for (const { date: monthKey, value } of rowHistory) {
                tableHistoryByMonth.set(monthKey, { value, auditDate: audit.date });
              }
            }
          }
        }
        if (valueFromThisAudit !== null && ind.auditTemplateKey === "weekly-summary" && audit.date) {
          weeklyHistory.push({ date: String(audit.date).slice(0, 10), value: valueFromThisAudit });
        }
        auditSummary.push({ auditId: String(audit._id), date: audit.date, title: audit.title, valuesFromThisAudit: foundInAudit });
      }
      const tableHistory = Array.from(tableHistoryByMonth.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, { value }]) => ({ date, value }));

      let newCurrent = ind.current;
      const agg = ind.aggregation || "sum";
      if (values.length > 0) {
        if (agg === "sum") newCurrent = values.reduce((a, b) => a + b, 0);
        else if (agg === "average") newCurrent = values.reduce((a, b) => a + b, 0) / values.length;
        else if (agg === "count") newCurrent = values.length;
      }

      const target = ind.target ?? 0;
      let status = ind.status || "Green";
      if (ind.unit && /GBP|cost|spend/i.test(ind.unit)) {
        status = newCurrent > target ? "Red" : newCurrent > target * 0.9 ? "Amber" : "Green";
      } else {
        // For hours/counts etc: below target = breach. Red when < 90% of target, Amber when < target, Green when >= target
        status = target <= 0 ? "Green" : newCurrent < target * 0.9 ? "Red" : newCurrent < target ? "Amber" : "Green";
      }

      // Chart history: weekly-summary → one bar per audit (per week); mhl-table → one bar per month; else keep existing
      let newHistory = ind.history ?? [];
      if (weeklyHistory.length > 0) {
        newHistory = weeklyHistory.sort((a, b) => a.date.localeCompare(b.date));
      } else if (tableHistory.length > 0) {
        newHistory = tableHistory;
      }

      // If no audits in range, add hint: any audits for this template at this location?
      let hint;
      if (audits.length === 0) {
        const anyAudits = await AuditInstance.find({
          locationId: new mongoose.Types.ObjectId(locationId),
          templateId: { $in: templateIds },
        })
          .select({ _id: 1, date: 1, title: 1 })
          .limit(5)
          .lean();
        hint = anyAudits.length
          ? `No audits in ${start}–${end}. Found ${anyAudits.length} audit(s) for this template: ${anyAudits.map((a) => a.date).join(", ")}. Use recalc period override to include them.`
          : `No audits for this template at this location. Create an audit with the matching template.`;
      }

      const inBreach = status === "Red" || status === "Amber";
      const consecutiveBreachCount = inBreach ? (ind.consecutiveBreachCount ?? 0) + 1 : 0;
      debug.byIndicator.push({
        name: ind.name,
        fieldId: ind.auditFieldId,
        key: ind.auditTemplateKey,
        dateRange: { start, end },
        templatesMatched,
        templateIds: templateIds.map((tid) => String(tid)),
        templatesFound: templateIds.length,
        audits: audits.length,
        auditSummary,
        values: values.slice(0, 20),
        valuesCount: values.length,
        aggregation: agg,
        newCurrent,
        status,
        consecutiveBreachCount,
        historyPoints: newHistory.length,
        ...(hint && { hint }),
      });
      updatedIndicators.push({
        ...ind,
        current: newCurrent,
        status,
        history: newHistory,
        consecutiveBreachCount,
      });
    }
    updatedCategories.push({ ...cat, indicators: updatedIndicators });
  }

  // Create/update alerts when indicator is in breach (Red or Amber)
  const periodStr = (ind) => (ind.resetPeriod === "weekly" ? "weeks" : "months");
  const indicatorById = new Map();
  for (const cat of updatedCategories) {
    for (const ind of cat.indicators || []) {
      indicatorById.set(ind.id, ind);
    }
  }
  // Update existing active alerts: set severity/message to match current indicator status (Red→High, Amber→Medium)
  const newAlerts = (set.alerts || []).map((a) => {
    if (!a.active) return a;
    const ind = indicatorById.get(a.indicatorId);
    if (!ind || (ind.status !== "Red" && ind.status !== "Amber")) return a;
    const periodLabel = periodStr(ind);
    const message = `Target breach: ${ind.name} (current ${ind.current} vs target ${ind.target}) for 1+ ${periodLabel}.`;
    const severity = ind.status === "Red" ? "High" : "Medium";
    return {
      ...a,
      severity,
      message,
      lastDetected: new Date().toISOString().slice(0, 10),
    };
  });
  const activeIndicatorIds = new Set(newAlerts.filter((a) => a.active).map((a) => a.indicatorId));
  const alertsCreated = [];
  for (const cat of updatedCategories) {
    for (const ind of cat.indicators || []) {
      const inBreach = ind.status === "Red" || ind.status === "Amber";
      if (!inBreach || (ind.consecutiveBreachCount ?? 0) < 1) continue;
      if (activeIndicatorIds.has(ind.id)) continue;
      const periodLabel = periodStr(ind);
      const message = `Target breach: ${ind.name} (current ${ind.current} vs target ${ind.target}) for 1+ ${periodLabel}.`;
      const alertId = "alert-" + ind.id + "-" + Date.now();
      const severity = ind.status === "Red" ? "High" : "Medium";
      newAlerts.push({
        id: alertId,
        indicatorId: ind.id,
        severity,
        message,
        firstDetected: new Date().toISOString().slice(0, 10),
        lastDetected: new Date().toISOString().slice(0, 10),
        active: true,
        location: "",
      });
      activeIndicatorIds.add(ind.id);
      alertsCreated.push({ indicatorId: ind.id, indicatorName: ind.name, alertId });
    }
  }
  debug.alertsCreated = alertsCreated;
  debug.alertsCount = newAlerts.length;

  console.log("[recalculate-from-audits]", JSON.stringify(debug, null, 2));
  const updated = await PerformanceSet.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { categories: updatedCategories, alerts: newAlerts },
    { new: true, runValidators: true }
  ).lean();

  if (!updated) return res.status(404).json({ message: "Performance set not found" });
  const body = mapPerformanceSet(updated);
  body._debug = debug;
  res.json(body);
});

function mapPerformanceSet(p) {
  return {
    id: String(p._id),
    locationId: String(p.locationId),
    period: p.period,
    categories: p.categories ?? [],
    alerts: p.alerts ?? [],
    tasks: p.tasks ?? [],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export default router;
