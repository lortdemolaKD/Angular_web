import mongoose from "mongoose";

const TemplateQuestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // UI stable id
    text: { type: String, required: true },
    domain: { type: String }, // Safe/Effective/Caring/Responsive/WellLed
    regulations: [
      {
        id: String,
        title: String,
        description: String,
      },
    ],
    requiresEvidence: { type: Boolean, default: false },
    answerType: { type: String }, // "scale" | "text" | "number" etc.
    guidance: { type: String },
    weight: { type: Number, default: 1 },
  },
  { _id: false }
);

const TemplateSectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    questions: { type: [TemplateQuestionSchema], default: [] },
  },
  { _id: false }
);

const AuditTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    auditType: { type: String }, // baseline/registeredmanager/provider
    version: { type: String, default: "1.0" },
    createdAt: { type: Date, default: Date.now },

    // Optional: store who owns it
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", index: true },

    sections: { type: [TemplateSectionSchema], default: [] },

    regulationIds: { type: [String], default: [] },
    responsibleRoles: { type: [String], default: [] },
    frequency: { type: String }, // Daily/Weekly/Monthly/Quarterly/Annually/AdHoc
  },
  { timestamps: true }
);

export default mongoose.model("AuditTemplate", AuditTemplateSchema);
