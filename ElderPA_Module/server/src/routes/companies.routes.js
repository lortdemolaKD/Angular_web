import express from "express";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import {Company} from "../models/Company.js";
import {Location} from "../models/Location.js";
import {PerformanceTemplate} from "../models/PerformanceTemplate.js";
import {PerformanceSet} from "../models/PerformanceSet.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_COMPANY_BANNERS = path.join(__dirname, "..", "uploads", "company-banners");
try {
  fs.mkdirSync(UPLOADS_COMPANY_BANNERS, { recursive: true });
} catch (e) {
  // ignore
}
const bannerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_COMPANY_BANNERS),
  filename: (req, file, cb) => {
    const ext = (file.originalname && path.extname(file.originalname)) || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext.toLowerCase()) ? ext : ".jpg";
    const name = `${req.params.id}-${Date.now()}${safeExt}`;
    cb(null, name);
  },
});
const uploadCompanyBanner = multer({
  storage: bannerStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Only images are allowed"));
  },
});

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

/** Upload / replace company banner image (OrgAdmin, RegisteredManager, SystemAdmin for own company). */
router.post(
  "/:id/banner",
  requireAuth,
  requireRole(admin_ROLES),
  requireOwnCompanyOrSystemAdmin,
  uploadCompanyBanner.single("banner"),
  async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const company = await Company.findOne({ _id: id, deletedAt: null });
    if (!company) return res.status(404).json({ message: "Company not found" });

    if (company.bannerUrl) deleteBannerFileIfLocal(company.bannerUrl);

    const relativePath = "/uploads/company-banners/" + req.file.filename;
    company.bannerUrl = relativePath;
    await company.save();

    res.json({ bannerUrl: relativePath });
  }
);

