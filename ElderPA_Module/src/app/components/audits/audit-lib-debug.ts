import type { AuditInstance } from '../Types';

/** DevTools: `localStorage.setItem('auditLibDebug','1');` then reload to enable Audit Library logs. */
export function isAuditLibDebug(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('auditLibDebug') === '1';
  } catch {
    return false;
  }
}

/** Matches "Monthly worker timetable" and close variants (spelling / wording). */
export function isWorkerTimetableTitle(title: unknown): boolean {
  const t = String(title ?? '').toLowerCase();
  if (t.includes('monthly worker timetable')) return true;
  if (t.includes('worker timetable')) return true;
  return t.includes('worker') && t.includes('timetable');
}

/**
 * Logs every worker-timetable audit in the given list (ids, dates, scope, table row counts + value preview).
 * No-op unless `auditLibDebug` is enabled.
 */
export function logWorkerTimetableAuditsData(audits: readonly AuditInstance[], label = 'library list'): void {
  if (!isAuditLibDebug()) return;
  const matches = audits.filter((a) => isWorkerTimetableTitle((a as any)?.title));
  console.groupCollapsed(`[AuditLib] monthly worker timetable — ${matches.length} in ${label}`);
  if (matches.length === 0) {
    console.log('None matched title filter in this list.');
    console.groupEnd();
    return;
  }
  matches.forEach((a, idx) => {
    const id = String((a as any)?.id ?? (a as any)?._id ?? '');
    const questions = (a as any).questions ?? [];
    const dump = {
      ordinal: `${idx + 1}/${matches.length}`,
      id,
      title: (a as any).title,
      date: (a as any).date,
      createdAt: (a as any).createdAt,
      updatedAt: (a as any).updatedAt,
      locationId: (a as any).locationId,
      companyId: (a as any).companyId ?? (a as any).companyID,
      auditType: (a as any).auditType,
      templateId: (a as any).templateId,
      responsesRoot: (a as any).responses,
      formResponseRoot: (a as any).formResponse,
      questions: questions.map((qi: any, i: number) => {
        const cf = qi?.customFields;
        const val = cf?.value;
        const rowCount = Array.isArray(val) ? val.length : null;
        const preview =
          Array.isArray(val) && val.length > 0
            ? val.slice(0, Math.min(5, val.length))
            : val !== undefined
              ? val
              : undefined;
        return {
          qIndex: i,
          templateQuestionId: qi?.templateQuestionId,
          label: qi?.text ?? qi?.clauseLabel,
          fieldId: cf?.fieldId,
          fieldType: cf?.fieldType,
          headers: cf?.tableConfig?.headers,
          rowCount,
          valuePreview: preview,
        };
      }),
    };
    console.log(dump);
  });
  console.groupEnd();
}
