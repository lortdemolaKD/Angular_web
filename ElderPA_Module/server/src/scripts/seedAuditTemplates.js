// scripts/seedAuditTemplates.js
import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../db.js";
import AuditTemplate from "../models/AuditTemplate.js";


// IMPORTANT: adjust these import paths to where you placed the TS template files
// If these are in server/src/scripts/ then use "./mock-audit-templates.ts" etc.
// If they are in a shared folder, point there.

function regRef(id, title, description) {
  return { id, title, description };
}
async function run() {
  await connectDb();

  await AuditTemplate.deleteMany({});

  const templates = [
    // BASELINE_AUDIT_TEMPLATES
    // 1. Weights & Intakes
    {
      id: 'template-baseline-001',
      name: 'Weights & Intakes Audit',
      auditType: 'baseline',
      frequency: 'Monthly',
      responsibleRoles: ['Deputy Manager', 'Head of Care'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-b001-001',
          title: 'Weight Monitoring',
          description: 'Assessment of resident weight monitoring processes and documentation.',
          questions: [
            {
              id: 'q-b001-001',
              text: 'Are resident weights recorded regularly (at least monthly)?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-9',
                  'Person-centered care',
                  'Ensures care and treatment meets needs'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check weight charts for all residents to ensure regular monitoring.',
            },
            {
              id: 'q-b001-002',
              text: 'Are significant weight changes (>5% monthly) flagged for clinical review?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Care must be provided in a safe way'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Review processes for flagging unintended weight loss or gain.',
            },
            {
              id: 'q-b001-003',
              text: 'Are weight records accurate and legible in care documentation?',
              domain: 'Effective',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Systems must assure quality and safety'
                ),
              ],
              requiresEvidence: false,
              weight: 3,
              answerType: 'scale',
              guidance: 'Sample check 5-10 resident records for accuracy and legibility.',
            },
          ],
        },
        {
          id: 'section-b001-002',
          title: 'Nutritional Intake Documentation',
          description: 'Review of food and fluid intake records for residents with identified needs.',
          questions: [
            {
              id: 'q-b001-004',
              text: 'Are nutritional intake charts completed for residents on specialist diets?',
              domain: 'Caring',
              regulations: [
                regRef(
                  'FS-REG-14',
                  'Meeting nutritional needs',
                  'Nutritional and hydration needs must be met'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check records for residents on fortified diets, pureed diets, or supplements.',
            },
            {
              id: 'q-b001-005',
              text: 'Are residents refusing food offered alternative options?',
              domain: 'Caring',
              regulations: [
                regRef(
                  'FS-REG-9',
                  'Person-centered care',
                  'Care must reflect preferences'
                ),
              ],
              requiresEvidence: false,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Speak with care staff about how alternatives are offered.',
            },
            {
              id: 'q-b001-006',
              text: 'Are hydration levels adequate for all residents?',
              domain: 'Caring',
              regulations: [
                regRef(
                  'FS-REG-14',
                  'Meeting nutritional needs',
                  'Hydration needs must be met'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'scale',
              guidance: 'Observe water provision and fluid intake documentation.',
            },
          ],
        },
      ],
    },

    // 2. Kitchen & Food Hygiene
    {
      id: 'template-baseline-002',
      name: 'Kitchen & Food Hygiene Audit',
      auditType: 'baseline',
      frequency: 'Daily',
      responsibleRoles: ['Deputy Manager', 'Head of Care'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-b002-001',
          title: 'Kitchen Cleanliness & Storage',
          description: 'Assessment of kitchen environment, storage practices, and hygiene standards.',
          questions: [
            {
              id: 'q-b002-001',
              text: 'Is the kitchen clean and free from contamination hazards?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-15',
                  'Premises and equipment',
                  'Premises must be clean and suitable'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'scale',
              guidance: 'Inspect work surfaces, floors, equipment for cleanliness.',
            },
            {
              id: 'q-b002-002',
              text: 'Are food items stored at appropriate temperatures?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Food safety measures must be in place'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check fridge/freezer temperatures and logs. Verify raw/cooked separation.',
            },
            {
              id: 'q-b002-003',
              text: 'Are opened food items labeled with date and time of opening?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Food handling safety'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Sample check 10+ items in fridge for date labels.',
            },
            {
              id: 'q-b002-004',
              text: 'Is kitchen equipment maintained and safe to use?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-15',
                  'Premises and equipment',
                  'Equipment must be properly maintained'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'scale',
              guidance: 'Check for maintenance logs, broken equipment, pest control evidence.',
            },
          ],
        },
        {
          id: 'section-b002-002',
          title: 'Food Preparation & Staff Hygiene',
          description: 'Observation of food preparation practices and staff hygiene standards.',
          questions: [
            {
              id: 'q-b002-005',
              text: 'Do kitchen staff follow handwashing protocols before food preparation?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Infection prevention must be maintained'
                ),
              ],
              requiresEvidence: false,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Observe staff practices during audit visit.',
            },
            {
              id: 'q-b002-006',
              text: 'Are kitchen staff appropriately dressed (clean uniform, hair tied)?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Infection prevention'
                ),
              ],
              requiresEvidence: false,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Visual inspection during site visit.',
            },
            {
              id: 'q-b002-007',
              text: 'Are food preparation methods documented and standardized?',
              domain: 'Effective',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Systems must ensure compliance'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Check for standardized recipes and preparation guidelines.',
            },
          ],
        },
      ],
    },

    // 3. Medication Management
    {
      id: 'template-baseline-003',
      name: 'Medication Management Audit',
      auditType: 'baseline',
      frequency: 'Weekly',
      responsibleRoles: ['Deputy Manager', 'Head of Care'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-b003-001',
          title: 'Medication Storage & Security',
          description: 'Assessment of medication storage, access controls, and security measures.',
          questions: [
            {
              id: 'q-b003-001',
              text: 'Are all medications stored in a locked cabinet?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Proper management of medicines'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Verify locked storage for all medications.',
            },
            {
              id: 'q-b003-002',
              text: 'Is access to medications restricted to authorized staff?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Medicine security'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check access controls and staff training records.',
            },
            {
              id: 'q-b003-003',
              text: 'Are medication temperatures monitored and documented (fridge storage)?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Medicine storage conditions'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check fridge temperature logs for medications requiring cold storage.',
            },
            {
              id: 'q-b003-004',
              text: 'Are expired medications removed and disposed of safely?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Safe disposal of medicines'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review medication stock for any expired items.',
            },
          ],
        },
        {
          id: 'section-b003-002',
          title: 'Medication Administration Records',
          description: 'Verification of medication administration documentation and accuracy.',
          questions: [
            {
              id: 'q-b003-005',
              text: 'Are Medication Administration Records (MARs) completed for each resident?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Documentation of medicine administration'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Sample check 5-10 resident MARs for completeness.',
            },
            {
              id: 'q-b003-006',
              text: 'Are MARs signed by the member of staff who administered the medication?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Accountability for medicines'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Verify staff signatures on MARs.',
            },
            {
              id: 'q-b003-007',
              text: 'Are medication refusals or administration issues documented?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Monitoring and reporting'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Check for notes on refusals or omissions with reasons.',
            },
            {
              id: 'q-b003-008',
              text: 'Are PRN (as needed) medications recorded with indication and time?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'PRN medicine documentation'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Verify PRN medications have indication, time, and reason documented.',
            },
          ],
        },
        {
          id: 'section-b003-003',
          title: 'Medication Competency & Training',
          description: 'Verification of staff competency and training in medication management.',
          questions: [
            {
              id: 'q-b003-009',
              text: 'Is medication training up-to-date for all staff involved in administration?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Staff must be competent'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check training certificates and competency assessments.',
            },
            {
              id: 'q-b003-010',
              text: 'Has medication competency been assessed for staff administering medicines?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Competency assessment'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review competency assessment records and sign-off.',
            },
          ],
        },
      ],
    },

    // 4. Clinical & MDT (Multidisciplinary Team) Review
    {
      id: 'template-baseline-004',
      name: 'Clinical & MDT Review Audit',
      auditType: 'baseline',
      frequency: 'Weekly',
      responsibleRoles: ['Deputy Manager', 'Head of Care'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-b004-001',
          title: 'MDT Meetings & Documentation',
          description: 'Assessment of multidisciplinary team meetings and clinical review processes.',
          questions: [
            {
              id: 'q-b004-001',
              text: 'Are MDT meetings held regularly (as per resident care needs)?',
              domain: 'Effective',
              regulations: [
                regRef(
                  'FS-REG-9',
                  'Person-centered care',
                  'Care must be appropriate and meet needs'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check meeting schedules and attendance records.',
            },
            {
              id: 'q-b004-002',
              text: 'Are MDT meeting outcomes documented and communicated to care staff?',
              domain: 'Effective',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Systems must ensure communication'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review meeting minutes and handover records.',
            },
            {
              id: 'q-b004-003',
              text: 'Are recommendations from external professionals (GP, therapist) documented?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Following professional advice'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review external professional letters and recommendations.',
            },
          ],
        },
        {
          id: 'section-b004-002',
          title: 'Clinical Monitoring & Assessment',
          description: 'Verification of clinical monitoring and regular health assessments.',
          questions: [
            {
              id: 'q-b004-004',
              text: 'Are residents reviewed clinically on an appropriate schedule?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Regular health monitoring'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check assessment schedules for high-risk residents (falls, pressure ulcers).',
            },
            {
              id: 'q-b004-005',
              text: 'Are health changes identified and escalated appropriately?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Responding to health changes'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Review incidents of health deterioration and response times.',
            },
            {
              id: 'q-b004-006',
              text: 'Are vital signs monitored and recorded for residents at risk?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Health monitoring'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check vital signs records for residents with conditions requiring monitoring.',
            },
          ],
        },
      ],
    },

    // 5. Resident Review
    {
      id: 'template-baseline-005',
      name: 'Resident Review Audit',
      auditType: 'baseline',
      frequency: 'Monthly',
      responsibleRoles: ['Deputy Manager', 'Head of Care'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-b005-001',
          title: 'Resident Care Plan Review',
          description: 'Verification of regular care plan reviews and updates.',
          questions: [
            {
              id: 'q-b005-001',
              text: 'Are care plans reviewed at least annually or when care needs change?',
              domain: 'Effective',
              regulations: [
                regRef(
                  'FS-REG-9',
                  'Person-centered care',
                  'Care must be appropriate and reflect needs'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check care plan review dates for all residents.',
            },
            {
              id: 'q-b005-002',
              text: 'Are care plans person-centered and include resident preferences?',
              domain: 'Caring',
              regulations: [
                regRef(
                  'FS-REG-9',
                  'Person-centered care',
                  'Care must reflect preferences'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'scale',
              guidance: 'Review 5-10 care plans for evidence of resident/relative input.',
            },
            {
              id: 'q-b005-003',
              text: 'Are care plans available to all relevant staff members?',
              domain: 'Effective',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Information must be accessible'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Verify care plan accessibility to staff (physical or digital).',
            },
          ],
        },
        {
          id: 'section-b005-002',
          title: 'Resident & Relative Involvement',
          description: 'Assessment of resident and relative engagement in care reviews.',
          questions: [
            {
              id: 'q-b005-004',
              text: 'Are residents involved in their care plan reviews?',
              domain: 'Caring',
              regulations: [
                regRef(
                  'FS-REG-9',
                  'Person-centered care',
                  'Care must reflect preferences'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check for evidence of resident involvement (signed plans, meeting notes).',
            },
            {
              id: 'q-b005-005',
              text: 'Are relatives/representatives invited to and attending reviews?',
              domain: 'Responsive',
              regulations: [
                regRef(
                  'FS-REG-9',
                  'Person-centered care',
                  'Engagement with families'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check meeting invitations and attendance records.',
            },
            {
              id: 'q-b005-006',
              text: 'Are resident wishes documented and respected in care delivery?',
              domain: 'Caring',
              regulations: [
                regRef(
                  'FS-REG-10',
                  'Dignity and respect',
                  'Residents must be treated with dignity and respect'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review care delivery against documented wishes.',
            },
          ],
        },
      ],
    },

    // 6. Accidents & Incidents
    {
      id: 'template-baseline-006',
      name: 'Accidents & Incidents Audit',
      auditType: 'baseline',
      frequency: 'Daily',
      responsibleRoles: ['Deputy Manager', 'Head of Care'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-b006-001',
          title: 'Incident Recording & Reporting',
          description: 'Verification of incident documentation and reporting procedures.',
          questions: [
            {
              id: 'q-b006-001',
              text: 'Are all incidents recorded immediately after occurrence?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-13',
                  'Safeguarding from abuse',
                  'Residents must be protected'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check incident log for timely recording.',
            },
            {
              id: 'q-b006-002',
              text: 'Are incidents documented with sufficient detail (who, what, when, where, how)?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Records must be accurate'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'scale',
              guidance: 'Review 10 incident reports for completeness.',
            },
            {
              id: 'q-b006-003',
              text: 'Are serious incidents reported to relevant authorities (CQC, safeguarding)?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-13',
                  'Safeguarding from abuse',
                  'Serious incidents must be reported'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check reporting records for serious incidents.',
            },
          ],
        },
        {
          id: 'section-b006-002',
          title: 'Incident Investigation & Learning',
          description: 'Assessment of investigation processes and learning from incidents.',
          questions: [
            {
              id: 'q-b006-004',
              text: 'Are serious incidents formally investigated?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-20',
                  'Duty of candour',
                  'Be open when things go wrong'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review investigation reports for serious incidents.',
            },
            {
              id: 'q-b006-005',
              text: 'Are findings and recommendations shared with staff?',
              domain: 'Effective',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Learning must be embedded'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Check for evidence of staff briefings on incident learnings.',
            },
            {
              id: 'q-b006-006',
              text: 'Are fall prevention measures in place for repeat fallers?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Risk management'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check care plans for fall prevention strategies.',
            },
          ],
        },
      ],
    },

    // 7. Care Plans & Reviews
    {
      id: 'template-baseline-007',
      name: 'Care Plans & Reviews Audit',
      auditType: 'baseline',
      frequency: 'Weekly',
      responsibleRoles: ['Deputy Manager', 'Head of Care'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-b007-001',
          title: 'Care Plan Documentation',
          description: 'Verification of comprehensive and current care plan documentation.',
          questions: [
            {
              id: 'q-b007-001',
              text: 'Does each resident have an up-to-date care plan on file?',
              domain: 'Effective',
              regulations: [
                regRef(
                  'FS-REG-9',
                  'Person-centered care',
                  'Care must be planned and documented'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Verify all residents have care plans with current dates.',
            },
            {
              id: 'q-b007-002',
              text: 'Do care plans clearly identify support needs and care outcomes?',
              domain: 'Effective',
              regulations: [
                regRef(
                  'FS-REG-9',
                  'Person-centered care',
                  'Care plans must address identified needs'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'scale',
              guidance: 'Review 5-10 care plans for clarity and completeness.',
            },
            {
              id: 'q-b007-003',
              text: 'Are care plan goals SMART (Specific, Measurable, Achievable, Relevant, Time-bound)?',
              domain: 'Effective',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Goals must be clear and measurable'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'scale',
              guidance: 'Assess quality of objectives in care plans.',
            },
          ],
        },
        {
          id: 'section-b007-002',
          title: 'Specialist Care Plans',
          description: 'Assessment of specialized care plans (falls, pressure ulcers, continence, etc.).',
          questions: [
            {
              id: 'q-b007-004',
              text: 'Do residents at risk of falls have a falls prevention care plan?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Risk management'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check care plans for identified high-risk fallers.',
            },
            {
              id: 'q-b007-005',
              text: 'Do residents at risk of pressure ulcers have a pressure relief plan?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Prevention of pressure ulcers'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Review pressure ulcer prevention documentation.',
            },
            {
              id: 'q-b007-006',
              text: 'Are continence care plans individualized and regularly reviewed?',
              domain: 'Caring',
              regulations: [
                regRef(
                  'FS-REG-9',
                  'Person-centered care',
                  'Care must be person-centered'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check continence assessments and care plans.',
            },
          ],
        },
      ],
    },

    // 8. IPC (Infection Prevention & Control) & Housekeeping
    {
      id: 'template-baseline-008',
      name: 'IPC & Housekeeping Audit',
      auditType: 'baseline',
      frequency: 'Weekly',
      responsibleRoles: ['Deputy Manager', 'Head of Care'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-b008-001',
          title: 'Infection Prevention & Control Measures',
          description: 'Assessment of IPC practices and outbreak prevention measures.',
          questions: [
            {
              id: 'q-b008-001',
              text: 'Are hand hygiene practices observed being followed by staff?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Infection control measures'
                ),
              ],
              requiresEvidence: false,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Observe staff hand hygiene during audit visit.',
            },
            {
              id: 'q-b008-002',
              text: 'Are appropriate PPE supplies available and in use?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'IPC provisions'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check PPE stock levels and observe usage.',
            },
            {
              id: 'q-b008-003',
              text: 'Are communal areas cleaned regularly according to schedule?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-15',
                  'Premises and equipment',
                  'Premises must be clean'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'scale',
              guidance: 'Check cleaning schedules and visual inspection.',
            },
            {
              id: 'q-b008-004',
              text: 'Are isolation procedures in place for residents with infections?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Controlling spread of infection'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Review outbreak protocols and current isolation status.',
            },
          ],
        },
        {
          id: 'section-b008-002',
          title: 'Housekeeping Standards',
          description: 'Verification of cleanliness and maintenance standards throughout the facility.',
          questions: [
            {
              id: 'q-b008-005',
              text: 'Are resident bedrooms clean, tidy, and free from odors?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-15',
                  'Premises and equipment',
                  'Premises must be clean and suitable'
                ),
              ],
              requiresEvidence: false,
              weight: 4,
              answerType: 'scale',
              guidance: 'Visual inspection of resident rooms.',
            },
            {
              id: 'q-b008-006',
              text: 'Are bathrooms and toilets maintained to good hygiene standards?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-15',
                  'Premises and equipment',
                  'Cleanliness of facilities'
                ),
              ],
              requiresEvidence: false,
              weight: 4,
              answerType: 'scale',
              guidance: 'Inspect bathrooms and toilets for cleanliness.',
            },
            {
              id: 'q-b008-007',
              text: 'Is the laundry managed safely with appropriate infection control?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Infection prevention in laundry'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Check laundry procedures and contamination control.',
            },
            {
              id: 'q-b008-008',
              text: 'Is waste management carried out safely and in line with regulations?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Waste management'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check waste disposal procedures and segregation.',
            },
          ],
        },
      ],
    },

    // 9. Health & Safety
    {
      id: 'template-baseline-009',
      name: 'Health & Safety Audit',
      auditType: 'baseline',
      frequency: 'Monthly',
      responsibleRoles: ['Deputy Manager', 'Head of Care'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-b009-001',
          title: 'Premises Safety & Maintenance',
          description: 'Assessment of building safety, maintenance, and hazard management.',
          questions: [
            {
              id: 'q-b009-001',
              text: 'Are emergency exits clearly marked and accessible?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-15',
                  'Premises and equipment',
                  'Premises must be safe'
                ),
              ],
              requiresEvidence: false,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Visual inspection of all emergency exits.',
            },
            {
              id: 'q-b009-002',
              text: 'Is fire safety equipment maintained and accessible?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-15',
                  'Premises and equipment',
                  'Fire safety measures'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check fire extinguishers, alarms, and evacuation procedures.',
            },
            {
              id: 'q-b009-003',
              text: 'Are slips, trips, and falls hazards minimized?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-15',
                  'Premises and equipment',
                  'Safe environment'
                ),
              ],
              requiresEvidence: false,
              weight: 4,
              answerType: 'scale',
              guidance: 'Inspect for hazards (wet floors, clutter, loose carpets, etc.).',
            },
            {
              id: 'q-b009-004',
              text: 'Are portable electrical appliances regularly tested for safety?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-15',
                  'Premises and equipment',
                  'Equipment safety'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check PAT testing records and dates.',
            },
          ],
        },
        {
          id: 'section-b009-002',
          title: 'Health & Safety Policies & Training',
          description: 'Verification of H&S policy implementation and staff training.',
          questions: [
            {
              id: 'q-b009-005',
              text: 'Is there a current Health & Safety policy accessible to staff?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Policies must guide practice'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check for H&S policy and implementation evidence.',
            },
            {
              id: 'q-b009-006',
              text: 'Has Health & Safety training been completed by all staff?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Staff must be trained'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review training records and certification.',
            },
            {
              id: 'q-b009-007',
              text: 'Are incident investigations documented with corrective actions?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Learning from incidents'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Review incident investigation reports.',
            },
          ],
        },
      ],
    },
    //PROVIDER_AUDIT_TEMPLATES
    // 1. NHS Capacity Tracker
    {
      id: 'template-provider-001',
      name: 'NHS Capacity Tracker Audit',
      auditType: 'provider',
      frequency: 'Weekly',
      responsibleRoles: ['Admin', 'Provider'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-prov001-001',
          title: 'Capacity Reporting',
          description: 'Verification of accurate bed capacity reporting to NHS systems.',
          questions: [
            {
              id: 'q-prov001-001',
              text: 'Is bed capacity data accurately reported to NHS Capacity Tracker?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Accurate information provision'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Verify NHS Capacity Tracker submissions against actual bed status.',
            },
            {
              id: 'q-prov001-002',
              text: 'Are capacity reports submitted on schedule (weekly)?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Timeliness of reporting'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check submission dates and compliance with reporting schedule.',
            },
            {
              id: 'q-prov001-003',
              text: 'Are staffing levels accurately reported in capacity submissions?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Accurate staffing information'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Cross-check staffing data in NHS reports against actual rosters.',
            },
          ],
        },
        {
          id: 'section-prov001-002',
          title: 'Bed Management & Occupancy',
          description: 'Assessment of bed management and occupancy control.',
          questions: [
            {
              id: 'q-prov001-004',
              text: 'Are beds allocated and managed according to care requirements?',
              domain: 'Effective',
              regulations: [
                regRef(
                  'FS-REG-9',
                  'Person-centered care',
                  'Appropriate care provision'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review bed allocation decisions and resident placement.',
            },
            {
              id: 'q-prov001-005',
              text: 'Are occupancy records maintained and available for audit?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Record keeping'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Check occupancy records and bed status logs.',
            },
          ],
        },
      ],
    },

    // 2. CQC Liaison
    {
      id: 'template-provider-002',
      name: 'CQC Liaison Audit',
      auditType: 'provider',
      frequency: 'Monthly',
      responsibleRoles: ['Registered Manager', 'Provider'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-prov002-001',
          title: 'CQC Communication & Compliance',
          description: 'Verification of CQC liaison and compliance with regulatory requirements.',
          questions: [
            {
              id: 'q-prov002-001',
              text: 'Is there a designated CQC liaison contact?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Regulatory liaison'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Verify CQC liaison appointment and contact details.',
            },
            {
              id: 'q-prov002-002',
              text: 'Are all CQC communications responded to promptly?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Responsiveness'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check CQC correspondence and response logs.',
            },
            {
              id: 'q-prov002-003',
              text: 'Are CQC action plans being implemented and tracked?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Continuous improvement'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Review CQC action plans and progress tracking.',
            },
          ],
        },
        {
          id: 'section-prov002-002',
          title: 'Inspection Readiness',
          description: 'Assessment of preparedness for CQC inspections.',
          questions: [
            {
              id: 'q-prov002-004',
              text: 'Are all records and documentation organized and accessible?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Record management'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'scale',
              guidance: 'Verify document management system and accessibility.',
            },
            {
              id: 'q-prov002-005',
              text: 'Have staff been briefed on expected CQC inspection standards?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Staff awareness'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check for evidence of CQC briefing sessions with staff.',
            },
          ],
        },
      ],
    },

    // 3. Weekly Reports
    {
      id: 'template-provider-003',
      name: 'Weekly Reports Audit',
      auditType: 'provider',
      frequency: 'Weekly',
      responsibleRoles: ['Registered Manager', 'Admin'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-prov003-001',
          title: 'Report Generation & Submission',
          description: 'Verification of weekly reporting processes and timeliness.',
          questions: [
            {
              id: 'q-prov003-001',
              text: 'Are weekly reports generated and submitted on schedule?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Reporting requirements'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check weekly report submission logs and dates.',
            },
            {
              id: 'q-prov003-002',
              text: 'Do weekly reports include all required information (incidents, staffing, etc.)?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Complete reporting'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review contents of weekly reports for completeness.',
            },
            {
              id: 'q-prov003-003',
              text: 'Are significant issues highlighted and escalated in reports?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Issue escalation'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check reports for incident summaries and escalations.',
            },
          ],
        },
        {
          id: 'section-prov003-002',
          title: 'Report Quality & Accuracy',
          description: 'Assessment of data accuracy and reporting quality.',
          questions: [
            {
              id: 'q-prov003-004',
              text: 'Are report figures accurate and verifiable?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Accurate information'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Cross-check reported figures against source records.',
            },
            {
              id: 'q-prov003-005',
              text: 'Is there consistent data entry and formatting in reports?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Report consistency'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Review multiple weeks of reports for consistency.',
            },
          ],
        },
      ],
    },

    // 4. Revenue Report & Financial Management
    {
      id: 'template-provider-004',
      name: 'Revenue Report & Financial Management Audit',
      auditType: 'provider',
      frequency: 'Monthly',
      responsibleRoles: ['Admin', 'Finance Manager', 'Provider'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-prov004-001',
          title: 'Revenue Reporting & Reconciliation',
          description: 'Verification of monthly revenue reporting and financial reconciliation.',
          questions: [
            {
              id: 'q-prov004-001',
              text: 'Are monthly revenue reports generated and reconciled?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Financial management'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check monthly revenue statements and reconciliation documents.',
            },
            {
              id: 'q-prov004-002',
              text: 'Are invoicing and billing procedures accurate and timely?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Financial procedures'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review billing system and sample invoices.',
            },
            {
              id: 'q-prov004-003',
              text: 'Are fee enhancements (room type, care level) correctly applied?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Billing accuracy'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Cross-check fee schedules with resident care levels and billing.',
            },
          ],
        },
        {
          id: 'section-prov004-002',
          title: 'Resident Fees & Collections',
          description: 'Assessment of resident fee management and payment collection.',
          questions: [
            {
              id: 'q-prov004-004',
              text: 'Are resident fee policies clearly communicated to residents/families?',
              domain: 'Responsive',
              regulations: [
                regRef(
                  'FS-REG-9',
                  'Person-centered care',
                  'Transparent arrangements'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check fee agreements and resident communications.',
            },
            {
              id: 'q-prov004-005',
              text: 'Are outstanding payments tracked and followed up appropriately?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Debt management'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review payment ledger and collection records.',
            },
            {
              id: 'q-prov004-006',
              text: 'Are resident personal finance accounts maintained securely?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Financial safeguards'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Verify security of resident money and financial records.',
            },
          ],
        },
        {
          id: 'section-prov004-003',
          title: 'Financial Controls & Compliance',
          description: 'Assessment of financial controls and regulatory compliance.',
          questions: [
            {
              id: 'q-prov004-007',
              text: 'Are transactions approved and authorized appropriately?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Financial controls'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check authorization procedures and approval trails.',
            },
            {
              id: 'q-prov004-008',
              text: 'Is there audit trail for all financial transactions?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Record keeping'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Verify audit trail in financial system.',
            },
          ],
        },
      ],
    },

    // 5. Management Targets & Performance
    {
      id: 'template-provider-005',
      name: 'Management Targets & Performance Audit',
      auditType: 'provider',
      frequency: 'Monthly',
      responsibleRoles: ['Provider', 'Registered Manager'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-prov005-001',
          title: 'Performance Targets & KPIs',
          description: 'Assessment of organizational performance against management targets.',
          questions: [
            {
              id: 'q-prov005-001',
              text: 'Are clear performance targets established for key metrics?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Performance management'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review strategic plans and target documentation.',
            },
            {
              id: 'q-prov005-002',
              text: 'Is performance against targets monitored monthly?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Monitoring and review'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check monthly performance review reports.',
            },
            {
              id: 'q-prov005-003',
              text: 'Are performance variances analyzed and action plans created?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Problem-solving'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review variance analysis and corrective action plans.',
            },
          ],
        },
        {
          id: 'section-prov005-002',
          title: 'Occupancy & Bed Management',
          description: 'Monitoring of occupancy rates and bed utilization.',
          questions: [
            {
              id: 'q-prov005-004',
              text: 'Is occupancy rate tracked against target?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Performance monitoring'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review occupancy reports and trending.',
            },
            {
              id: 'q-prov005-005',
              text: 'Are bed turnaround times monitored?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Operational efficiency'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Check bed turnaround records.',
            },
          ],
        },
        {
          id: 'section-prov005-003',
          title: 'Staffing Performance',
          description: 'Monitoring of staffing levels and performance metrics.',
          questions: [
            {
              id: 'q-prov005-006',
              text: 'Are staffing levels maintained according to plan?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Sufficient numbers of staff'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Compare actual staffing to establishment.',
            },
            {
              id: 'q-prov005-007',
              text: 'Is staff absence monitored and managed?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Consistent staffing'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review absence reports and management protocols.',
            },
            {
              id: 'q-prov005-008',
              text: 'Is staff turnover tracked and addressed?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Staff retention'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Check staff turnover metrics and exit interviews.',
            },
          ],
        },
      ],
    },

    // 6. Budget Control & Ordering
    {
      id: 'template-provider-006',
      name: 'Budget Control & Ordering Audit',
      auditType: 'provider',
      frequency: 'Monthly',
      responsibleRoles: ['Admin', 'Finance Manager', 'Provider'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-prov006-001',
          title: 'Budget Planning & Control',
          description: 'Assessment of budget planning and expenditure control processes.',
          questions: [
            {
              id: 'q-prov006-001',
              text: 'Is an annual budget established and approved?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Financial planning'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Verify annual budget documentation.',
            },
            {
              id: 'q-prov006-002',
              text: 'Is monthly expenditure tracked against budget?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Cost control'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check monthly variance reports.',
            },
            {
              id: 'q-prov006-003',
              text: 'Are budget variations investigated and explained?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Financial accountability'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review variance analysis and explanations.',
            },
          ],
        },
        {
          id: 'section-prov006-002',
          title: 'Procurement & Ordering',
          description: 'Verification of procurement procedures and ordering controls.',
          questions: [
            {
              id: 'q-prov006-004',
              text: 'Are procurement procedures documented and followed?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Procurement policy'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check procurement policy and sample orders.',
            },
            {
              id: 'q-prov006-005',
              text: 'Are competitive quotes obtained for significant purchases?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Value for money'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review quote records for major purchases.',
            },
            {
              id: 'q-prov006-006',
              text: 'Are purchase orders raised for all orders?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Documentation'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check purchase order system.',
            },
          ],
        },
        {
          id: 'section-prov006-003',
          title: 'Stock Management & Ordering',
          description: 'Assessment of inventory management and supply ordering.',
          questions: [
            {
              id: 'q-prov006-007',
              text: 'Are stock levels monitored to prevent shortages or overstocking?',
              domain: 'Effective',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Resource management'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review stock levels and ordering patterns.',
            },
            {
              id: 'q-prov006-008',
              text: 'Are regular inventory checks conducted?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Asset management'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Check inventory check records and reconciliation.',
            },
          ],
        },
      ],
    },

    // 7. Policies & Procedures
    {
      id: 'template-provider-007',
      name: 'Policies & Procedures Audit',
      auditType: 'provider',
      frequency: 'Quarterly',
      responsibleRoles: ['Registered Manager', 'Provider'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-prov007-001',
          title: 'Policy Development & Implementation',
          description: 'Verification of current policies and implementation across organization.',
          questions: [
            {
              id: 'q-prov007-001',
              text: 'Are all required policies in place and current?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Policies required'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Review policy register and compliance checklist.',
            },
            {
              id: 'q-prov007-002',
              text: 'Are policies reviewed and updated according to schedule?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Policy review'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check policy review dates and version control.',
            },
            {
              id: 'q-prov007-003',
              text: 'Are staff trained on relevant policies?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Staff training'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check staff acknowledgment of policies.',
            },
            {
              id: 'q-prov007-004',
              text: 'Are policies accessible to all staff?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Information availability'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Check policy storage and accessibility.',
            },
          ],
        },
        {
          id: 'section-prov007-002',
          title: 'Key Policies Review',
          description: 'Assessment of critical policy areas.',
          questions: [
            {
              id: 'q-prov007-005',
              text: 'Are safeguarding and protection policies robust and implemented?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-13',
                  'Safeguarding',
                  'Protection procedures'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Review safeguarding policy and evidence of implementation.',
            },
            {
              id: 'q-prov007-006',
              text: 'Are Health & Safety policies current and followed?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-15',
                  'Premises and equipment',
                  'Health & Safety'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check H&S policy and compliance evidence.',
            },
            {
              id: 'q-prov007-007',
              text: 'Is whistleblowing policy in place and accessible?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Transparency'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Verify whistleblowing policy and staff awareness.',
            },
          ],
        },
      ],
    },

    // 8. Recruitment & Staff Files
    {
      id: 'template-provider-008',
      name: 'Recruitment & Staff Files Audit',
      auditType: 'provider',
      frequency: 'Monthly',
      responsibleRoles: ['Admin', 'HR Manager', 'Provider'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-prov008-001',
          title: 'Recruitment Procedures',
          description: 'Assessment of recruitment processes and pre-employment checks.',
          questions: [
            {
              id: 'q-prov008-001',
              text: 'Are recruitment procedures documented and followed?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-19',
                  'Fit and proper persons employed',
                  'Recruitment procedures'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Review recruitment policy and sample applications.',
            },
            {
              id: 'q-prov008-002',
              text: 'Are all required pre-employment checks completed (DBS, references)?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-19',
                  'Fit and proper persons employed',
                  'DBS and references'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check DBS certificates and reference letters in staff files.',
            },
            {
              id: 'q-prov008-003',
              text: 'Are identity documents verified and copied?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-19',
                  'Fit and proper persons employed',
                  'Identity verification'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check identity verification documents in files.',
            },
            {
              id: 'q-prov008-004',
              text: 'Are right-to-work checks completed?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-19',
                  'Fit and proper persons employed',
                  'Work authorization'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Verify right-to-work documentation.',
            },
          ],
        },
        {
          id: 'section-prov008-002',
          title: 'Staff File Management',
          description: 'Verification of complete and secure staff file maintenance.',
          questions: [
            {
              id: 'q-prov008-005',
              text: 'Do all staff have complete personal files with required documentation?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-19',
                  'Fit and proper persons employed',
                  'Record keeping'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Sample check 5-10 staff files for completeness.',
            },
            {
              id: 'q-prov008-006',
              text: 'Are employment contracts signed and on file?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-19',
                  'Fit and proper persons employed',
                  'Contracts'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check contract files.',
            },
            {
              id: 'q-prov008-007',
              text: 'Are training and qualification certificates kept up-to-date in files?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Training records'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check training records in staff files.',
            },
            {
              id: 'q-prov008-008',
              text: 'Are staff files kept securely and confidentially?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Confidentiality'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Verify secure storage and access controls.',
            },
          ],
        },
      ],
    },

    // 9. Marketing & Advertisements
    {
      id: 'template-provider-009',
      name: 'Marketing & Advertisements Audit',
      auditType: 'provider',
      frequency: 'Monthly',
      responsibleRoles: ['Admin', 'Provider'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-prov009-001',
          title: 'Marketing Materials & Content',
          description: 'Assessment of marketing materials for accuracy and compliance.',
          questions: [
            {
              id: 'q-prov009-001',
              text: 'Are marketing materials accurate and truthful?',
              domain: 'Responsive',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Transparency'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'scale',
              guidance: 'Review marketing claims against actual services provided.',
            },
            {
              id: 'q-prov009-002',
              text: 'Do marketing materials avoid misleading claims?',
              domain: 'Responsive',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Honest representation'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check for CQC rating and compliance claims.',
            },
            {
              id: 'q-prov009-003',
              text: 'Do photographs/videos have resident consent?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-10',
                  'Dignity and respect',
                  'Respect for privacy'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Verify consent records for use of resident images.',
            },
          ],
        },
        {
          id: 'section-prov009-002',
          title: 'Advertising Channels & Reach',
          description: 'Assessment of advertising effectiveness and appropriateness.',
          questions: [
            {
              id: 'q-prov009-004',
              text: 'Are advertisements placed in appropriate channels?',
              domain: 'Responsive',
              regulations: [
                regRef(
                  'FS-REG-9',
                  'Person-centered care',
                  'Access to information'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Review advertising channels and placement decisions.',
            },
            {
              id: 'q-prov009-005',
              text: 'Is CQC rating prominently displayed in advertisements?',
              domain: 'Responsive',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Transparency'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check that current CQC rating is displayed.',
            },
          ],
        },
      ],
    },

    // REGISTERED_MANAGER_AUDIT_TEMPLATES
    // 1. DOLs, Safeguarding & CQC Notifications
    {
      id: 'template-rm-001',
      name: 'DOLs, Safeguarding & CQC Notifications Audit',
      auditType: 'registered_manager',
      frequency: 'Weekly',
      responsibleRoles: ['Registered Manager'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-rm001-001',
          title: 'Deprivation of Liberty Safeguards (DOLs)',
          description: 'Verification of DOLs applications, assessments, and ongoing compliance.',
          questions: [
            {
              id: 'q-rm001-001',
              text: 'Are residents assessed for capacity to make their own decisions about care?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-11',
                  'Need for consent',
                  'Care must only be provided with consent'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Review capacity assessments for residents receiving care against their wishes.',
            },
            {
              id: 'q-rm001-002',
              text: 'Are DOLs applications submitted to the local authority when required?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-11',
                  'Need for consent',
                  'Legal requirements for DOLs'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check DOLs application logs and status tracking.',
            },
            {
              id: 'q-rm001-003',
              text: 'Are authorized DOLs conditions being met and monitored?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-11',
                  'Need for consent',
                  'Compliance with authorization conditions'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review DOLs authorizations and compliance records.',
            },
          ],
        },
        {
          id: 'section-rm001-002',
          title: 'Safeguarding Concerns & Reporting',
          description: 'Assessment of safeguarding incident management and reporting procedures.',
          questions: [
            {
              id: 'q-rm001-004',
              text: 'Are safeguarding concerns reported to local safeguarding teams promptly?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-13',
                  'Safeguarding from abuse',
                  'Service users must be protected'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check safeguarding referral logs and reporting timelines.',
            },
            {
              id: 'q-rm001-005',
              text: 'Are safeguarding investigations conducted and documented thoroughly?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-13',
                  'Safeguarding from abuse',
                  'Investigations required'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Review investigation files and outcomes.',
            },
            {
              id: 'q-rm001-006',
              text: 'Are lessons learned from safeguarding incidents shared with staff?',
              domain: 'Effective',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Learning from incidents'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Check for evidence of staff briefings and policy updates.',
            },
          ],
        },
        {
          id: 'section-rm001-003',
          title: 'CQC Notifications',
          description: 'Verification of CQC notification procedures for notifiable events.',
          questions: [
            {
              id: 'q-rm001-007',
              text: 'Are notifiable events reported to CQC within required timeframes?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-20',
                  'Duty of candour',
                  'Be open and transparent'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check CQC notification logs and dates of submission.',
            },
            {
              id: 'q-rm001-008',
              text: 'Are CQC notification records kept and made available for inspection?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Records management'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Verify notification filing system and records.',
            },
          ],
        },
      ],
    },

    // 2. COVID, PPE & Hand Hygiene
    {
      id: 'template-rm-002',
      name: 'COVID, PPE & Hand Hygiene Audit',
      auditType: 'registered_manager',
      frequency: 'Weekly',
      responsibleRoles: ['Registered Manager'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-rm002-001',
          title: 'COVID-19 Preparedness & Response',
          description: 'Assessment of COVID-19 contingency planning and current procedures.',
          questions: [
            {
              id: 'q-rm002-001',
              text: 'Is there a current COVID-19 response plan in place?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Infection control measures'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review COVID-19 response policy and procedures.',
            },
            {
              id: 'q-rm002-002',
              text: 'Are staff trained on COVID-19 prevention and response procedures?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Staff must be trained'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check training records and competency assessments.',
            },
            {
              id: 'q-rm002-003',
              text: 'Are COVID-19 testing procedures in place and followed?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Infection control'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review testing logs and procedures.',
            },
          ],
        },
        {
          id: 'section-rm002-002',
          title: 'PPE Management & Stock Control',
          description: 'Verification of PPE availability, stock levels, and proper usage.',
          questions: [
            {
              id: 'q-rm002-004',
              text: 'Are adequate PPE supplies available and accessible to staff?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'IPC provisions'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check PPE stock levels and storage locations.',
            },
            {
              id: 'q-rm002-005',
              text: 'Are staff wearing PPE correctly and according to guidelines?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Proper use of PPE'
                ),
              ],
              requiresEvidence: false,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Observe staff during audit visit for correct PPE usage.',
            },
            {
              id: 'q-rm002-006',
              text: 'Is PPE waste disposed of safely and separately?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Waste management'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Check PPE waste disposal procedures.',
            },
          ],
        },
        {
          id: 'section-rm002-003',
          title: 'Hand Hygiene Practices',
          description: 'Assessment of hand hygiene compliance and protocol adherence.',
          questions: [
            {
              id: 'q-rm002-007',
              text: 'Are hand hygiene facilities readily available throughout the facility?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Infection control'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check sinks, hand sanitizers, and soap availability.',
            },
            {
              id: 'q-rm002-008',
              text: 'Are staff observed practicing proper hand hygiene techniques?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-12',
                  'Safe care and treatment',
                  'Hand hygiene'
                ),
              ],
              requiresEvidence: false,
              weight: 4,
              answerType: 'scale',
              guidance: 'Observe hand hygiene during audit visit.',
            },
            {
              id: 'q-rm002-009',
              text: 'Has hand hygiene training been completed by all staff?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Staff training'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Review training records.',
            },
          ],
        },
      ],
    },

    // 3. Staff Training & Supervisions
    {
      id: 'template-rm-003',
      name: 'Staff Training & Supervisions Audit',
      auditType: 'registered_manager',
      frequency: 'Weekly',
      responsibleRoles: ['Registered Manager'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-rm003-001',
          title: 'Mandatory Training Compliance',
          description: 'Verification of staff completion of mandatory training courses.',
          questions: [
            {
              id: 'q-rm003-001',
              text: 'Have all staff completed mandatory safeguarding training?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Staff must be trained'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check training records for all staff members.',
            },
            {
              id: 'q-rm003-002',
              text: 'Have all staff completed Health & Safety training?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Staff training requirements'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Verify H&S training certificates and dates.',
            },
            {
              id: 'q-rm003-003',
              text: 'Have all staff completed infection prevention & control training?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Staff competency'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check IPC training records.',
            },
            {
              id: 'q-rm003-004',
              text: 'Is mandatory training refreshed annually?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Ongoing training'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review training expiry dates and renewal schedules.',
            },
          ],
        },
        {
          id: 'section-rm003-002',
          title: 'Staff Supervision & Appraisal',
          description: 'Assessment of regular supervision and appraisal processes.',
          questions: [
            {
              id: 'q-rm003-005',
              text: 'Are staff supervisions scheduled regularly (at least quarterly)?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Supervision requirement'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check supervision schedules and records.',
            },
            {
              id: 'q-rm003-006',
              text: 'Are supervision sessions documented with clear records and actions?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Records must be maintained'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review supervision records for completeness.',
            },
            {
              id: 'q-rm003-007',
              text: 'Are performance concerns addressed through supervision?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Performance management'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check for documentation of performance discussions.',
            },
            {
              id: 'q-rm003-008',
              text: 'Are appraisals conducted annually?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Staff appraisal'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review annual appraisal records.',
            },
          ],
        },
        {
          id: 'section-rm003-003',
          title: 'Staff Competency & Development',
          description: 'Verification of staff competency assessments and development plans.',
          questions: [
            {
              id: 'q-rm003-009',
              text: 'Have staff been assessed for competency in their role?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Competency assessment'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Check competency assessment records.',
            },
            {
              id: 'q-rm003-010',
              text: 'Are staff development needs identified and plans created?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-18',
                  'Staffing',
                  'Staff development'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review development plans in supervision records.',
            },
          ],
        },
      ],
    },

    // 4. Emails, Appointments & Letters
    {
      id: 'template-rm-004',
      name: 'Emails, Appointments & Letters Audit',
      auditType: 'registered_manager',
      frequency: 'Weekly',
      responsibleRoles: ['Registered Manager', 'Admin'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-rm004-001',
          title: 'Communication Management',
          description: 'Assessment of incoming and outgoing communications.',
          questions: [
            {
              id: 'q-rm004-001',
              text: 'Are all emails and communications responded to in a timely manner?',
              domain: 'Responsive',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Effective communication'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'scale',
              guidance: 'Review email logs and response times.',
            },
            {
              id: 'q-rm004-002',
              text: 'Are external communications (to CQC, local authority) logged and tracked?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Record keeping'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check external communication logs.',
            },
            {
              id: 'q-rm004-003',
              text: 'Are sensitive communications appropriately handled and filed?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Confidentiality'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review confidential communication procedures.',
            },
          ],
        },
        {
          id: 'section-rm004-002',
          title: 'Resident Appointments & Visits',
          description: 'Verification of appointment scheduling and visiting arrangements.',
          questions: [
            {
              id: 'q-rm004-004',
              text: 'Are resident appointments recorded and organized effectively?',
              domain: 'Effective',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Organization of care'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Review appointment system and records.',
            },
            {
              id: 'q-rm004-005',
              text: 'Are external appointment letters/reminders sent to residents?',
              domain: 'Responsive',
              regulations: [
                regRef(
                  'FS-REG-9',
                  'Person-centered care',
                  'Support for appointments'
                ),
              ],
              requiresEvidence: true,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Check for letters/reminders for external appointments.',
            },
            {
              id: 'q-rm004-006',
              text: 'Are visiting arrangements flexible and supported?',
              domain: 'Caring',
              regulations: [
                regRef(
                  'FS-REG-9',
                  'Person-centered care',
                  'Family involvement'
                ),
              ],
              requiresEvidence: false,
              weight: 3,
              answerType: 'boolean',
              guidance: 'Speak with residents and families about visiting access.',
            },
          ],
        },
      ],
    },

    // 5. Spot Checks & Ward Rounds
    {
      id: 'template-rm-005',
      name: 'Spot Checks & Ward Rounds Audit',
      auditType: 'registered_manager',
      frequency: 'Weekly',
      responsibleRoles: ['Registered Manager'],
      version: '1.0',
      createdAt: '2025-01-01T09:00:00Z',
      sections: [
        {
          id: 'section-rm005-001',
          title: 'Registered Manager Visibility',
          description: 'Assessment of Registered Manager presence and leadership visibility.',
          questions: [
            {
              id: 'q-rm005-001',
              text: 'Is the Registered Manager visible and accessible to residents and staff?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Leadership visibility'
                ),
              ],
              requiresEvidence: false,
              weight: 4,
              answerType: 'scale',
              guidance: 'Observe RM engagement during visit.',
            },
            {
              id: 'q-rm005-002',
              text: 'Are regular ward rounds/spot checks conducted by the RM?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Quality monitoring'
                ),
              ],
              requiresEvidence: true,
              weight: 5,
              answerType: 'boolean',
              guidance: 'Review RM ward round records and schedules.',
            },
            {
              id: 'q-rm005-003',
              text: 'Are issues identified during spot checks followed up and resolved?',
              domain: 'WellLed',
              regulations: [
                regRef(
                  'FS-REG-17',
                  'Good governance',
                  'Problem-solving'
                ),
              ],
              requiresEvidence: true,
              weight: 4,
              answerType: 'boolean',
              guidance: 'Check spot check records and follow-up actions.',
            },
          ],
        },
        {
          id: 'section-rm005-002',
          title: 'Care Quality Observations',
          description: 'Assessment of care quality during ward rounds and observations.',
          questions: [
            {
              id: 'q-rm005-004',
              text: 'Are residents well-dressed, clean, and well-groomed?',
              domain: 'Caring',
              regulations: [
                regRef(
                  'FS-REG-10',
                  'Dignity and respect',
                  'Residents must be treated with dignity'
                ),
              ],
              requiresEvidence: false,
              weight: 4,
              answerType: 'scale',
              guidance: 'Visual observation during ward round.',
            },
            {
              id: 'q-rm005-005',
              text: 'Are interactions between staff and residents respectful and caring?',
              domain: 'Caring',
              regulations: [
                regRef(
                  'FS-REG-10',
                  'Dignity and respect',
                  'Respectful care'
                ),
              ],
              requiresEvidence: false,
              weight: 4,
              answerType: 'scale',
              guidance: 'Observe staff-resident interactions.',
            },
            {
              id: 'q-rm005-006',
              text: 'Are residents engaged and appear content?',
              domain: 'Caring',
              regulations: [
                regRef(
                  'FS-REG-9',
                  'Person-centered care',
                  'Wellbeing and satisfaction'
                ),
              ],
              requiresEvidence: false,
              weight: 4,
              answerType: 'scale',
              guidance: 'Observe resident engagement and activity.',
            },
            {
              id: 'q-rm005-007',
              text: 'Are residents comfortable (seating, temperature, comfort)?',
              domain: 'Safe',
              regulations: [
                regRef(
                  'FS-REG-15',
                  'Premises and equipment',
                  'Environment comfort'
                ),
              ],
              requiresEvidence: false,
              weight: 3,
              answerType: 'scale',
              guidance: 'Assess physical comfort during observation.',
            },
          ],
        },
      ],
    },
  ];



  const created = await AuditTemplate.insertMany(templates, { ordered: true });

  console.log("Seeded AuditTemplates:", created.map((t) => t.name));
  await mongoose.connection.close();
}

run().catch(async (e) => {
  console.error(e);
  try { await mongoose.connection.close(); } catch {}
  process.exit(1);
});
