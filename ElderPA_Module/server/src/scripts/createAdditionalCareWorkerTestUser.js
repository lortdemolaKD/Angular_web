/**
 * Create an additional CareWorker account for a location with known credentials.
 *
 * Usage:
 *   node src/scripts/createAdditionalCareWorkerTestUser.js <locationIdOrQuery>
 *
 * Examples:
 *   node src/scripts/createAdditionalCareWorkerTestUser.js 6984c254623115327b786c27
 *   node src/scripts/createAdditionalCareWorkerTestUser.js jfhfgh
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDb } from '../db.js';
import { Location } from '../models/Location.js';
import { Account } from '../models/Account.js';

const TEST_PASSWORD = 'Test1234!';

async function resolveLocation(query) {
  if (!query) return null;
  if (mongoose.isValidObjectId(query)) {
    return Location.findOne({ _id: query, deletedAt: null }).lean();
  }
  const rx = new RegExp(String(query), 'i');
  return Location.findOne({
    deletedAt: null,
    $or: [{ code: rx }, { name: rx }],
  }).lean();
}

async function run() {
  const query = process.argv[2];
  if (!query) {
    console.error('Missing argument: locationIdOrQuery');
    process.exit(1);
  }

  await connectDb();

  const loc = await resolveLocation(query);
  if (!loc) {
    console.error('No matching location found for:', query);
    process.exit(1);
  }

  const locationId = String(loc._id);
  const companyId = loc.companyId ? String(loc.companyId) : null;

  // Deterministic email (avoid collisions by checking and falling back).
  let emailBase = `careworker_test_${locationId}_2@test.local`;
  let email = emailBase;
  const existing = await Account.findOne({ email }).select('_id').lean();
  if (existing) {
    emailBase = `careworker_test_${locationId}_${Date.now()}_2@test.local`;
    email = emailBase;
  }

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const account = await Account.create({
    name: `CareWorker (test 2) (${loc.name})`,
    email,
    passwordHash,
    role: 'CareWorker',
    companyId: loc.companyId ?? null,
    locationId: loc._id,
  });

  console.log(
    JSON.stringify(
      {
        created: true,
        accountId: String(account._id),
        locationId,
        companyId,
        role: account.role,
        email,
        password: TEST_PASSWORD,
      },
      null,
      2
    )
  );

  await mongoose.connection.close();
}

run().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});

