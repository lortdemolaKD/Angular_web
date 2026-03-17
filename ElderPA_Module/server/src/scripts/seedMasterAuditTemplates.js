// scripts/seedMasterAuditTemplates.js
// Creates CustomAuditTemplate documents for all KPI/KFI/KCI audit-sourced indicators.
// Recalculate-from-audits matches by metadata.key = auditTemplateKey; AuditInstance.templateId = CustomAuditTemplate._id.
import "dotenv/config";
import mongoose from "mongoose";

import { connectDb } from "../db.js";
import CustomAuditTemplate from "../models/CustomAuditTemplate.js";
import { AUDIT_TEMPLATE_DEFINITIONS_FOR_INDICATORS } from "../seed/performanceTemplates.seed.js";

async function run() {
  await connectDb();

  for (const def of AUDIT_TEMPLATE_DEFINITIONS_FOR_INDICATORS) {
    const fields = (def.fields || []).map((f) => ({
      id: f.id,
      type: f.type === "table" ? "table" : "number",
      label: f.label || f.id,
      required: false,
      ...(f.type === "table" && {
        tableConfig: {
          headers: ["Month", "Value"],
          rows: 12,
          colTypes: ["text", "number"],
        },
      }),
    }));

    const existing = await CustomAuditTemplate.findOne({
      $or: [
        { "metadata.key": def.templateKey },
        { name: new RegExp(def.templateKey.replace(/-/g, " "), "i") },
      ],
    }).lean();

    const payload = {
      name: def.name,
      description: `Template for key metrics indicators (${def.templateKey}).`,
      type: "audit",
      fields,
      metadata: { key: def.templateKey },
      status: "active",
    };

    if (existing) {
      await CustomAuditTemplate.updateOne({ _id: existing._id }, { $set: payload });
      console.log("Updated CustomAuditTemplate:", def.templateKey, existing._id.toString());
    } else {
      const created = await CustomAuditTemplate.create(payload);
      console.log("Created CustomAuditTemplate:", def.templateKey, created._id.toString());
    }
  }

  console.log("Done. Master audit templates:", AUDIT_TEMPLATE_DEFINITIONS_FOR_INDICATORS.length);
  await mongoose.connection.close();
}

run().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
