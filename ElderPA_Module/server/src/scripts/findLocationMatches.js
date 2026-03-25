/**
 * Find Location records matching a string in code or name.
 * Usage: node src/scripts/findLocationMatches.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../db.js';
import { Location } from '../models/Location.js';

const QUERY = process.argv[2] ?? 'jfhfgh';

async function run() {
  await connectDb();
  const rx = new RegExp(String(QUERY), 'i');
  const locs = await Location.find({
    deletedAt: null,
    $or: [{ code: rx }, { name: rx }],
  })
    .select('_id code name companyId')
    .lean();

  console.log(
    JSON.stringify(
      locs.map((l) => ({
        id: String(l._id),
        code: l.code ?? null,
        name: l.name,
        companyId: String(l.companyId),
      })),
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

