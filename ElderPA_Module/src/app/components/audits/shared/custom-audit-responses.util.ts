import { AuditQuestionInstance } from '../../Types';

/** Form renderer expects table values as row arrays aligned to tableConfig.headers order. */
function normalizeTableValueForForm(
  value: unknown,
  headers: string[] | undefined
): unknown {
  if (!Array.isArray(value) || !headers?.length) return value;
  const first = value[0];
  if (Array.isArray(first)) return value;
  if (value.length && typeof first === 'object' && first !== null) {
    return (value as Record<string, unknown>[]).map((row) =>
      headers.map((h) => (row[h] != null ? String(row[h]) : ''))
    );
  }
  return value;
}

/**
 * Maps stored audit questions (with customFields) to form field id → value for FormRendererComponent.
 * Aligns with audit-creator.convertQuestionsToResponsesWithIndex, preferring customFields.fieldId when set.
 */
export function buildCustomResponsesFromQuestions(
  questions: AuditQuestionInstance[] | undefined
): Record<string, any> {
  const responses: Record<string, any> = {};
  (questions ?? []).forEach((q, i) => {
    const custom = (q as any).customFields;
    const fieldId =
      (custom?.fieldId as string | undefined) ||
      q.templateQuestionId ||
      `field-${i}`;
    const fieldType = (custom?.fieldType as string | undefined) ?? '';

    // Table (and similar): row data lives in custom.value. Evidence may also exist on the same
    // question; the score/evidence branch below would replace the table payload with an object and
    // the read-only form would show empty cells while still counting as "complete".
    if (fieldType === 'table' || custom?.tableConfig) {
      const headers = custom?.tableConfig?.headers as string[] | undefined;
      let raw: unknown;
      if (custom?.value !== undefined) {
        raw = custom.value;
      } else if (Array.isArray((custom as any)?.rows)) {
        raw = (custom as any).rows;
      } else {
        raw = [];
      }
      responses[fieldId] = normalizeTableValueForForm(raw, headers);
      return;
    }

    // Other non-question custom fields: prefer stored value over the generic evidence/score shape.
    if (fieldType && fieldType !== 'question' && custom?.value !== undefined) {
      responses[fieldId] = custom.value;
      return;
    }

    if (
      q.evidence?.length > 0 ||
      fieldType === 'question' ||
      (q.score != null && (q.evidenceSummaryText != null || q.actionRequired != null))
    ) {
      responses[fieldId] = {
        score: q.score ?? 0,
        evidence: q.evidenceSummaryText ?? '',
        actionRequired: q.actionRequired ?? 'None',
        ...(custom?.rawResponse && typeof custom.rawResponse === 'object' ? custom.rawResponse : {}),
      };
    } else if (custom?.value !== undefined) {
      responses[fieldId] = custom.value;
    } else {
      responses[fieldId] = q.score ?? q.text ?? '';
    }
  });
  return responses;
}
