// scripts/seedMockAuditsForIndicators.js
// Creates mock AuditInstance documents for all templates required by KPI/KFI/KCI indicators.
// Each audit has questions with templateQuestionId = field id and customFields.value so recalculate-from-audits can aggregate.
import "dotenv/config";
import mongoose from "mongoose";

import { connectDb } from "../db.js";
import CustomAuditTemplate from "../models/CustomAuditTemplate.js";
import { Location } from "../models/Location.js";
import AuditInstance from "../models/AuditInstance.js";
import { AUDIT_TEMPLATE_DEFINITIONS_FOR_INDICATORS } from "../seed/performanceTemplates.seed.js";

const TEMPLATE_KEYS = AUDIT_TEMPLATE_DEFINITIONS_FOR_INDICATORS.map((d) => d.templateKey);

/** Mock value by field id (so indicators get visible data). */
function mockValueForField(fieldId, monthIndex, templateKey) {
  const r = (seed) => (monthIndex * 7 + seed) % 100;
  if (fieldId === "ws-client-count") return 15 + r(1);
  if (fieldId === "ws-delivered-hours") return 80 + monthIndex * 40 + r(2);
  if (fieldId === "ws-staff-capacity-hours") return 120 + r(3);
  if (fieldId === "care-reviewed" || fieldId === "care-actual-reviewed") return 5 + r(4);
  if (fieldId === "staff-total-employed") return 12 + (monthIndex % 3);
  if (fieldId === "train-courses-completed") return 3 + r(5);
  if (fieldId === "train-courses-assigned") return 8;
  if (fieldId === "msg-concerns-raised") return monthIndex % 4;
  if (fieldId === "msg-resolved") return monthIndex % 3;
  if (fieldId === "mhl-table") return null; // filled as table below
  return 10 + r(6);
}

/** One audit per location for Monthly Hours Log: single question mhl-table with full year rows [month, value]. */
function buildQuestionsMonthlyHoursLogFullYear(fieldDefs, year) {
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const tableValue = monthNames.map((m, i) => [m, 50 + i * 10 + (i % 5) * 5]);
  const mhlField = (fieldDefs || []).find((f) => f.id === "mhl-table");
  return [
    {
      templateQuestionId: "mhl-table",
      text: mhlField?.label || "Hours table",
      customFields: { value: tableValue },
      fieldType: "table",
    },
  ];
}

/** Build questions array for one audit: one question per template field with templateQuestionId + value. */
function buildQuestions(fieldDefs, dateStr) {
  const year = parseInt(dateStr.slice(0, 4), 10);
  const month = parseInt(dateStr.slice(5, 7), 10);
  const monthIndex = Math.max(0, (year - 2026) * 12 + (month - 1));

  const questions = [];
  for (const field of fieldDefs || []) {
    const id = field.id;
    if (!id) continue;
    let value;
    if (field.type === "table" || id === "mhl-table") {
      const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      value = monthNames.map((m, i) => [m, 50 + i * 10 + (monthIndex % 5) * 5]);
    } else {
      value = mockValueForField(id, monthIndex, field.type);
    }
    questions.push({
      templateQuestionId: id,
      text: field.label || id,
      customFields: { value },
      fieldType: field.type === "table" ? "table" : "text",
    });
  }
  return questions;
}

async function run() {
  await connectDb();

  const templates = await CustomAuditTemplate.find({
    $or: [
      { "metadata.key": { $in: TEMPLATE_KEYS } },
      { name: { $in: AUDIT_TEMPLATE_DEFINITIONS_FOR_INDICATORS.map((d) => d.name) } },
    ],
  }).lean();

  if (!templates.length) {
    console.log("No CustomAuditTemplates found. Run: npm run seed:master-audits");
    await mongoose.connection.close();
    process.exit(1);
  }

  const keyToTemplate = new Map();
  for (const t of templates) {
    const key = t.metadata?.key || t.name?.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    keyToTemplate.set(key, t);
  }
  for (const def of AUDIT_TEMPLATE_DEFINITIONS_FOR_INDICATORS) {
    if (!keyToTemplate.has(def.templateKey)) {
      const byName = templates.find((t) => t.name === def.name);
      if (byName) keyToTemplate.set(def.templateKey, byName);
    }
  }

  const locations = await Location.find({ deletedAt: null }).lean();
  if (!locations.length) {
    console.log("No locations found. Create companies/locations first.");
    await mongoose.connection.close();
    process.exit(1);
  }

  const year = 2026;
  const months = Array.from({ length: 12 }, (_, i) => ({
    key: `${year}-${String(i + 1).padStart(2, "0")}`,
    date: `${year}-${String(i + 1).padStart(2, "0")}-01`,
  }));

  let created = 0;
  let skipped = 0;

  for (const loc of locations) {
    const locationId = loc._id;
    const companyId = loc.companyId || null;

    for (const def of AUDIT_TEMPLATE_DEFINITIONS_FOR_INDICATORS) {
      const template = keyToTemplate.get(def.templateKey);
      if (!template) {
        console.warn("Template not in DB:", def.templateKey);
        continue;
      }

      // Monthly Hours Log: one audit per location (edited at end of each month), not one per month
      if (def.templateKey === "monthly-hours-log") {
        const dateStr = `${year}-12-01`;
        const existingList = await AuditInstance.find({
          locationId,
          templateId: template._id,
          date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` },
        }).lean();
        if (existingList.length > 1) {
          await AuditInstance.deleteMany({
            locationId,
            templateId: template._id,
            date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` },
          });
        }
        const existing = existingList.length === 1 ? existingList[0] : null;
        if (existing && existingList.length === 1) {
          skipped++;
          continue;
        }
        const questions = buildQuestionsMonthlyHoursLogFullYear(def.fields || [], year);
        await AuditInstance.create({
          templateId: template._id,
          locationId,
          companyId,
          date: dateStr,
          title: `${def.name} - ${year} (edit at end of each month)`,
          questions,
          status: "Complete",
        });
        created++;
        continue;
      }

      for (const { key: periodKey, date: dateStr } of months) {
        const existing = await AuditInstance.findOne({
          locationId,
          templateId: template._id,
          date: dateStr,
        }).lean();

        if (existing) {
          skipped++;
          continue;
        }

        const questions = buildQuestions(def.fields || [], dateStr);

        await AuditInstance.create({
          templateId: template._id,
          locationId,
          companyId,
          date: dateStr,
          title: `${def.name} - ${periodKey}`,
          questions,
          status: "Complete",
        });
        created++;
      }
    }
  }

  console.log("Mock audits created:", created, "skipped (already exist):", skipped);
  await mongoose.connection.close();
}

run().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
