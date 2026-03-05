import express from "express";
import mongoose from "mongoose";
import CustomAuditTemplate from "../models/CustomAuditTemplate.js";
import { Account } from "../models/Account.js";

const router = express.Router();

const ADMIN_ROLES = ["SystemAdmin", "OrgAdmin", "RegisteredManager"];

/**
 * GET /api/customAuditTemplates
 * Query params:
 *   - organizationId: Filter by organization
 *   - locationId: Filter by location
 *   - type: Filter by template type
 *   - status: Filter by status
 *   - createdBy: Filter by creator
 * For non-admin users: always scope by their assigned location (req.user.locationId).
 */
router.get("/", async (req, res) => {
  try {
    const { organizationId, locationId: locationIdQuery, type, status, createdBy } = req.query;

    let locationId = locationIdQuery;
    if (req.user && !ADMIN_ROLES.includes(req.user.role)) {
      // Non-admin: only show templates for their assigned location (or global)
      let assignedLocId = req.user.locationId;
      if (!assignedLocId && req.user.id) {
        const account = await Account.findById(req.user.id).select("locationId").lean();
        assignedLocId = account?.locationId;
      }
      locationId = assignedLocId ? String(assignedLocId) : null;
    }

    const query = {
      ...(type && { type }),
      ...(status && { status }),
    };

    // When filtering by locationId: return templates for that location OR global templates (locationId null)
    if (locationId && mongoose.isValidObjectId(locationId)) {
      query.$or = [
        { locationId: new mongoose.Types.ObjectId(locationId) },
        { locationId: null },
      ];
    }

   // console.log('GET /api/customAuditTemplates query=',query);
    const items = await CustomAuditTemplate.find(query)
      .sort({ 'metadata.createdAt': -1 })
      .lean();
    //console.log('GET /api/customAuditTemplates items=',items);
    // Map _id to id for frontend compatibility
    res.json(items.map(t => ({
      ...t,
      id: String(t._id)
    })));
  } catch (e) {
    //console.error("Failed to load custom templates:", e);
    res.status(500).json({ error: "Failed to load custom templates" });
  }
});

/**
 * GET /api/customAuditTemplates/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const item = await CustomAuditTemplate.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ error: "Template not found" });

    res.json({
      ...item,
      id: String(item._id)
    });
  } catch (e) {
    console.error("Failed to get template:", e);
    res.status(400).json({ error: "Invalid template ID" });
  }
});

/**
 * POST /api/customAuditTemplates
 * Create new custom template
 */
router.post("/", async (req, res) => {
  try {
    const payload = req.body;

    console.log('Raw payload:', JSON.stringify(payload, null, 2));

    // ✅ Remove invalid ObjectIds BEFORE create
    ['locationId', 'organizationId', 'parentTemplateId'].forEach(field => {
      if (!payload[field] || payload[field] === '' || payload[field] === 'null') {
        delete payload[field];
      }
    });

    console.log('Cleaned payload:', payload);

    const created = await CustomAuditTemplate.create(payload);

    res.status(201).json({
      ...created.toObject(),
      id: String(created._id)
    });
  } catch (e) {
    console.error("Failed to create template:", e);
    res.status(400).json({ error: e.message });
  }
});


// ✅ Helper function
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}


/**
 * PATCH /api/customAuditTemplates/:id
 * Update existing template
 */
router.patch("/:id", async (req, res) => {
  try {
    // Update modified timestamp
    if (!req.body.metadata) {
      req.body.metadata = {};
    }
    req.body.metadata.modifiedAt = new Date();

    const updated = await CustomAuditTemplate.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json({
      ...updated.toObject(),
      id: String(updated._id)
    });
  } catch (e) {
    console.error("Failed to update template:", e);
    res.status(400).json({
      error: "Invalid update data",
      details: e.message
    });
  }
});

/**
 * DELETE /api/customAuditTemplates/:id
 * Soft delete (set status to archived)
 */
router.delete("/:id", async (req, res) => {
  try {
    console.log('DELETE /api/customAuditTemplates/:id', req.params.id);

    const deleted = await CustomAuditTemplate.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        error: "Template not found",
        id: req.params.id
      });
    }

    // Optional: Delete related data (responses, etc.)
    // await AuditResponse.deleteMany({ templateId: req.params.id });

    res.json({
      message: "Template deleted permanently",
      id: deleted._id,
      name: deleted.name  // Confirm what was deleted
    });
  } catch (error) {
    console.error("Failed to delete template:", error);
    res.status(400).json({
      error: "Failed to delete template",
      details: error.message
    });
  }
});

/**
 * POST /api/customAuditTemplates/:id/clone
 * Clone an existing template
 */
router.post("/:id/clone", async (req, res) => {
  try {
    const original = await CustomAuditTemplate.findById(req.params.id).lean();
    if (!original) {
      return res.status(404).json({ error: "Template not found" });
    }

    const { newName, newOrganizationId, newLocationId } = req.body;

    // Create clone
    const clone = {
      ...original,
      _id: undefined, // Remove original ID
      name: newName || `${original.name} (Copy)`,
      organizationId: newOrganizationId || original.organizationId,
      locationId: newLocationId || original.locationId,
      parentTemplateId: original._id,
      status: 'draft',
      metadata: {
        ...original.metadata,
        createdAt: new Date(),
        modifiedAt: new Date(),
        version: 1,
        usageCount: 0
      }
    };

    const created = await CustomAuditTemplate.create(clone);

    res.status(201).json({
      ...created.toObject(),
      id: String(created._id)
    });
  } catch (e) {
    console.error("Failed to clone template:", e);
    res.status(400).json({
      error: "Failed to clone template",
      details: e.message
    });
  }
});

/**
 * POST /api/customAuditTemplates/:id/publish
 * Publish a template (change status from draft to active)
 */
router.post("/:id/publish", async (req, res) => {
  try {
    const updated = await CustomAuditTemplate.findByIdAndUpdate(
      req.params.id,
      {
        status: 'active',
        'metadata.isPublished': true,
        'metadata.publishedAt': new Date(),
        'metadata.publishedBy': req.body.publishedBy
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json({
      ...updated.toObject(),
      id: String(updated._id)
    });
  } catch (e) {
    console.error("Failed to publish template:", e);
    res.status(400).json({ error: "Failed to publish template" });
  }
});

export default router;
