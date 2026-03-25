/**
 * Set `auditType` on AuditInstance documents when it is missing/null/empty.
 * Does not overwrite an existing non-empty auditType.
 *
 * Resolution:
 * - templateId exists in CustomAuditTemplate → custom-template
 * - templateId exists in AuditTemplate → copy template.auditType (baseline | registered_manager | provider)
 * - otherwise → provider (safe default for regulation-style audits)
 *
 * Run: node src/scripts/backfillAuditInstanceAuditTypes.js
 * Dry run: DRY_RUN=1 node src/scripts/backfillAuditInstanceAuditTypes.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../db.js';
import AuditInstance from '../models/AuditInstance.js';
import AuditTemplate from '../models/AuditTemplate.js';
import CustomAuditTemplate from '../models/CustomAuditTemplate.js';

const ALLOWED = new Set(['baseline', 'registered_manager', 'provider', 'custom-template']);
const DEFAULT_FALLBACK = 'provider';

function normalizeTemplateAuditType(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toLowerCase().replace(/-/g, '_');
  if (s === 'registeredmanager') return 'registered_manager';
  if (ALLOWED.has(s) && s !== 'custom-template') return s;
  if (s === 'custom' || s === 'custom_template' || s === 'customtemplate') return 'custom-template';
  return null;
}

function needsAuditType(doc) {
  const v = doc.auditType;
  return v == null || v === '';
}

async function run() {
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  await connectDb();

  const customs = await CustomAuditTemplate.find({}).select('_id').lean();
  const customIds = new Set(customs.map((c) => String(c._id)));

  const standards = await AuditTemplate.find({}).select('_id auditType').lean();
  const standardMap = new Map(standards.map((t) => [String(t._id), t.auditType]));

  const candidates = await AuditInstance.find({
    $or: [{ auditType: { $exists: false } }, { auditType: null }, { auditType: '' }],
  }).lean();

  let updated = 0;
  const plan = [];

  for (const doc of candidates) {
    const tid = doc.templateId != null ? String(doc.templateId) : '';
    let next = null;

    if (tid && customIds.has(tid)) {
      next = 'custom-template';
    } else if (tid && standardMap.has(tid)) {
      const fromTpl = normalizeTemplateAuditType(standardMap.get(tid));
      next = fromTpl || DEFAULT_FALLBACK;
    } else {
      next = DEFAULT_FALLBACK;
    }

    if (!ALLOWED.has(next)) next = DEFAULT_FALLBACK;

    plan.push({ id: String(doc._id), title: doc.title, next });
    if (!dryRun) {
      await AuditInstance.updateOne({ _id: doc._id }, { $set: { auditType: next } });
    }
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        candidates: candidates.length,
        updated,
        sample: plan.slice(0, 12),
      },
      null,
      2
    )
  );

  await mongoose.connection.close();
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
