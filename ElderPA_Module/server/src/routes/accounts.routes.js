import express from "express";
import mongoose from "mongoose";
import { Account } from "../models/Account.js";

const router = express.Router();
const admin_ROLES = ["SystemAdmin", "OrgAdmin", "RegisteredManager"];

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

/** GET /api/accounts?companyId=... - list accounts for a company (id, name, role). */
router.get("/", requireAuth, requireRole(admin_ROLES), async (req, res) => {
  const { companyId } = req.query;
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ message: "companyId is required" });
  }
  if (!mongoose.isValidObjectId(companyId)) {
    return res.status(400).json({ message: "Invalid companyId" });
  }
  if (req.user.role !== "SystemAdmin" && String(req.user.companyId) !== String(companyId)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const accounts = await Account.find({ companyId }).select("_id name role").lean();
  res.json(
    accounts.map((a) => ({
      id: String(a._id),
      name: a.name ?? "",
      role: a.role ?? "",
    }))
  );
});

export default router;
