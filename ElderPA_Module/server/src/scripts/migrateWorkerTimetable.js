import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../db.js';
import AuditInstance from '../models/AuditInstance.js';
import CustomAuditTemplate from '../models/CustomAuditTemplate.js';

const headers = ['Worker name', 'Worker role', 'Hours worked', 'Target hours'];

const roleOptions = [
  'RegisteredManager',
  'Supervisor',
  'SeniorCareWorker',
  'CareWorker',
  'Auditor',
  'SystemAdmin',
  'OrgAdmin',
];

function normalizeRole(rawRole) {
  const raw = String(rawRole ?? '').trim();
  const v = raw.toLowerCase().replace(/[\s_-]+/g, '');
  if (v.includes('systemadmin')) return 'SystemAdmin';
  if (v.includes('orgadmin')) return 'OrgAdmin';
  if (v.includes('registeredmanager')) return 'RegisteredManager';
  if (v.includes('supervisor')) return 'Supervisor';
  if (v.includes('seniorcareworker')) return 'SeniorCareWorker';
  if (v.includes('careworker')) return 'CareWorker';
  if (v.includes('auditor')) return 'Auditor';
  return raw;
}

function prettifyRoleLabel(rawRole) {
  return String(rawRole ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, idx) => {
      if (!Array.isArray(row)) return null;

      // Current row format: [name, role, type, worked, target] OR [name, role, worked, target]
      if (row.length >= 5) {
        const name = String(row[0] ?? '').trim() || `Worker ${idx + 1}`;
        const rawRole = String(row[1] ?? '').trim();
        const role = normalizeRole(rawRole);
        const worked = Number(row[3]);
        const target = Number(row[4]);
        if (!role || Number.isNaN(worked) || Number.isNaN(target) || target <= 0) return null;
        const resolvedName =
          name && !/^worker\s+\d+$/i.test(name)
            ? name
            : rawRole && role !== rawRole
              ? prettifyRoleLabel(rawRole)
              : name;
        return [resolvedName, role, worked, target];
      }

      if (row.length === 4) {
        const name = String(row[0] ?? '').trim() || `Worker ${idx + 1}`;
        const rawRole = String(row[1] ?? '').trim();
        const role = normalizeRole(rawRole);
        const worked = Number(row[2]);
        const target = Number(row[3]);
        if (!role || Number.isNaN(worked) || Number.isNaN(target) || target <= 0) return null;
        const resolvedName =
          name && !/^worker\s+\d+$/i.test(name)
            ? name
            : rawRole && role !== rawRole
              ? prettifyRoleLabel(rawRole)
              : name;
        return [resolvedName, role, worked, target];
      }

      // Legacy row: [role, hoursWorked, targetHours]
      const rawRole = String(row[0] ?? '').trim();
      const role = normalizeRole(rawRole);
      const worked = Number(row[1]);
      const target = Number(row[2]);
      if (!role || Number.isNaN(worked) || Number.isNaN(target) || target <= 0) return null;
      const name = rawRole && role !== rawRole ? prettifyRoleLabel(rawRole) : '';
      return [name, role, worked, target];
    })
    .filter(Boolean);
}

async function run() {
  await connectDb();

  const audits = await AuditInstance.find({ title: /monthly worker timetable/i }).lean();
  let updated = 0;

  for (const audit of audits) {
    const questions = (audit.questions || []).map((q) => {
      const cf = q?.customFields || {};
      const rows = normalizeRows(cf.value);
      if (!rows.length) return q;

      return {
        ...q,
        customFields: {
          ...cf,
          fieldType: 'table',
          tableConfig: {
            ...(cf.tableConfig || {}),
            headers,
            rows: Math.max(rows.length, 1),
            colTypes: ['text', 'select', 'number', 'number'],
            colOptions: [
              { options: [] },
              { options: roleOptions },
              { options: [] },
              { options: [] },
            ],
          },
          value: rows,
        },
      };
    });

    await AuditInstance.updateOne({ _id: audit._id }, { $set: { questions } });
    updated += 1;
  }

  const templateFields = [
    {
      id: 'worker-timetable-table',
      type: 'table',
      label: 'Monthly worker timetable',
      required: true,
      tableConfig: {
        headers,
        rows: 8,
        colTypes: ['text', 'select', 'number', 'number'],
        colOptions: [
          { options: [] },
          { options: roleOptions },
          { options: [] },
          { options: [] },
        ],
      },
    },
  ];

  const existingTemplate = await CustomAuditTemplate.findOne({ name: /monthly worker timetable/i });
  if (existingTemplate) {
    existingTemplate.fields = templateFields;
    existingTemplate.type = 'audit';
    existingTemplate.status = 'active';
    await existingTemplate.save();
  } else {
    await CustomAuditTemplate.create({
      name: 'monthly worker timetable',
      description: 'Monthly worker timetable with worker name and role.',
      type: 'audit',
      fields: templateFields,
      status: 'active',
      metadata: {
        key: 'monthly-worker-timetable',
        createdAt: new Date(),
        modifiedAt: new Date(),
        version: 1,
        isPublished: true,
      },
    });
  }

  console.log(JSON.stringify({ auditsFound: audits.length, auditsUpdated: updated, templateUpdated: true }, null, 2));
  await mongoose.connection.close();
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
