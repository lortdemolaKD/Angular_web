export interface BonusStatWeight {
  key: string;          // id used in code, e.g. 'financial', 'stakeholder'
  label: string;        // label for UI
  weight: number;       // fraction 0..1, total should be 1
}

export interface RoleBonusConfig {
  role: string;                 // 'Managers', 'Admins', 'Care staff'
  basePercent: number;          // contractual base bonus
  statWeights: BonusStatWeight[];
}

export const BONUS_CONFIG: RoleBonusConfig[] = [
  {
    role: 'Managers',
    basePercent: 15,
    statWeights: [
      { key: 'financial',   label: 'Financial / revenue KPIs',     weight: 0.75 },
      { key: 'stakeholder', label: 'Stakeholder / quality metrics', weight: 0.25 },
    ],
  },
  {
    role: 'Admins',
    basePercent: 8,
    statWeights: [
      { key: 'financial',   label: 'Financial / revenue KPIs',     weight: 0.75 },
      { key: 'stakeholder', label: 'Stakeholder / quality metrics', weight: 0.25 },
    ],
  },
  {
    role: 'Care staff',
    basePercent: 5,
    statWeights: [
      { key: 'financial',   label: 'Financial / revenue KPIs',     weight: 0.75 },
      { key: 'stakeholder', label: 'Stakeholder / quality metrics', weight: 0.25 },
    ],
  },
];
