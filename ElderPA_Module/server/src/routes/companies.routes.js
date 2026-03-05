import express from "express";
import mongoose from "mongoose";
import {Company} from "../models/Company.js";
import {Location} from "../models/Location.js";
import {PerformanceTemplate} from "../models/PerformanceTemplate.js";
import {PerformanceSet} from "../models/PerformanceSet.js";

const router = express.Router();
const ROLES = [
  "SystemAdmin",
  "OrgAdmin",
  "RegisteredManager",
  "Supervisor",
  "CareWorker",
  "SeniorCareWorker",
  "Auditor",
];
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



router.get("/", requireAuth, requireRole(admin_ROLES), async (req, res) => {
  const filter = { deletedAt: null };
  // OrgAdmin and RegisteredManager see only their own company; SystemAdmin sees all
  if (req.user.role !== "SystemAdmin") {
    if (!req.user.companyId) {
      return res.json([]);
    }
    filter._id = req.user.companyId;
  }
  const companies = await Company.find(filter).sort({ createdAt: -1 }).lean();
  res.json(companies.map(mapCompany));
});

router.get("/me", requireAuth, async (req, res) => {
  if (!req.user.companyId) return res.status(404).json({ message: "No company assigned" });
  const company = await Company.findOne({ _id: req.user.companyId, deletedAt: null }).lean();
  if (!company) return res.status(404).json({ message: "Company not found" });
  res.json(mapCompany(company));
});

