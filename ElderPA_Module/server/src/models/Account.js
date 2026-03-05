import mongoose from "mongoose";
const ROLES = [
  "SystemAdmin",
  "OrgAdmin",
  "RegisteredManager",
  "Supervisor",
  "CareWorker",
  "SeniorCareWorker",
  "Auditor",
];
const AccountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },

    passwordHash: { type: String, required: true },


    role: { type: String, enum: ROLES, required: true },

    // Single-tenant (matches your JWT + routes expecting req.user.companyId)
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },

    // If you want a user assigned to exactly one location:
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      default: null,
      index: true,
    },

    // Profile photo: stored on server filesystem, path/URL stored here (e.g. /uploads/avatars/xxx.jpg)
    avatarUrl: { type: String, default: null },
  },
  { timestamps: true }
);

export const Account = mongoose.model("Account", AccountSchema);
