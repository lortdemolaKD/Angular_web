/**
 * Point monthly worker timetable / monthly useable cash audits at CustomAuditTemplate IDs
 * so Audit Library + Audit Creator can load the correct form template.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../db.js';
import AuditInstance from '../models/AuditInstance.js';
import CustomAuditTemplate from '../models/CustomAuditTemplate.js';

const WORKER_HEADERS = ['Worker name', 'Worker role', 'Hours worked', 'Target hours'];
const WORKER_ROLE_OPTIONS = [
  'RegisteredManager',
  'Supervisor',
  'SeniorCareWorker',
  'CareWorker',
  'Auditor',
  'SystemAdmin',
  'OrgAdmin',
];

const PETTY_HEADERS = ['Month', 'Money spent', 'What acquired', 'amount remaining after purchase'];

async function ensureWorkerTemplate() {
  let tpl = await CustomAuditTemplate.findOne({ name: /monthly worker timetable/i });
  const fields = [
    {
      id: 'worker-timetable-table',
      type: 'table',
      label: 'Monthly worker timetable',
      required: true,
      tableConfig: {
        headers: WORKER_HEADERS,
        rows: 8,
        colTypes: ['text', 'select', 'number', 'number'],
        colOptions: [
          { options: [] },
          { options: WORKER_ROLE_OPTIONS },
          { options: [] },
          { options: [] },
        ],
      },
    },
  ];
  if (tpl) {
    tpl.fields = fields;
    tpl.type = 'audit';
    tpl.status = 'active';
    await tpl.save();
    return tpl._id;
  }
  const created = await CustomAuditTemplate.create({
    name: 'monthly worker timetable',
    description: 'Monthly worker timetable',
    type: 'audit',
    fields,
    status: 'active',
    metadata: {
      key: 'monthly-worker-timetable',
      createdAt: new Date(),
      modifiedAt: new Date(),
      version: 1,
      isPublished: true,
    },
  });
  return created._id;
}

async function ensurePettyTemplate() {
  let tpl = await CustomAuditTemplate.findOne({ name: /monthly useable cash/i });
  const fields = [
    {
      id: 'monthly-useable-cash-table',
      type: 'table',
      label: 'Monthly useable cash',
      required: true,
      tableConfig: {
        headers: PETTY_HEADERS,
        rows: 6,
        colTypes: ['text', 'number', 'text', 'number'],
      },
    },
  ];
  if (tpl) {
    tpl.fields = fields;
    tpl.type = 'audit';
    tpl.status = 'active';
    await tpl.save();
    return tpl._id;
  }
  const created = await CustomAuditTemplate.create({
    name: 'monthly useable cash',
    description: 'Petty cash by month',
    type: 'audit',
    fields,
    status: 'active',
    metadata: {
      key: 'monthly-useable-cash',
      createdAt: new Date(),
      modifiedAt: new Date(),
      version: 1,
      isPublished: true,
    },
  });
  return created._id;
}

async function run() {
  await connectDb();
  const workerTplId = await ensureWorkerTemplate();
  const pettyTplId = await ensurePettyTemplate();

  const workerRes = await AuditInstance.updateMany(
    { title: /monthly worker timetable/i },
    { $set: { templateId: workerTplId, auditType: 'custom-template' } }
  );
  const pettyRes = await AuditInstance.updateMany(
    { title: /monthly useable cash/i },
    { $set: { templateId: pettyTplId, auditType: 'custom-template' } }
  );

  console.log(
    JSON.stringify(
      {
        workerTemplateId: String(workerTplId),
        pettyTemplateId: String(pettyTplId),
        workerAuditsUpdated: workerRes.modifiedCount,
        pettyAuditsUpdated: pettyRes.modifiedCount,
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
