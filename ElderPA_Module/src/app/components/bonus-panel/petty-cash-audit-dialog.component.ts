import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

import { FormRendererComponent } from '../flexible-template-system/modes/form-mode/form-renderer.component';
import { AuditInstance, CustomAuditTemplate as ApiCustomAuditTemplate } from '../Types';
import { AuditResponse, CustomAuditTemplate } from '../flexible-template-system/shared/models/template.models';
import { buildCustomResponsesFromQuestions } from '../audits/shared/custom-audit-responses.util';

export interface PettyCashAuditDialogData {
  audit: AuditInstance;
  template: ApiCustomAuditTemplate;
}

@Component({
  selector: 'app-petty-cash-audit-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, FormRendererComponent],
  templateUrl: './petty-cash-audit-dialog.component.html',
  styleUrl: './petty-cash-audit-dialog.component.css',
})
export class PettyCashAuditDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PettyCashAuditDialogComponent>);
  readonly data = inject<PettyCashAuditDialogData>(MAT_DIALOG_DATA);

  /** API templates may omit `type`; FormRenderer expects template.models.CustomAuditTemplate. */
  readonly formTemplate = computed<CustomAuditTemplate>(() => {
    const t = this.data.template;
    return {
      ...t,
      type: t.type ?? 'audit',
    } as CustomAuditTemplate;
  });

  readonly existingResponse = computed<AuditResponse>(() => {
    const audit = this.data.audit;
    const responses = buildCustomResponsesFromQuestions(audit.questions);
    return {
      id: audit.id!,
      templateId: audit.templateId!,
      date: audit.date,
      responses,
    };
  });

  close(): void {
    this.dialogRef.close();
  }
}
