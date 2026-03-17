import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "fs";
import { Account } from "./models/Account.js";
import { Company } from "./models/Company.js";
import crypto from "crypto";
import { Invitation } from "./models/Invitation.js";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";

export const authRouter = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_AVATARS = path.join(__dirname, "..", "uploads", "avatars");
try {
  fs.mkdirSync(UPLOADS_AVATARS, { recursive: true });
} catch (e) {
  // ignore
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_AVATARS),
  filename: (req, file, cb) => {
    const ext = (file.originalname && path.extname(file.originalname)) || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext.toLowerCase()) ? ext : ".jpg";
    const name = `${req.user.id}-${Date.now()}${safeExt}`;
    cb(null, name);
  },
});
const uploadAvatar = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Only images are allowed"));
  },
});

const ROLES = [
  "SystemAdmin",
  "OrgAdmin",
  "RegisteredManager",
  "Supervisor",
  "CareWorker",
  "SeniorCareWorker",
  "Auditor",
];

const INVITE_CREATORS = ["SystemAdmin", "OrgAdmin", "RegisteredManager"];

// Require location scoping for frontline roles (adjust if you want Auditor to be location-scoped too)
const LOCATION_REQUIRED_FOR = ["Supervisor", "CareWorker", "SeniorCareWorker","Auditor"];

