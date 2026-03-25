/**
 * For "monthly worker timetable" audits per location, if a later month has an all-empty
 * table while an earlier month has data, copy the table rows from the previous audit.
 * Safe no-op when March (etc.) already has user-entered data.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../db.js';
import AuditInstance from '../models/AuditInstance.js';

const TITLE_RX = /monthly worker timetable/i;

function rowIsEmpty(row) {
  if (!Array.isArray(row)) return true;
  return row.every((c) => c === '' || c == null);
}

function tableIsEmpty(value) {
  if (!Array.isArray(value) || value.length === 0) return true;
  return value.every(rowIsEmpty);
}

function cloneRows(rows) {
  return rows.map((r) => (Array.isArray(r) ? [...r] : r));
}

async function run() {
  await connectDb();
  const audits = await AuditInstance.find({ title: TITLE_RX }).sort({ locationId: 1, date: 1 }).lean();

  const byLoc = new Map();
  for (const a of audits) {
    const key = String(a.locationId ?? '');
    if (!byLoc.has(key)) byLoc.set(key, []);
    byLoc.get(key).push(a);
  }

  let updated = 0;
  for (const [, list] of byLoc) {
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      const prevQ = (prev.questions || [])[0];
      const curQ = (cur.questions || [])[0];
      if (!prevQ?.customFields || !curQ?.customFields) continue;

      const prevVal = prevQ.customFields.value;
      const curVal = curQ.customFields.value;
      if (tableIsEmpty(curVal) && !tableIsEmpty(prevVal)) {
        const newQuestions = [...(cur.questions || [])];
        newQuestions[0] = {
          ...curQ,
          customFields: {
            ...curQ.customFields,
            value: cloneRows(prevVal),
          },
        };
        await AuditInstance.updateOne({ _id: cur._id }, { $set: { questions: newQuestions } });
        updated += 1;
        console.log('backfilled', String(cur._id), 'from', String(prev._id), 'date', cur.date);
      }
    }
  }

  console.log(JSON.stringify({ locations: byLoc.size, auditsScanned: audits.length, backfilled: updated }, null, 2));
  await mongoose.connection.close();
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
