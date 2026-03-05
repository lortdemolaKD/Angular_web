import express from "express";
import mongoose from "mongoose";
import { PerformanceTemplate } from "../models/PerformanceTemplate.js";

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  next();
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== "Admins") return res.status(403).json({ message: "Forbidden" });
  next();
}

// LIST
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const rows = await PerformanceTemplate.find({ deletedAt: null }).sort({ createdAt: -1 }).lean();
  res.json(rows.map(mapTemplate));
});

// GET ONE
router.get("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

  const row = await PerformanceTemplate.findOne({ _id: id, deletedAt: null }).lean();
  if (!row) return res.status(404).json({ message: "Template not found" });

  res.json(mapTemplate(row));
});

// CREATE
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const input = req.body ?? {};
  if (!input.locationType) return res.status(400).json({ message: "locationType is required" });

  const row = await PerformanceTemplate.create({
    locationType: input.locationType,   // CareHome | HomeCare | Both
    categories: input.categories ?? [],
  });

  res.status(201).json(mapTemplate(row.toObject()));
});

// UPDATE (PUT/PATCH can share same logic if you want)
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

  const update = req.body ?? {};
  delete update.deletedAt;
  delete update.deletedBy;

  const row = await PerformanceTemplate.findOneAndUpdate(
    { _id: id, deletedAt: null },
    update,
    { new: true, runValidators: true } // ensures schema validation runs on update [web:188]
  ).lean();

  if (!row) return res.status(404).json({ message: "Template not found" });
  res.json(mapTemplate(row));
});

router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

  const update = req.body ?? {};
  delete update.deletedAt;
  delete update.deletedBy;

  const row = await PerformanceTemplate.findOneAndUpdate(
    { _id: id, deletedAt: null },
    update,
    { new: true, runValidators: true } // validates patch too [web:188]
  ).lean();

  if (!row) return res.status(404).json({ message: "Template not found" });
  res.json(mapTemplate(row));
});

// SOFT DELETE
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

  const row = await PerformanceTemplate.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { deletedAt: new Date(), deletedBy: req.user.id },
    { new: true }
  ).lean();

  if (!row) return res.status(404).json({ message: "Template not found" });

  res.status(200).json({ ok: true }); // 204 is also fine [web:177]
});

function mapTemplate(t) {
  return {
    id: String(t._id),
    locationType: t.locationType,
    categories: t.categories ?? [],
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export default router;
