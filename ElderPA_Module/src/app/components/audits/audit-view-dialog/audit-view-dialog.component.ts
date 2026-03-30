import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom } from 'rxjs';

import { AuditService } from '../../../Services/audit.service';
import { AuditTemplateService } from '../../../Services/audit-template.service';
import { AuditField, AuditInstance, CustomAuditTemplate as ApiCustomAuditTemplate } from '../../Types';
import { AuditResponse, CustomAuditTemplate } from '../../flexible-template-system/shared/models/template.models';
import { FormRendererComponent } from '../../flexible-template-system/modes/form-mode/form-renderer.component';
import { buildCustomResponsesFromQuestions } from '../shared/custom-audit-responses.util';

function mergeAuditResponsesFromPayload(audit: AuditInstance): Record<string, any> {
  let responses = buildCustomResponsesFromQuestions(audit.questions);
  const stored = (audit as any).responses ?? (audit as any).formResponse;
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    const nested = (stored as any).responses;
    const flat = nested && typeof nested === 'object' ? nested : stored;
    if (flat && typeof flat === 'object' && !Array.isArray(flat)) {
      responses = { ...responses, ...flat };
    }
  }
  return responses;
}

export interface AuditViewDialogData {
  auditId: string;
}

@Component({
  selector: 'app-audit-view-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, FormRendererComponent],
  templateUrl: './audit-view-dialog.component.html',
  styleUrl: './audit-view-dialog.component.css',
})
export class AuditViewDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<AuditViewDialogComponent>);
  private readonly auditService = inject(AuditService);
  private readonly templateService = inject(AuditTemplateService);
  readonly data = inject<AuditViewDialogData>(MAT_DIALOG_DATA);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly audit = signal<AuditInstance | null>(null);
  readonly apiTemplate = signal<ApiCustomAuditTemplate | null>(null);

  readonly isCustomAudit = computed(() => {
    const a = this.audit();
    if (!a) return false;
    return (a.questions ?? []).some((q: any) => !!q?.customFields) || (a as any).auditType === 'custom-template';
  });

  readonly formTemplate = computed<CustomAuditTemplate | null>(() => {
    const api = this.apiTemplate();
    if (api) return { ...api, type: api.type ?? 'audit' } as CustomAuditTemplate;

    // Fallback: build a synthetic template from the audit questions so table data still renders
    // even when templateId is missing or not a custom template.
    const a = this.audit();
    if (!a) return null;
    const questions = a.questions ?? [];
    if (!questions.length) return null;

    const fields: AuditField[] = questions.map((q: any, i: number) => {
      const custom = q?.customFields;
      const fieldType = (custom?.fieldType as string | undefined) ?? 'text';
      const id = String(custom?.fieldId ?? q?.templateQuestionId ?? `field-${i}`);
      const label = String(q?.text ?? q?.clauseLabel ?? `Field ${i + 1}`);
      const base: any = { id, label, required: false };
      if (fieldType === 'table') return { ...base, type: 'table', tableConfig: custom?.tableConfig } as any;
      if (fieldType === 'checkbox') return { ...base, type: 'checkbox' } as any;
      if (fieldType === 'textarea') return { ...base, type: 'textarea' } as any;
      if (fieldType === 'number') return { ...base, type: 'number' } as any;
      if (fieldType === 'date') return { ...base, type: 'date' } as any;
      if (fieldType === 'question') return { ...base, type: 'question' } as any;
      return { ...base, type: 'text' } as any;
    });

    return {
      id: String((a as any).templateId ?? (a as any).id ?? (a as any)._id ?? 'audit-synth'),
      name: String(a.title ?? 'Audit'),
      type: 'audit',
      fields,
      status: 'active',
    } as unknown as CustomAuditTemplate;
  });

  readonly existingResponse = computed<AuditResponse | null>(() => {
    const a = this.audit();
    if (!a) return null;
    return {
      id: String((a as any).id ?? (a as any)._id ?? ''),
      templateId: String((a as any).templateId ?? ''),
      date: a.date,
      responses: mergeAuditResponsesFromPayload(a),
    };
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const auditId = String(this.data?.auditId ?? '').trim();
      if (!auditId) throw new Error('Missing auditId');

      const a = await firstValueFrom(this.auditService.get(auditId));
      this.audit.set(a ?? null);

      const templateId = String((a as any)?.templateId ?? '').trim();
      if (templateId && this.isCustomAudit()) {
        try {
          const tmpl = await firstValueFrom(this.templateService.getCustom(templateId));
          this.apiTemplate.set(tmpl ?? null);
        } catch {
          // If the template isn't a custom template, fall back to synthetic.
          this.apiTemplate.set(null);
        }
      } else {
        this.apiTemplate.set(null);
      }
    } catch (e: any) {
      this.error.set(e?.message ? String(e.message) : 'Failed to load audit.');
    } finally {
      this.loading.set(false);
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}

