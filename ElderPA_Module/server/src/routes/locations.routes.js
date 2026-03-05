import express from "express";
import mongoose from "mongoose";
import { Location } from "../models/Location.js";
import { Account } from "../models/Account.js";

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

// ADMIN/MANAGER list locations (optionally filter by companyId, own only)
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const companyId = req.query.companyId;

  const filter = { deletedAt: null };
  if (companyId) {
    if (!mongoose.isValidObjectId(companyId)) return res.status(400).json({ message: "Invalid companyId" });
    // Ownership check: only own company
    if (String(req.user.companyId) !== String(companyId)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    filter.companyId = companyId;
  }

  const locations = await Location.find(filter).sort({ createdAt: -1 }).lean();

  res.json(locations.map(mapLocation));
});

// Non-admin: return only the location assigned to the current user (for CareWorker, Auditor, etc.)
router.get("/me", requireAuth, async (req, res) => {
  let locationId = req.user?.locationId;
  if (!locationId && req.user?.id) {
    const account = await Account.findById(req.user.id).select("locationId").lean();
    locationId = account?.locationId;
  }
  if (!locationId || !mongoose.isValidObjectId(locationId)) {
    return res.json([]);
  }
  const loc = await Location.findOne({ _id: locationId, deletedAt: null }).lean();
  if (!loc) return res.json([]);
  res.json([mapLocation(loc)]);
});

router.get("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });
  const loc = await Location.findOne({ _id: id, deletedAt: null }).lean();
  if (!loc) return res.status(404).json({ message: "Location not found" });
  res.json(mapLocation(loc));
});

// MANAGER list only own locations
router.get("/my", requireAuth, async (req, res) => {
  const managerId = String(req.user.id);
  const locations = await Location.find({
    deletedAt: null,
    "staff.id": managerId,
    "staff.role": "Managers",  // Adjust if needed
  }).sort({ createdAt: -1 }).lean();
  res.json(locations.map(mapLocation));
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const input = req.body ?? {};
  if (!input.companyId) return res.status(400).json({ message: "companyId is required" });
  if (!mongoose.isValidObjectId(input.companyId)) return res.status(400).json({ message: "Invalid companyId" });
  if (!input.name) return res.status(400).json({ message: "name is required" });
  if (!input.type) return res.status(400).json({ message: "type is required" });
  const loc = await Location.create({
    companyId: input.companyId,
    code: input.code,
    name: input.name,
    type: input.type,  // CareHome, HomeCare
    icon: input.icon,
    address: input.address,
    contactInfo: input.contactInfo,
    primaryManager: input.primaryManager,
    staff: input.staff ?? [],
    departments: input.departments ?? [],
    stats: input.stats ?? null,
    homeCareMetrics: input.type === "HomeCare" ? input.homeCareMetrics ?? null : null,
    areas: input.areas ?? [],
    wings: input.wings ?? [],
  });
  res.status(201).json(mapLocation(loc.toObject()));
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });
  const update = req.body ?? {};
  delete update.deletedAt;
  delete update.deletedBy;
  const loc = await Location.findOneAndUpdate(
    { _id: id, deletedAt: null },
    update,
    { new: true, runValidators: true }
  ).lean();
  if (!loc) return res.status(404).json({ message: "Location not found" });
  res.json(mapLocation(loc));
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });
  const loc = await Location.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { deletedAt: new Date(), deletedBy: req.user.id },
    { new: true }
  ).lean();
  if (!loc) return res.status(404).json({ message: "Location not found" });
  res.json({ ok: true });
});

function mapLocation(l) {
  return {
    id: String(l._id),
    companyId: String(l.companyId),
    code: l.code ?? null,
    name: l.name,
    type: l.type,
    icon: l.icon ?? null,
    address: l.address ?? null,
    contactInfo: l.contactInfo ?? null,
    primaryManager: l.primaryManager ?? null,
    staff: l.staff ?? [],
    departments: l.departments ?? [],
    stats: l.stats ?? null,
    homeCareMetrics: l.homeCareMetrics ?? null,
    areas: l.areas ?? [],
    wings: l.wings ?? [],
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}

export default router;
