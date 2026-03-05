import { Injectable } from '@angular/core';
import { LocationType, Indicator, PerformanceSet } from '../components/Types';

export interface BonusLine {
  role: string;               // Managers / Admins / Care staff
  basePercent: number;        // contractual bonus %
  financialScore: number;     // 0–100, based on billing/fees KPIs & KFIs
  stakeholderScore: number;   // 0–100, based on alerts, external ratings etc.
  financialWeight: number;    // 0.75 from CEO
  stakeholderWeight: number;  // 0.25 from CEO
  autoBonusPercent: number;   // weighted bonus%
  manualAdjustPercent: number;// director +/- adjustment
  finalBonusPercent: number;  // auto + manual
}

@Injectable({ providedIn: 'root' })
export class BonusService {

  computeBonusForLocation(loc: LocationType): BonusLine[] {
    const perf = loc.performance;
    if (!perf) return [];

    const kpiCats = perf.categories?.filter(c => c.type === 'KPI') ?? [];
    const kfiCats = perf.categories?.filter(c => c.type === 'KFI') ?? [];
    const kciCats = perf.categories?.filter(c => c.type === 'KCI') ?? [];
    const alerts = perf.alerts ?? [];

    const financialScore = this.computeFinancialScore(kpiCats, kfiCats, loc);
    const stakeholderScore = this.computeStakeholderScore(kciCats, alerts);

    const financialWeight = 0.75;
    const stakeholderWeight = 0.25;

    const autoScore =
      financialScore * financialWeight +
      stakeholderScore * stakeholderWeight;

    // Example base bonus per role – adjust later
    const configs = [
      { role: 'Managers',    basePercent: 15 },
      { role: 'Admins',      basePercent: 8 },
      { role: 'Care staff',  basePercent: 5 },
    ];

    return configs.map(c => {
      const autoBonusPercent = c.basePercent * this.mapScoreToFactor(autoScore);
      const manualAdjustPercent = 0; // default, set via UI later
      const finalBonusPercent = autoBonusPercent + manualAdjustPercent;

      return {
        role: c.role,
        basePercent: c.basePercent,
        financialScore,
        stakeholderScore,
        financialWeight,
        stakeholderWeight,
        autoBonusPercent,
        manualAdjustPercent,
        finalBonusPercent,
      };
    });
  }

  /** Quantitative / revenue side: billing hours, average fees, financial KFIs. [file:33][file:17] */
  private computeFinancialScore(kpiCats: PerformanceSet['categories'], kfiCats: PerformanceSet['categories'], loc: LocationType): number {
    const indicators: Indicator[] = [
      ...(kpiCats?.flatMap(c => c.indicators ?? []) ?? []),
      ...(kfiCats?.flatMap(c => c.indicators ?? []) ?? []),
    ];

    const values: number[] = [];

    indicators.forEach(ind => {
      if (typeof ind.current === 'number' && typeof ind.target === 'number' && ind.target !== 0) {
        const pct = Math.max(0, Math.min(150, (ind.current / ind.target) * 100));
        values.push(pct);
      }
    });

    // HomeCare: billingHours and maxCases approximate utilisation.
    const hc = loc.homeCareMetrics;
    if (hc?.activeCases && hc.maxCases) {
      const utilisation = (hc.activeCases / hc.maxCases) * 100;
      values.push(utilisation);
    }

    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /** Stakeholder / quality side: KCI + alerts + later external ratings. [file:33][file:17] */
  private computeStakeholderScore(kciCats: PerformanceSet['categories'], alerts: any[]): number {
    const kciIndicators: Indicator[] =
      kciCats?.flatMap(c => c.indicators ?? []) ?? [];

    const values: number[] = [];

    kciIndicators.forEach(ind => {
      if (typeof ind.current === 'number' && typeof ind.target === 'number' && ind.target !== 0) {
        const pct = Math.max(0, Math.min(150, (ind.current / ind.target) * 100));
        values.push(pct);
      }
    });

    let base = values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 80; // neutral if no KCI yet

    // Simple alert penalty: more active alerts → lower stakeholder score.
    const penalty = Math.min(alerts.length * 3, 30);
    base = Math.max(0, base - penalty);

    return base;
  }

  /** Map a 0–100 score to a multiplier. */
  private mapScoreToFactor(score: number): number {
    if (score <= 50) return 0.4;
    if (score <= 70) return 0.7;
    if (score <= 85) return 1.0;
    if (score <= 100) return 1.1;
    return 1.2;
  }
}
