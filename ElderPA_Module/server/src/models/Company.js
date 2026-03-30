// models/Company.js
import mongoose from "mongoose";

const CompanySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    director: { type: String, trim: true },
    companyNumber: { type: String, trim: true },
    CQC_number: { type: String, trim: true },
    address: { type: String, trim: true },
    registeredIn: { type: String, enum: ["England", "Wales", "Scotland"] },
    adminContact: { type: String, trim: true },
    icon: { type: String, trim: true },
    /** Wide header image for dashboards (server path e.g. /uploads/company-banners/...) */
    bannerUrl: { type: String, default: null },
    serviceTypes: [{ type: String }],

    ownerAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },

    // soft delete fields
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
  },
  { timestamps: true }
);

export const Company = mongoose.model("Company", CompanySchema);