function signToken(account) {
  return jwt.sign(
    {
      sub: account._id.toString(),
      role: account.role,
      companyId: account.companyId?.toString() ?? null,
      locationId: account.locationId?.toString() ?? null,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

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

// --- Nodemailer Setup ---
let transporter;
const __filenameAuth = fileURLToPath(import.meta.url);
const __dirnameAuth = path.dirname(__filenameAuth);

(function initEmail() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    console.warn("Invite emails disabled: set EMAIL_USER and EMAIL_PASS in server/.env to send invitation emails. Invite links will still be created and shown in the UI.");
    return;
  }
  try {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
    console.log("Invite email transport ready (Gmail).");
  } catch (err) {
    console.error("Failed to init email transport:", err.message || err);
  }
})();

/**
 * PUBLIC: Create new organization + first Org Admin
 * Body: { admin: {name,email,password}, company: {...company fields...} }
 */
authRouter.post("/register-org-admin", async (req, res) => {
  try {
    const { admin, company } = req.body ?? {};

    if (!admin?.name || !admin?.email || !admin?.password) {
      return res.status(400).json({ message: "Missing admin fields" });
    }
    if (!company?.name) {
      return res.status(400).json({ message: "Missing company.name" });
    }

    const email = admin.email.toLowerCase().trim();
    const existing = await Account.findOne({ email });
    if (existing) return res.status(409).json({ message: "Email already in use" });

    const passwordHash = await bcrypt.hash(admin.password, 12);

    const account = await Account.create({
      name: admin.name,
      email,
      passwordHash,
      role: "OrgAdmin",
      companyId: null,
      locationId: null,
    });

    const newCompany = await Company.create({
      name: company.name,
      director: company.director ?? null,
      companyNumber: company.companyNumber ?? null,
      CQCnumber: company.CQCnumber ?? null,
      address: company.address ?? null,
      registeredIn: company.registeredIn ?? null,
      adminContact: company.adminContact ?? null,
      icon: company.icon ?? null,
      serviceTypes: company.serviceTypes ?? [],
      ownerAdminId: account._id,
    });

    account.companyId = newCompany._id;
    await account.save();

    const token = signToken(account);
    return res.status(201).json({
      token,
      user: { id: account._id, name: account.name, role: account.role, companyId: account.companyId, avatarUrl: account.avatarUrl ?? null },
      company: { id: newCompany._id, name: newCompany.name },
    });
  } catch (err) {
    return res.status(400).json({ message: err?.message ?? "Registration failed" });
  }
});

/**
 * AUTH: Send invite (invite-only onboarding)
 * Allowed creators: SystemAdmin, OrgAdmin, RegisteredManager
 * Body: { email, role, companyId, locationId? }
 */
authRouter.post(
  "/invite",
  requireAuth,
  requireRole(INVITE_CREATORS),
  async (req, res) => {
    let inviteLink = null;

    try {
      const { email, role, companyId, locationId } = req.body ?? {};

      if (!email || !role || !companyId) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      if (!ROLES.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Tenant safety: only SystemAdmin can invite across orgs
      if (req.user.role !== "SystemAdmin" && String(companyId) !== String(req.user.companyId)) {
        return res.status(403).json({ message: "Cannot invite to another organization" });
      }

      // Enforce location scoping for frontline roles
      if (LOCATION_REQUIRED_FOR.includes(role) && !locationId) {
        return res.status(400).json({ message: "locationId is required for this role" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await Invitation.create({
        email: email.toLowerCase().trim(),
        token,
        role,
        companyId,
        locationId: locationId || null,
        expiresAt,
      });

      const baseUrl = process.env.FRONTEND_URL || "http://localhost:4200";
      inviteLink = `${baseUrl}/login?token=${token}`;

      const payload = (emailSent, message, emailError = null) =>
        res.json({ message, link: inviteLink, emailSent, emailError });

      if (!transporter) {
        return payload(
          false,
          "Invitation created. Email is not configured (set EMAIL_USER and EMAIL_PASS in server/.env). Copy the link below and share it with the invitee."
        );
      }

      const logoPath = path.join(__dirnameAuth, "../LOGO.png");
      const attachments = fs.existsSync(logoPath)
        ? [{ filename: "LOGO.png", path: logoPath, cid: "unique-logo-id" }]
        : [];

      const mailOptions = {
        from: `"Sentinel Insights Team" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Invitation to Join Sentinel Insights",
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
  <p>You have been invited to join <strong>Sentinel Insights</strong> as <strong>${role}</strong>.</p>
  <p><a href="${inviteLink}">Accept Invitation</a></p>
  <p>If the button doesn't work, copy this link: ${inviteLink}</p>
</body>
</html>`,
        attachments,
      };

      await transporter.sendMail(mailOptions);
      return payload(true, "Invitation sent successfully! The invitee should receive an email shortly.");
    } catch (error) {
      const errMsg = error?.message || String(error);
      console.error("Invite email send failed:", errMsg);
      return res.status(200).json({
        message: "Invitation created but the email could not be sent. Copy the link below and share it with the invitee.",
        link: inviteLink,
        emailSent: false,
        emailError: errMsg,
      });
    }
  }
);

/**
 * PUBLIC: Validate invite token (used by frontend to show invite context)
 */
authRouter.get("/invite/:token", async (req, res) => {
  const invite = await Invitation.findOne({
    token: req.params.token,
    used: false,
    expiresAt: { $gt: new Date() },
  }).populate("companyId");

  if (!invite) return res.status(404).json({ message: "Invalid or expired invitation" });

  res.json({
    email: invite.email,
    role: invite.role,
    companyName: invite.companyId?.name ?? null,
    companyId: invite.companyId?._id ?? null,
    locationId: invite.locationId ?? null,
  });
});

/**
 * PUBLIC: Complete registration using invite token
 * Body: { token, name, password }
 */
authRouter.post("/register-invite", async (req, res) => {
  try {
    const { token, name, password } = req.body ?? {};

    if (!token || !name || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const invite = await Invitation.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!invite) return res.status(400).json({ message: "Invalid or expired invitation" });

    const existing = await Account.findOne({ email: invite.email });
    if (existing) {
      return res.status(409).json({
        message: "An account with this email already exists. Please log in instead.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const account = await Account.create({
      name,
      email: invite.email,
      passwordHash,
      role: invite.role,
      companyId: invite.companyId,
      locationId: invite.locationId || null,
    });

    invite.used = true;
    await invite.save();

    const jwtToken = signToken(account);

    return res.status(201).json({
      token: jwtToken,
      user: {
        id: account._id,
        name: account.name,
        role: account.role,
        companyId: account.companyId,
        locationId: account.locationId ?? null,
        avatarUrl: account.avatarUrl ?? null,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists. Please log in instead.",
      });
    }
    console.error("register-invite error:", err);
    return res.status(500).json({
      message: err?.message ?? "Registration failed. Please try again.",
    });
  }
});

/** Escape special regex chars so email can be used safely in RegExp */
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * PUBLIC: Login
 * Body: { email, password }
 */
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const emailNorm = (email ?? "").toString().trim();
  if (!emailNorm) return res.status(400).json({ message: "Email is required" });
  if (password === undefined || password === null) return res.status(400).json({ message: "Password is required" });

  // Case-insensitive email lookup (external DB may store mixed-case)
  const account = await Account.findOne({
    email: { $regex: new RegExp(`^${escapeRegex(emailNorm)}$`, "i") },
  });

  if (!account) return res.status(401).json({ message: "Invalid credentials" });

  const ok = await bcrypt.compare(String(password), account.passwordHash);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  const token = signToken(account);

  return res.json({
    token,
    user: {
      id: account._id,
      name: account.name,
      role: account.role,
      companyId: account.companyId ?? null,
      locationId: account.locationId ?? null,
      avatarUrl: account.avatarUrl ?? null,
    },
  });
});

/**
 * AUTH: Get current user
 * Requires attachUser middleware to populate req.user from JWT. [file:35]
 */
authRouter.get("/me", requireAuth, async (req, res) => {
  const account = await Account.findById(req.user.id).lean();
  if (!account) return res.status(401).json({ message: "Unauthorized" });

  res.json({
    user: {
      id: account._id.toString(),
      name: account.name,
      role: account.role,
      companyId: account.companyId?.toString() ?? null,
      locationId: account.locationId?.toString() ?? null,
      avatarUrl: account.avatarUrl ?? null,
    },
  });
});

/**
 * AUTH: Upload profile photo (saved on server filesystem; path stored in account.avatarUrl)
 * POST /api/auth/avatar - multipart form field: avatar (file)
 * Deletes the previous avatar file from disk if one existed.
 */
authRouter.post("/avatar", requireAuth, uploadAvatar.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const account = await Account.findById(req.user.id);
    if (!account) return res.status(401).json({ message: "Unauthorized" });
    if (account.avatarUrl) {
      const oldPath = path.join(__dirname, "..", "uploads", "avatars", path.basename(account.avatarUrl));
      try {
        fs.unlinkSync(oldPath);
      } catch (_) {
        /* ignore if file already missing */
      }
    }
    const relativePath = "/uploads/avatars/" + req.file.filename;
    account.avatarUrl = relativePath;
    await account.save();
    res.json({ avatarUrl: relativePath });
  } catch (err) {
    res.status(500).json({ message: err?.message ?? "Upload failed" });
  }
});

/**
 * AUTH: Remove profile photo
 * DELETE /api/auth/avatar
 */
authRouter.delete("/avatar", requireAuth, async (req, res) => {
  try {
    const account = await Account.findById(req.user.id);
    if (!account) return res.status(401).json({ message: "Unauthorized" });
    if (account.avatarUrl) {
      const fullPath = path.join(__dirname, "..", "uploads", "avatars", path.basename(account.avatarUrl));
      try {
        fs.unlinkSync(fullPath);
      } catch (_) {
        /* ignore if file missing */
      }
      account.avatarUrl = null;
      await account.save();
    }
    res.json({ avatarUrl: null });
  } catch (err) {
    res.status(500).json({ message: err?.message ?? "Remove failed" });
  }
});
