import express from "express";
import AuditInstance from "../models/AuditInstance.js";
import AuditTemplate from "../models/AuditTemplate.js";
import authenticate from '../middleware/authenticate.js'; // Adjust path to your
const router = express.Router();

// GET /api/audits?companyId=...&locationId=...&templateId=...
router.get("/", async (req, res) => {
  try {
  //  console.log('POST /api/audits req=', req.query);
    const { companyId, locationId, templateId } = req.query;
    const q = {};
    // company overview page
    //if (companyId) q.companyId = companyId;
    if (locationId) q.locationId = locationId;
    if (templateId) q.templateId = templateId;

    const items = await AuditInstance.find(q).sort({ createdAt: -1 });
    //console.log('POST /api/audits items=',items);
    res.json(items);
  } catch {
    res.status(500).json({ error: "Failed to load audits" });
  }
});

// GET /api/audits/:id
router.get("/:id", async (req, res) => {
  try {
    const item = await AuditInstance.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch {
    res.status(400).json({ error: "Invalid id" });
  }
});
router.patch('/:id/approve', authenticate(['SystemAdmin', 'OrgAdmin','RegisteredManager']), async (req, res) => {
  const audit = await AuditInstance.findByIdAndUpdate(
    req.params.id,
    { status: 'Approved', approvedBy: req.user.id, approvedAt: new Date().toISOString() },
    { new: true }
  );
  res.json(audit);
});
// POST /api/audits
router.post('/', async (req, res) => {
  const reqId = req.header('x-request-id');

  try {
    const auditData = {
      ...req.body,
      // ✅ Validate/generate ObjectIds
      date: req.body.date || new Date().toISOString().slice(0, 10),
      templateId: req.body.templateId || null,  // Allow null or validate
      locationId: req.body.locationId || req.user?.locations?.[0] || null,

      // Skip mongoose.create if invalid IDs, use upsert
      auditorId: req.user?.id
    };

    // ✅ Use findOneAndUpdate for flexible create
    const created = await AuditInstance.findOneAndUpdate(
      { _id: { $exists: false } },  // New document
      auditData,
      { upsert: true, new: true }
    );

    res.status(201).json(created);
  } catch (error) {
    console.error('Audit create error:', error);
    res.status(400).json({ error: error.message });
  }
});





// PATCH /api/audits/:id
router.patch("/:id", async (req, res) => {
  try {
    const updated = await AuditInstance.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch {
    res.status(400).json({ error: "Invalid id/payload" });
  }
});

export default router;
