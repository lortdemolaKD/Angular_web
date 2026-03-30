// models/Location.js
import mongoose from "mongoose";

const LocationDepartmentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },     // from Types.ts [file:155]
    name: { type: String, required: true },
    subDepartments: [{ id: String, name: String }],
  },
  { _id: false }
);

const StaffSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ["Managers", "Admins", "Nurses", "Care staff"], required: true },
  },
  { _id: false }
);

const HomeCareCoverageSchema = new mongoose.Schema(
  {
    centerAddress: String,
    radiusMiles: Number,
    areas: [String],
  },
  { _id: false }
);

const HomeCareMetricsSchema = new mongoose.Schema(
  {
    activeCases: { type: Number, required: true },
    maxCases: { type: Number, required: true },
    billingHours: Number,
    rateCard: String,
    capacityOverview: String,
    coverage: HomeCareCoverageSchema,
  },
  { _id: false }
);

const LocationSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    // optional human-friendly code (replaces old "comp1.1")
    code: { type: String, trim: true },

    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["CareHome", "HomeCare"], required: true },

    icon: String,
    address: String,
    contactInfo: String,
    primaryManager: String,

    staff: [StaffSchema],
    departments: [LocationDepartmentSchema],

    // metrics
    stats: {
      occupancy: Number,
      capacity: Number,
      activeCases: Number,
      maxCases: Number,
    },

    // only for HomeCare
    homeCareMetrics: { type: HomeCareMetricsSchema, default: null },

    // CareHome specific (v1 keep simple arrays; rooms/fees can come later)
    areas: [String],
    wings: [String],

    /** Current weekly KPI set; must persist or PUT /api/companies/:id will duplicate PerformanceSets (unique locationId+period). */
    currentPerformanceSetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PerformanceSet",
      default: null,
    },

    // soft delete
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
  },
  { timestamps: true }
);

// Unique (companyId, code) only when code is a non-empty string.
// Sparse+null counted as duplicate for { companyId, code: null } — use partial filter instead.
LocationSchema.index(
  { companyId: 1, code: 1 },
  {
    unique: true,
    partialFilterExpression: {
      code: { $exists: true, $type: "string", $gt: "" },
    },
  }
);

export const Location = mongoose.model("Location", LocationSchema);
