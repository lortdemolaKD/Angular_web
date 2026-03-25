/**
 * One-off: March worker timetable for location 6984c254623115327b786c27 was identical to February.
 * Sets distinct "hours worked" (and one row target-adjacent) so March is clearly its own month.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../db.js';
import AuditInstance from '../models/AuditInstance.js';

const AUDIT_ID = '69c189f6ed4ceed1b6e84c4a';

const marchValue = [
  ['RegisteredManager 1', 'RegisteredManager', 158, 160],
  ['Supervisor 2', 'Supervisor', 155, 160],
  ['CareWorker-1 3', 'CareWorker', 132, 160],
  ['CareWorker-2 4', 'CareWorker', 95, 100],
  ['CareWorker-3 5', 'CareWorker', 152, 160],
  ['CareWorker-4 6', 'CareWorker', 68, 160],
  ['CareWorker-5 7', 'CareWorker', 156, 160],
  ['Auditor 8', 'Auditor', 152, 160],
];

async function run() {
  await connectDb();
  const _id = new mongoose.Types.ObjectId(AUDIT_ID);
  const res = await AuditInstance.updateOne(
    { _id },
    { $set: { 'questions.0.customFields.value': marchValue } }
  );
  console.log(JSON.stringify({ matched: res.matchedCount, modified: res.modifiedCount }, null, 2));
  const doc = await AuditInstance.findById(_id).lean();
  console.log('rows', JSON.stringify(doc?.questions?.[0]?.customFields?.value, null, 2));
  await mongoose.connection.close();
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