/** Remove company banner */
router.delete(
  "/:id/banner",
  requireAuth,
  requireRole(admin_ROLES),
  requireOwnCompanyOrSystemAdmin,
  async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const company = await Company.findOne({ _id: id, deletedAt: null });
    if (!company) return res.status(404).json({ message: "Company not found" });

    if (company.bannerUrl) deleteBannerFileIfLocal(company.bannerUrl);
    company.bannerUrl = null;
    await company.save();

    res.json({ bannerUrl: null });
  }
);

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
    bannerUrl: c.bannerUrl ?? null,
    serviceTypes: c.serviceTypes ?? [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function deleteBannerFileIfLocal(relativeUrl) {
  if (!relativeUrl || typeof relativeUrl !== "string") return;
  if (!relativeUrl.startsWith("/uploads/company-banners/")) return;
  const base = path.join(__dirname, "..");
  const full = path.join(base, relativeUrl.replace(/^\//, ""));
  fs.unlink(full, () => {});
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
  // Wizard service types; Location model only stores CareHome | HomeCare
  if (v === "LiveInCare" || v === "Live-in Care") return "HomeCare";
  if (v === "AssistedLiving" || v === "Assisted Living") return "CareHome";
  return v;
}

/** Non-empty code so the old { companyId, code: null } unique index does not block multiple locations. */
function ensureLocationCode(companyId, locInput, existing) {
  const existingTrim = existing?.code && String(existing.code).trim();
  if (existingTrim) return existingTrim;
  const fromCqc = locInput.cqcLocationId && String(locInput.cqcLocationId).trim();
  const rawName = locInput.name && String(locInput.name).trim();
  const fromName = rawName
    ? rawName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 40)
    : "";
  const base = fromCqc || fromName || "location";
  return `${base}-${String(companyId).slice(-6)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid company id" });
  }

  try {
    const company = await Company.findById(id);
    if (!company) throw new Error("Company not found");

    /* ----------------------------
     * 1. Update company fields
     * ---------------------------- */
    if (payload.name !== undefined && String(payload.name).trim() !== "") {
      company.name = String(payload.name).trim();
    }
    company.director = payload.director ?? company.director;
    company.address = payload.address ?? company.address;
    if (payload.registrationNumber !== undefined) {
      company.companyNumber = payload.registrationNumber || company.companyNumber;
    }
    if (payload.cqcProviderId !== undefined) {
      company.CQC_number = payload.cqcProviderId || company.CQC_number;
    }
    if (payload.registeredIn !== undefined) {
      const ri = payload.registeredIn;
      company.registeredIn = ["England", "Wales", "Scotland"].includes(ri) ? ri : undefined;
    }
    if (payload.adminContact !== undefined) company.adminContact = payload.adminContact;
    if (payload.icon !== undefined) company.icon = payload.icon;
    if (payload.bannerUrl !== undefined) {
      if (payload.bannerUrl === null || payload.bannerUrl === "") {
        if (company.bannerUrl) deleteBannerFileIfLocal(company.bannerUrl);
        company.bannerUrl = null;
      } else {
        company.bannerUrl = payload.bannerUrl;
      }
    }
    const serviceTypesInput = Array.isArray(payload.serviceTypes)
      ? payload.serviceTypes
      : [];

    company.serviceTypes = serviceTypesInput
      .map((st) => st?.name)
      .filter(Boolean);
    await company.save();

    /* ----------------------------
     * 2. Handle locations (no Mongo transaction — standalone DBs do not support multi-doc transactions)
     * ---------------------------- */
    const allLocations = serviceTypesInput.flatMap((st) => {
      const serviceTypeName = st?.name ?? st?.type;
      const locs = Array.isArray(st.locations) ? st.locations : [];
      return locs.map((loc) => ({
        ...loc,
        type: loc?.type ?? serviceTypeName,
      }));
    });

    for (const locInput of allLocations) {
      if (!locInput?.name) continue;
      const normalizedType = normalizeLocationType(locInput.type);
      if (!["CareHome", "HomeCare"].includes(normalizedType)) {
        throw new Error(`Invalid location type: ${locInput.type}`);
      }

      let location = await Location.findOne({
        companyId: company._id,
        name: locInput.name,
      });
      if (!location) {
        location = new Location({
          companyId: company._id,
          name: locInput.name,
          type: normalizedType,
          code: ensureLocationCode(company._id, locInput, null),
        });
      } else {
        location.type = normalizedType;
        if (!location.code || !String(location.code).trim()) {
          location.code = ensureLocationCode(company._id, locInput, location);
        }
      }
      await location.save();

      if (!location.currentPerformanceSetId) {
        let template = await PerformanceTemplate.findOne({
          isActive: true,
          locationType: normalizedType,
        }).sort({ updatedAt: -1 });
        if (!template) {
          template = await PerformanceTemplate.findOne({
            isActive: true,
            locationType: "Both",
          }).sort({ updatedAt: -1 });
        }
        if (!template) {
          throw new Error(`No active PerformanceTemplate for ${normalizedType} (seed templates if needed)`);
        }

        const period = getCurrentWeekPeriod();
        let set;
        try {
          const created = await PerformanceSet.create([
            {
              locationId: location._id,
              templateId: String(template._id),
              period,
              categories: cloneTemplateToSetCategories(template.categories),
              alerts: [],
              tasks: [],
            },
          ]);
          set = created[0];
        } catch (createErr) {
          if (createErr?.code === 11000) {
            const existing = await PerformanceSet.findOne({
              locationId: location._id,
              period,
            });
            if (!existing) throw createErr;
            set = existing;
          } else {
            throw createErr;
          }
        }

        location.currentPerformanceSetId = set._id;
        await location.save();
      }
    }

    res.json({
      company: mapCompanyDoc(company.toObject()),
    });
  } catch (err) {
    let message = err?.message ?? "Update failed";
    if (err?.name === "ValidationError" && err?.errors) {
      message = Object.values(err.errors)
        .map((e) => e.message)
        .join(" ");
    }
    if (err?.code === 11000) {
      message = err?.message || "Duplicate key on performance set.";
    }
    res.status(400).json({ message });
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
    bannerUrl: c.bannerUrl ?? null,
    serviceTypes: c.serviceTypes ?? [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export default router;
