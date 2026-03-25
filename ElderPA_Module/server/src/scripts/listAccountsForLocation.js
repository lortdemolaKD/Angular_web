/**
 * Usage:
 *   node src/scripts/listAccountsForLocation.js <locationId>
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../db.js';
import { Account } from '../models/Account.js';

const locationId = process.argv[2];
if (!locationId) {
  console.error('locationId arg is required');
  process.exit(1);
}

async function run() {
  await connectDb();
  const accounts = await Account.find({ locationId }).select('_id name email role companyId locationId').lean();
  console.log(JSON.stringify(accounts.map(a => ({
    id: String(a._id),
    name: a.name,
    email: a.email,
    role: a.role,
    companyId: a.companyId ? String(a.companyId) : null,
    locationId: a.locationId ? String(a.locationId) : null,
  })), null, 2));
  await mongoose.connection.close();
}

run().catch(async (e) => {
  console.error(e);
  try { await mongoose.connection.close(); } catch {}
  process.exit(1);
});

