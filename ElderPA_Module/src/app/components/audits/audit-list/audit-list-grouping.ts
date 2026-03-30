import type { AuditInstance } from '../../Types';

export type AuditListGroupMode = 'none' | 'template' | 'month' | 'status' | 'scoreBand';

export interface AuditListGroupSection {
  key: string;
  label: string;
  audits: AuditInstance[];
}

/** Parse primary schedule date for filtering (ms since epoch). */
export function parseAuditDateMs(a: AuditInstance): number {
  const raw = a.date || a.createdAt || '';
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function filterAuditsByDateRange(
  audits: AuditInstance[],
  fromIso: string | null | undefined,
  toIso: string | null | undefined
): AuditInstance[] {
  const fromStr = (fromIso ?? '').trim();
  const toStr = (toIso ?? '').trim();
  if (!fromStr && !toStr) return audits;
  const fromMs = fromStr ? new Date(fromStr + 'T00:00:00').getTime() : -Infinity;
  const toMs = toStr ? new Date(toStr + 'T23:59:59.999').getTime() : Infinity;
  return audits.filter((a) => {
    const ms = parseAuditDateMs(a);
    if (!ms) return false;
    return ms >= fromMs && ms <= toMs;
  });
}

/** Strip trailing " - YYYY-MM" / " - YYYY" for a stable template “family” label. */
export function templateGroupLabelFromTitle(title: string | undefined): string {
  const t = String(title ?? '').trim();
  if (!t) return '';
  const m = t.match(/^(.+?)\s*-\s*\d{4}-\d{2}\s*$/);
  if (m) return m[1].trim();
  const m2 = t.match(/^(.+?)\s*-\s*\d{4}\s*$/);
  if (m2) return m2[1].trim();
  return t;
}

function groupLabelForTemplate(audits: AuditInstance[]): string {
  const tid = String((audits[0] as any)?.templateId ?? '').trim();
  const fromTitle = templateGroupLabelFromTitle(audits[0]?.title);
  if (fromTitle) return fromTitle;
  if (tid) return tid.length > 24 ? `…${tid.slice(-20)}` : tid;
  return 'No template';
}

function groupKeyForMonth(a: AuditInstance): { key: string; label: string } {
  const raw = a.date || a.createdAt || '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { key: '_unknown_', label: 'Unknown date' };
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return { key: `${y}-${m}`, label: `${y}-${m}` };
}

function groupKeyForScoreBand(a: AuditInstance): { key: string; label: string } {
  const s = a.overallScore;
  if (s == null || s <= 0) return { key: 'none', label: 'No score' };
  if (s >= 70) return { key: 'high', label: 'Score ≥ 70%' };
  if (s >= 50) return { key: 'medium', label: 'Score 50–69%' };
  return { key: 'low', label: 'Score < 50%' };
}

/**
 * Partition audits into collapsible sections. When mode is `none`, returns a single section
 * with the same list (caller may render a flat table instead).
 */
export function buildAuditGroupSections(
  audits: AuditInstance[],
  mode: AuditListGroupMode
): AuditListGroupSection[] {
  if (!audits.length) return [];
  if (mode === 'none') {
    return [{ key: '_all', label: 'All audits', audits: [...audits] }];
  }

  const map = new Map<string, AuditInstance[]>();

  for (const a of audits) {
    let key: string;
    switch (mode) {
      case 'template': {
        const tid = String((a as any).templateId ?? '').trim();
        key = tid || '_no_template_';
        break;
      }
      case 'month':
        key = groupKeyForMonth(a).key;
        break;
      case 'status': {
        const s = String(a.status ?? '').trim() || 'Unknown';
        key = s;
        break;
      }
      case 'scoreBand':
        key = groupKeyForScoreBand(a).key;
        break;
      default:
        key = '_all';
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }

  const sections: AuditListGroupSection[] = [];

  for (const [key, list] of map.entries()) {
    list.sort((a, b) => {
      const da = a.updatedAt || a.createdAt || a.date || '';
      const db = b.updatedAt || b.createdAt || b.date || '';
      return db > da ? 1 : db < da ? -1 : 0;
    });

    let label: string;
    if (mode === 'template') {
      label = groupLabelForTemplate(list);
    } else if (mode === 'month') {
      label = groupKeyForMonth(list[0]!).label;
    } else if (mode === 'status') {
      label = String(list[0]?.status ?? 'Unknown');
    } else if (mode === 'scoreBand') {
      label = groupKeyForScoreBand(list[0]!).label;
    } else {
      label = key;
    }

    sections.push({ key, label, audits: list });
  }

  const scoreOrder: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };

  sections.sort((a, b) => {
    if (mode === 'month') {
      return b.key.localeCompare(a.key);
    }
    if (mode === 'scoreBand') {
      return (scoreOrder[a.key] ?? 9) - (scoreOrder[b.key] ?? 9);
    }
    if (mode === 'status') {
      if (a.label === 'Complete' && b.label !== 'Complete') return -1;
      if (b.label === 'Complete' && a.label !== 'Complete') return 1;
      return a.label.localeCompare(b.label);
    }
    return a.label.localeCompare(b.label);
  });

  return sections;
}
