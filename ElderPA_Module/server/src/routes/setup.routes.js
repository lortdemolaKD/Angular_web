import express from "express";
import mongoose from "mongoose";

import { Company } from "../models/Company.js";
import { Location } from "../models/Location.js";
import { Account } from "../models/Account.js";
import {PerformanceTemplate} from "../models/PerformanceTemplate.js";
import {PerformanceSet} from "../models/PerformanceSet.js"; // or User/Account model, adjust name/path

const router = express.Router();

/* ---------- auth helpers (same style as earlier) ---------- */
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  next();
}

function requireAdmin(req, res, next) {
  const allowedRoles = ['SystemAdmin', 'OrgAdmin'];  // Your roles!
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Admin role required' });
  }
  next();
}

/* ---------- helpers ---------- */
function normalizeLocationType(v) {
  if (!v) return v;
  if (v === "Care Home") return "CareHome";
  if (v === "Home Care") return "HomeCare";
  if (v === "LiveInCare" || v === "Live-in Care") return "HomeCare";
  if (v === "AssistedLiving" || v === "Assisted Living") return "CareHome";
  return v; // allow already-normalized CareHome | HomeCare
}

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

/* ---------- POST /api/setup/company ---------- */
/**
 * Accepts payload from FormTests:
 * { name, companies: [{ name, serviceTypes: [{ name, locations: [...] }]}] }
 * and creates exactly ONE company (first companies[0]) + all nested locations.
 */
router.post("/company", requireAuth, requireAdmin, async (req, res) => {
  const payload = req.body ?? {};
  const companies = Array.isArray(payload.companies) ? payload.companies : [];

  if (!companies.length) {
    return res.status(400).json({ message: "Payload must include companies[0]." });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const createdCompanies = [];
    const createdLocations = [];

    for (const companyInput of companies) {
      if (!companyInput?.name) {
        throw new Error("Each company must have a name.");
      }

      const serviceTypes = Array.isArray(companyInput.serviceTypes)
        ? companyInput.serviceTypes
        : [];

      const allLocations = serviceTypes.flatMap((st) =>
        Array.isArray(st.locations) ? st.locations : []
      );

      const companyServiceTypes = serviceTypes
        .map((st) => st?.name)
        .filter(Boolean);

      // 1) Create company
      const company = await Company.create(
        [
          {
            name: companyInput.name,
            serviceTypes: companyServiceTypes,
            ownerAdminId: req.user.id,
          },
        ],
        { session }
      );
      const companyDoc = company[0];
      createdCompanies.push(companyDoc);

      // 2) Create locations (+ performance sets)
      for (const locInput of allLocations) {
        if (!locInput?.name) continue;

        const normalizedType = normalizeLocationType(locInput.type);
        if (!["CareHome", "HomeCare"].includes(normalizedType)) {
          throw new Error(`Invalid location type: ${locInput.type}`);
        }

        const locationDocArr = await Location.create(
          [
            {
              companyId: companyDoc._id,
              name: locInput.name,
              type: normalizedType,

              areas: Array.isArray(locInput.areas) ? locInput.areas : [],
              wings: Array.isArray(locInput.wings) ? locInput.wings : [],
              rooms: Array.isArray(locInput.rooms) ? locInput.rooms : [],
              roomGroups: Array.isArray(locInput.roomGroups) ? locInput.roomGroups : [],
              clientGroups: Array.isArray(locInput.clientGroups) ? locInput.clientGroups : [],

              address: locInput.address,
              contactInfo: locInput.contactInfo,
              primaryManager: locInput.primaryManager,
            },
          ],
          { session }
        );
        const locationDoc = locationDocArr[0];

        let template = await PerformanceTemplate.findOne({
          isActive: true,
          locationType: normalizedType,
        })
          .sort({ updatedAt: -1 });

        if (!template) {
          template = await PerformanceTemplate.findOne({
            isActive: true,
            locationType: "Both",
          }).sort({ updatedAt: -1 });
        }

        if (!template) {
          throw new Error(`No active PerformanceTemplate for type ${normalizedType} (seed templates if needed)`);
        }

        const period = getCurrentWeekPeriod();

        const setArr = await PerformanceSet.create(
          [
            {
              locationId: locationDoc._id,
              templateId: template._id,
              period,
              categories: cloneTemplateToSetCategories(template.categories),
              alerts: [],
              tasks: [],
            },
          ],
          { session }
        );
        const set = setArr[0];

        await Location.updateOne(
          { _id: locationDoc._id },
          { $set: { currentPerformanceSetId: set._id } },
          { session }
        );

        createdLocations.push(locationDoc);
      }

      // 3) Attach company to this admin user
      await Account.updateOne(
        { _id: req.user.id },
        { $addToSet: { companyIds: companyDoc._id } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      companies: createdCompanies.map((c) => mapCompanyDoc(c.toObject())),
      locations: createdLocations.map((l) => mapLocationDoc(l.toObject())),
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    return res.status(400).json({
      message: err?.message ?? "Setup failed",
    });
  }
});

export default router;
