// models/Invitation.js
import mongoose from "mongoose";

const InvitationSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true },
  token: { type: String, required: true, unique: true },
  role: {
    type: String,
    enum: [
      "SystemAdmin",
      "OrgAdmin",
      "RegisteredManager",
      "Supervisor",
      "CareWorker",
      "SeniorCareWorker",
      "Auditor",
    ],
    required: true,
  },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", default: null },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false }
}, { timestamps: true });

export const Invitation = mongoose.model("Invitation", InvitationSchema);
