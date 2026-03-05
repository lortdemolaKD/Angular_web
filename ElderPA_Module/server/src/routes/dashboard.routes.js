// src/routes/dashboard.routes.js
import express from "express";
import mongoose from "mongoose";

const router = express.Router();

/* ---------- auth helper (same style as setup.routes.js) ---------- */
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  next();
}

/* ---------- schemas ---------- */
const WidgetSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    label: { type: String, default: "" },
    contentKey: { type: String, required: true },

    rows: { type: Number, default: 1 },
    cols: { type: Number, default: 1 },
    minCols: { type: Number },
    maxCols: { type: Number },
    minRows: { type: Number },
    maxRows: { type: Number },

    backgroundColor: { type: String },
    color: { type: String },

    metricType: { type: String },
    locationId: { type: String },

    // IMPORTANT: mark auto-generated widgets so they can be removed on toggle-off
    isAuto: { type: Boolean, default: false },
  },
  { _id: false }
);

const DashboardSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },

    // dashboard layout
    widgets: { type: [WidgetSchema], default: [] },

    // monitored locations (replaces localStorage "Monitored locations")
    monitoredLocationIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

const Dashboard =
  mongoose.models.Dashboard || mongoose.model("Dashboard", DashboardSchema);

/* ---------- helpers ---------- */
function getUserId(req) {
  // depends on how your auth middleware populates req.user; setup.routes.js expects req.user exists
  return req.user?.id ?? req.user?.sub;
}

function stripWidgetContent(widgets) {
  // never store Angular component refs (DashboardService deletes content before localStorage save) [file:414]
  return widgets.map((w) => {
    if (!w || typeof w !== "object") return w;
    const copy = { ...w };
    delete copy.content;
    return copy;
  });
}

/* ---------- GET /api/dashboard/me ---------- */
router.get("/me", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const doc = await Dashboard.findOne({ userId }).lean();

  return res.json({
    widgets: doc?.widgets ?? [],
    monitoredLocationIds: doc?.monitoredLocationIds ?? [],
  });
});

/* ---------- PUT /api/dashboard/me (save dashboard widgets) ---------- */
router.put("/me", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const widgets = Array.isArray(req.body?.widgets) ? req.body.widgets : [];
  const cleaned = stripWidgetContent(widgets);

  const updated = await Dashboard.findOneAndUpdate(
    { userId },
    { $set: { widgets: cleaned } },
    { upsert: true, new: true, runValidators: true }
  ).lean();

  return res.json({
    widgets: updated.widgets ?? [],
    monitoredLocationIds: updated.monitoredLocationIds ?? [],
  });
});

/* ---------- PUT /api/dashboard/me/monitored-locations ---------- */
/**
 * Body:
 * {
 *   monitoredLocationIds: string[],
 *   removedLocationId?: string   // if provided, remove auto widgets for that location
 * }
 */
router.put("/me/monitored-locations", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const monitoredLocationIds = Array.isArray(req.body?.monitoredLocationIds)
    ? req.body.monitoredLocationIds
    : [];

  const removedLocationId =
    typeof req.body?.removedLocationId === "string" ? req.body.removedLocationId : null;

  // update list first
  let doc = await Dashboard.findOneAndUpdate(
    { userId },
    { $set: { monitoredLocationIds } },
    { upsert: true, new: true }
  ).lean();

  // only remove widgets on toggle OFF
  if (removedLocationId) {
    const nextWidgets = (doc.widgets ?? []).filter(
      (w) => !(w?.isAuto === true && w?.locationId === removedLocationId)
    );

    doc = await Dashboard.findOneAndUpdate(
      { userId },
      { $set: { widgets: nextWidgets } },
      { new: true }
    ).lean();
  }

  return res.json({
    widgets: doc.widgets ?? [],
    monitoredLocationIds: doc.monitoredLocationIds ?? [],
  });
});

export default router;
