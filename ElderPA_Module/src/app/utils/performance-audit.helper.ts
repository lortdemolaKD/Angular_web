import type { PerformanceCategory } from '../components/Types';

/** True when the set includes audit-sourced indicators that have not been populated yet (no history). */
export function performanceNeedsAuditRecalc(categories: PerformanceCategory[] | undefined | null): boolean {
  if (!categories?.length) return false;
  for (const cat of categories) {
    for (const ind of cat.indicators ?? []) {
      if (ind.sourceType === 'audit' && !(ind.history?.length)) return true;
    }
  }
  return false;
}
