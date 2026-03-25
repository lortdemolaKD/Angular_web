import type { AuditQuestionInstance } from '../../Types';

/**
 * Finances / migrated audits often store table data under customFields but omit templateQuestionId.
 * Bonus panel reads customFields directly; the form needs the same keys as CustomAuditTemplate field ids.
 */
export function inferCustomTableFieldId(headers: unknown): string | null {
  if (!Array.isArray(headers)) return null;
  const h = headers.map((x) => String(x ?? '').toLowerCase().replace(/\s+/g, ' ').trim());
  const has = (s: string) => h.some((x) => x.includes(s));
  if (has('target hours') && has('worker role') && (has('hours worked') || has('hours'))) {
    return 'worker-timetable-table';
  }
  if (has('money spent') && has('what acquired') && has('remaining')) {
    return 'monthly-useable-cash-table';
  }
  return null;
}

function normalizeLegacyFieldId(fieldId: string | null | undefined): string | null {
  const key = String(fieldId ?? '').trim().toLowerCase();
  if (!key) return null;
  if (key === 'monthly-worker-timetable-table') return 'worker-timetable-table';
  if (key === 'monthly-useable-cash') return 'monthly-useable-cash-table';
  return String(fieldId);
}

/** Map audit questions → form response keys (Audit Library + Audit Creator Daily). */
export function buildCustomResponsesFromQuestions(questions: AuditQuestionInstance[] | undefined): Record<string, any> {
  const responses: Record<string, any> = {};
  (questions ?? []).forEach((q, i) => {
    const cf = (q as any).customFields;
    if (!cf) return;
    let key = normalizeLegacyFieldId(q.templateQuestionId);
    const inferredTableId = cf.fieldType === 'table' ? inferCustomTableFieldId(cf.tableConfig?.headers) : null;
    if (inferredTableId) {
      // Prefer canonical field id from headers so legacy ids still populate current template fields.
      key = inferredTableId;
    } else if (!key) {
      key = `field-${i}`;
    }
    responses[key] = cf.value ?? cf.rawResponse ?? null;
  });
  return responses;
}
