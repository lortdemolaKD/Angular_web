import express from "express";
import AuditTemplate from "../models/AuditTemplate.js";

const router = express.Router();

// GET /api/auditTemplates?companyId=...
router.get("/", async (req, res) => {
  try {
    //console.log('GET /api/auditTemplates req=', req.query);
    const { companyId, type } = req.query;
    const q = {};
    const items = await AuditTemplate.find(q).sort({ createdAt: -1 }).lean();
    //console.log('GET /api/auditTemplates items=', items);
    res.json(items.map(t => ({
      ...t,
      id: String(t._id)
    })));
  } catch (e) {
    res.status(500).json({ error: "Failed to load templates" });
  }
});

// GET /api/auditTemplates/:id
router.get("/:id", async (req, res) => {
  try {
    const item = await AuditTemplate.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch {
    res.status(400).json({ error: "Invalid id" });
  }
});

// POST /api/auditTemplates
router.post("/", async (req, res) => {
  try {
    const created = await AuditTemplate.create(req.body);
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ error: "Invalid payload" });
  }
});

// PATCH /api/auditTemplates/:id
router.patch("/:id", async (req, res) => {
  try {
    const updated = await AuditTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch {
    res.status(400).json({ error: "Invalid id/payload" });
  }
});

export default router;
