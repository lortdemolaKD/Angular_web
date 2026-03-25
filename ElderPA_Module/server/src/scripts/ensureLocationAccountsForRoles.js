/**
 * Ensure that a set of roles exist for a given Location.
 *
 * Usage:
 *   node src/scripts/ensureLocationAccountsForRoles.js <locationNameOrCode>
 *   DRY_RUN=1 node src/scripts/ensureLocationAccountsForRoles.js <locationNameOrCode>
 *
 * Creates missing Accounts with deterministic emails and a fixed password for testing.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDb } from '../db.js';
import { Location } from '../models/Location.js';
import { Account } from '../models/Account.js';

const ROLES = [
  'RegisteredManager',
  'Supervisor',
  'CareWorker',
  'SeniorCareWorker',
  'Auditor',
];

const TEST_PASSWORD = 'Test1234!';

function normalizeStr(s) {
  return String(s ?? '').trim();
}

async function run() {
  const query = normalizeStr(process.argv[2]);
  if (!query) {
    console.error('Location name/code is required (arg 1). Example: jfhfgh');
    process.exit(1);
  }

  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  await connectDb();

  const rx = new RegExp(query, 'i');
  const locs = await Location.find({
    deletedAt: null,
    $or: [{ code: rx }, { name: rx }],
  })
    .select('_id code name companyId')
    .lean();

  if (!locs.length) {
    console.error('No matching Location found for:', query);
    process.exit(1);
  }
  if (locs.length > 1) {
    console.error('Multiple Locations match; refine the query:', query);
    console.error(
      JSON.stringify(
        locs.map((l) => ({ id: String(l._id), code: l.code ?? null, name: l.name })),
        null,
        2
      )
    );
    process.exit(1);
  }

  const loc = locs[0];
  const locationId = String(loc._id);
  const companyId = loc.companyId ? String(loc.companyId) : null;

  const existing = await Account.find({
    role: { $in: ROLES },
    $or: [{ locationId: loc._id }, { locationId: null }],
  })
    .select('_id name email role companyId locationId')
    .lean();

  const byRoleAndLoc = new Map(); // key: role|locationId
  for (const a of existing) {
    const key = `${a.role}|${String(a.locationId ?? 'null')}`;
    byRoleAndLoc.set(key, a);
  }

  // If an account exists with correct role but missing locationId, update it.
  const updates = [];
  for (const role of ROLES) {
    const exactKey = `${role}|${locationId}`;
    const missingKey = `${role}|null`;

    if (byRoleAndLoc.has(exactKey)) continue;

    const candidate = byRoleAndLoc.get(missingKey);
    if (candidate && candidate.locationId == null) {
      updates.push(candidate.email);
    }
  }

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  const created = [];
  let updated = 0;

  for (const role of ROLES) {
    const exactKey = `${role}|${locationId}`;
    const hasExact = byRoleAndLoc.has(exactKey);
    if (hasExact) {
      const candidate = byRoleAndLoc.get(exactKey);
      if (candidate && candidate.companyId == null && loc.companyId != null) {
        if (!dryRun) {
          await Account.updateOne(
            { _id: candidate._id },
            { $set: { companyId: loc.companyId ?? null } }
          );
        }
        updated += 1;
        created.push({
          role,
          email: candidate.email,
          locationId,
          companyId,
          action: 'updated-existing-missing-companyId',
        });
      }
      continue;
    }

    const missingKey = `${role}|null`;
    const candidate = byRoleAndLoc.get(missingKey);

    const baseEmail = `${role.toLowerCase()}_${locationId}@test.local`;
    let email = baseEmail;

    // Ensure deterministic email doesn't collide with an existing different account.
    const existingEmail = await Account.findOne({ email }).select('_id role locationId').lean();
    if (existingEmail && !(existingEmail.locationId?.toString() === locationId && existingEmail.role === role)) {
      email = `${role.toLowerCase()}_${locationId}_${Date.now()}@test.local`;
    }

    if (candidate && candidate.locationId == null) {
      if (!dryRun) {
      await Account.updateOne(
        { _id: candidate._id },
        { $set: { locationId: loc._id, companyId: loc.companyId ?? null, email } }
      );
      }
      updated += 1;
      created.push({ role, email, locationId, companyId, action: 'updated-existing-missing-locationId' });
      continue;
    }

    if (!dryRun) {
      await Account.create({
        name: `${role} (${loc.name})`,
        email,
        passwordHash,
        role,
        companyId: loc.companyId ?? null,
        locationId: loc._id,
      });
    }
    created.push({ role, email, locationId, companyId, action: 'created' });
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        location: { id: locationId, name: loc.name, code: loc.code ?? null, companyId },
        createdOrUpdated: created,
        existingAlreadyHadExactLocationAccounts: ROLES.filter((r) => byRoleAndLoc.has(`${r}|${locationId}`)),
        updatedCount: updated,
        testPassword: TEST_PASSWORD,
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

