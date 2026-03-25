/**
 * Give each location's "monthly worker timetable" audits a distinct calendar date
 * (Feb, Mar, ...) so per-location timelines are consistent.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../db.js';
import AuditInstance from '../models/AuditInstance.js';

const TITLE_RX = /monthly worker timetable/i;
const BASE_YEAR = 2026;
/** First audit per location gets this month (1-12); each next audit increments month. */
const START_MONTH = 2;

async function run() {
  await connectDb();
  const audits = await AuditInstance.find({ title: TITLE_RX }).sort({ locationId: 1, createdAt: 1 }).lean();
  const byLocation = new Map();
  for (const audit of audits) {
    const key = String(audit.locationId ?? '');
    const list = byLocation.get(key) ?? [];
    list.push(audit);
    byLocation.set(key, list);
  }
  let updated = 0;
  for (const [, list] of byLocation) {
    let m = START_MONTH;
    for (const a of list) {
      const day = 15;
      const dateStr = `${BASE_YEAR}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      await AuditInstance.updateOne({ _id: a._id }, { $set: { date: dateStr } });
      updated += 1;
      m += 1;
      if (m > 12) {
        m = 1;
      }
    }
  }
  console.log(JSON.stringify({ matched: audits.length, updated }, null, 2));
  await mongoose.connection.close();
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
