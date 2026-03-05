import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuditInstance, AuditTemplate, CustomAuditTemplate } from '../components/Types';
import { AuditService } from './audit.service';

export type AuditFrequency =
  | 'Daily'
  | 'Weekly'
  | 'Monthly'
  | 'Quarterly'
  | 'Annually'
  | 'AdHoc';

export interface GenerateRecurringOptions {
  template: AuditTemplate | CustomAuditTemplate;
  templateId: string;
  startDate: string; // ISO yyyy-MM-dd
  monthsAhead: number;
  frequency: AuditFrequency;
  auditType: AuditInstance['auditType'];
  locationId?: string | null;
  departmentId?: string | null;
  subDepartmentId?: string | null;
  title?: string | null;
  existingAudits: AuditInstance[];
}

@Injectable({ providedIn: 'root' })
export class RecurringAuditService {
  constructor(private auditService: AuditService) {}

  async generateRecurringAudits(options: GenerateRecurringOptions): Promise<void> {
    const {
      template,
      templateId,
      startDate,
      monthsAhead,
      frequency,
      auditType,
      locationId,
      departmentId,
      subDepartmentId,
      title,
      existingAudits,
    } = options;

    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return;

    const until = new Date(start);
    until.setMonth(until.getMonth() + monthsAhead);

    const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
    const addPeriod = (d: Date, f: AuditFrequency) => {
      const x = new Date(d);
      switch (f) {
        case 'Daily':
          x.setDate(x.getDate() + 1);
          break;
        case 'Weekly':
          x.setDate(x.getDate() + 7);
          break;
        case 'Monthly':
          x.setMonth(x.getMonth() + 1);
          break;
        case 'Quarterly':
          x.setMonth(x.getMonth() + 3);
          break;
        case 'Annually':
          x.setFullYear(x.getFullYear() + 1);
          break;
        case 'AdHoc':
        default:
          x.setMonth(x.getMonth() + 1);
          break;
      }
      return x;
    };

    const normalizeRegulationId = (id: string | null | undefined): string => {
      const raw = (id ?? '').trim();
      if (!raw) return raw;
      if (raw.startsWith('FS-REG-')) return raw;
      const m = /Reg\s*(\d+)/i.exec(raw);
      if (m) return `FS-REG-${m[1]}`;
      return raw;
    };

    const buildRowsFromTemplate = (): AuditInstance['questions'] => {
      const rows: any[] = [];
      if ((template as any).sections) {
        for (const section of (template as any).sections ?? []) {
          for (const q of section.questions ?? []) {
            const regId = q.regulations?.[0]?.id ?? '';
            rows.push({
              templateQuestionId: crypto.randomUUID(),
              regulationId: normalizeRegulationId(regId),
              text: q.text,
              domain: q.domain ?? 'WellLed',
              score: 0,
              evidence: '',
              evidenceSummaryText: '',
              actionRequired: 'None',
              assignedTo: '',
              targetDate: '',
              completed: 'N',
              defaultIncluded: true,
            } as any);
          }
        }
      }
      return rows as any;
    };

    for (let d = new Date(start); d < until; d = addPeriod(d, frequency)) {
      const dateStr = toIsoDate(d);
      const already = existingAudits.some(a =>
        a.date === dateStr &&
        a.auditType === auditType &&
        ((a as any).locationId ?? null) === (locationId ?? null),
      );

      if (already) continue;

      const payload: Partial<AuditInstance> = {
        templateId,
        title: title ?? undefined,
        auditType,
        date: dateStr,
        locationId: locationId ?? undefined,
        departmentId: departmentId ?? undefined,
        subDepartmentId: subDepartmentId ?? undefined,
        questions: buildRowsFromTemplate() as any,
      };

      await firstValueFrom(this.auditService.create(payload));
    }
  }
}