// For OrgAdmin/RegisteredManager: only allow access to their own company
function requireOwnCompanyOrSystemAdmin(req, res, next) {
  if (req.user.role === "SystemAdmin") return next();
  const id = req.params.id;
  if (!id || String(req.user.companyId) !== String(id)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

router.get("/:id", requireAuth, requireRole(admin_ROLES), requireOwnCompanyOrSystemAdmin, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

  const company = await Company.findOne({ _id: id, deletedAt: null }).lean();
  if (!company) return res.status(404).json({ message: "Company not found" });

  res.json(mapCompany(company));
});

function mapCompanyDoc(c) {
  return {
    id: String(c._id),
    name: c.name,
    director: c.director ?? null,
    companyNumber: c.companyNumber ?? null,
    CQC_number: c.CQC_number ?? null,
    address: c.address ?? null,
    registeredIn: c.registeredIn ?? null,
    adminContact: c.adminContact ?? null,
    icon: c.icon ?? null,
    serviceTypes: c.serviceTypes ?? [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

router.post("/", requireAuth, requireRole(admin_ROLES), async (req, res) => {
  const input = req.body ?? {};
  if (!input.name) return res.status(400).json({ message: "name is required" });
  const company = await Company.create({
    name: input.name,
    director: input.director,
    companyNumber: input.companyNumber,
    CQC_number: input.CQC_number,
    address: input.address,
    registeredIn: input.registeredIn,
    adminContact: input.adminContact,
    icon: input.icon,
    serviceTypes: input.serviceTypes ?? [],
    ownerAdminId: req.user.id,
  });
  res.status(201).json(mapCompany(company.toObject()));
});
function normalizeLocationType(v) {
  if (!v) return v;
  if (v === "Care Home") return "CareHome";
  if (v === "Home Care") return "HomeCare";
  return v;
}


function mapLocationDoc(l) {
  return {
    id: String(l._id),
    companyId: String(l.companyId),
    code: l.code ?? null,
    name: l.name,
    type: l.type,
    address: l.address ?? null,
    contactInfo: l.contactInfo ?? null,
    primaryManager: l.primaryManager ?? null,
    areas: l.areas ?? [],
    wings: l.wings ?? [],
    rooms: l.rooms ?? [],
    roomGroups: l.roomGroups ?? [],
    clientGroups: l.clientGroups ?? [],
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}
function getISOWeekYearAndNumber(date = new Date()) {
  // Use UTC to avoid timezone edge cases
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

  // ISO week starts Monday; make Sunday = 7
  const dayNum = d.getUTCDay() || 7;

  // Set date to Thursday of the current ISO week
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));

  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

  return { isoYear, weekNo };
}
function cloneTemplateToSetCategories(templateCategories = []) {
  return templateCategories.map((cat) => ({
    id: cat.id,
    type: cat.type,
    title: cat.title,
    description: cat.description,
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
    })),
  }));
}
function getCurrentWeekPeriod(date = new Date()) {
  const { isoYear, weekNo } = getISOWeekYearAndNumber(date);
  return `${isoYear}-W${String(weekNo).padStart(2, "0")}`;
}
router.put("/:id", requireAuth, requireRole(admin_ROLES), requireOwnCompanyOrSystemAdmin, async (req, res) => {
  const { id } = req.params;
  const payload = req.body ?? {};
  //console.log("here");

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid company id" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const company = await Company.findById(id).session(session);
    if (!company) throw new Error("Company not found");

    /* ----------------------------
     * 1. Update company fields
     * ---------------------------- */
    company.name = payload.name ?? company.name;
    company.director = payload.director ?? company.director;
    company.address = payload.address ?? company.address;
    //console.log("here2");
    const serviceTypesInput = Array.isArray(payload.serviceTypes)
      ? payload.serviceTypes
      : [];

    company.serviceTypes = serviceTypesInput
      .map(st => st?.name)
      .filter(Boolean);
    await company.save({ session });
    //console.log("here3");
    /* ----------------------------
     * 2. Handle locations
     * ---------------------------- */
    const allLocations = serviceTypesInput.flatMap(st =>
      Array.isArray(st.locations) ? st.locations : []
    );
    //console.log("here4  ",allLocations);
    for (const locInput of allLocations) {
      if (!locInput?.name) continue;
     // console.log("here5  ",locInput);
      const normalizedType = normalizeLocationType(locInput.type);
      //console.log("here6  ",locInput);
      if (!["CareHome", "HomeCare"].includes(normalizedType)) {
        throw new Error(`Invalid location type: ${locInput.type}`);
      }

      // UPSERT by (companyId + name)
      let location = await Location.findOne({
        companyId: company._id,
        name: locInput.name,
      }).session(session);
      //console.log("here7  ",company._id);
      if (!location) {
        location = new Location({
          companyId: company._id,
          name: locInput.name,
          type: normalizedType,
        });
      } else {
        location.type = normalizedType;
      }
     // console.log("here8  ",location);
      await location.save({ session });
      //console.log("here9  ");
      /* PerformanceSet logic (same as POST) */
      if (!location.currentPerformanceSetId) {
        const template = await PerformanceTemplate.findOne({
          isActive: true,
          locationType: normalizedType,
        }).sort({ updatedAt: -1 });
        //console.log("here10  ",template);
        if (!template) {
          throw new Error(`No active PerformanceTemplate for ${normalizedType}`);
        }

        const period = getCurrentWeekPeriod();
        const [set] = await PerformanceSet.create(
          [{
            locationId: location._id,
            templateId: template._id,
            period,
            categories: cloneTemplateToSetCategories(template.categories),
            alerts: [],
            tasks: [],
          }],
          { session }
        );

        location.currentPerformanceSetId = set._id;
        await location.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.json({
      company: mapCompanyDoc(company.toObject())
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ message: err?.message ?? "Update failed" });
  }
});

router.delete("/:id", requireAuth, requireRole(admin_ROLES), requireOwnCompanyOrSystemAdmin, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });
  const company = await Company.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { deletedAt: new Date(), deletedBy: req.user.id },
    { new: true }
  ).lean();
  if (!company) return res.status(404).json({ message: "Company not found" });
  res.json({ ok: true });
});

function mapCompany(c) {
  return {
    id: String(c._id),
    name: c.name,
    director: c.director ?? null,
    companyNumber: c.companyNumber ?? null,
    CQC_number: c.CQC_number ?? null,
    address: c.address ?? null,
    registeredIn: c.registeredIn ?? null,
    adminContact: c.adminContact ?? null,
    icon: c.icon ?? null,
    serviceTypes: c.serviceTypes ?? [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export default router;
