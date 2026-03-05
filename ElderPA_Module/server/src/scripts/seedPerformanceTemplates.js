// scripts/seedPerformanceTemplates.js
// Seeds PerformanceTemplate with audit-sourced indicators (from performanceTemplates.seed.js).
import "dotenv/config";
import mongoose from "mongoose";

import { connectDb } from "../db.js";
import { PerformanceTemplate } from "../models/PerformanceTemplate.js";
import { CAREHOME_TEMPLATE, HOMECARE_TEMPLATE } from "../seed/performanceTemplates.seed.js";

async function run() {
  await connectDb();

  // Update existing template by locationType (DB may have unique index on locationType only)
  await PerformanceTemplate.findOneAndUpdate(
    { locationType: "CareHome" },
    { $set: { ...CAREHOME_TEMPLATE, isActive: true } },
    { runValidators: true }
  );

  await PerformanceTemplate.findOneAndUpdate(
    { locationType: "HomeCare" },
    { $set: { ...HOMECARE_TEMPLATE, isActive: true } },
    { runValidators: true }
  );

  console.log("Seeded PerformanceTemplates:", CAREHOME_TEMPLATE.name, HOMECARE_TEMPLATE.name);
  await mongoose.connection.close();
}

run().catch(async (e) => {
  console.error(e);
  try { await mongoose.connection.close(); } catch {}
  process.exit(1);
});
