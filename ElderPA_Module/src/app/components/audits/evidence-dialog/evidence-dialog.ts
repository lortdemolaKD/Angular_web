import {Component, Inject, signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import {AuditEvidence, AuditInstance} from '../../Types';
import {AuditDataService} from '../../../Services/audit-data.service';

export type EvidenceDialogData = {
  title?: string;
  evidenceSummaryText?: string;
  evidence: AuditEvidence[];
};

export type EvidenceDialogResult = {
  evidenceSummaryText: string;
  evidence: AuditEvidence[];
};

@Component({
  selector: 'app-evidence-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './evidence-dialog.html',
  styleUrls: ['./evidence-dialog.css']
})
export class EvidenceDialog {
  evidenceSummaryText = '';
  evidence: AuditEvidence[] = [];
  audits = signal<AuditInstance[]>([]);
  selectedAudit = signal<AuditInstance | null>(null);
  // add form
  newType: 'text' | 'file'| 'audit' = 'text';
  newDescription = '';
  newTextContent = '';
  newFileName = '';
  private pendingAuditId: string | null = null;
  constructor(
    public dialogRef: MatDialogRef<EvidenceDialog>,
    private auditService: AuditDataService,
    @Inject(MAT_DIALOG_DATA) public data: EvidenceDialogData
  ) {
    this.evidenceSummaryText = data.evidenceSummaryText ?? '';
    this.evidence = [...(data.evidence ?? [])];
    this.loadAudits();
  }
  async loadAudits() {
    const audits = await this.auditService.getAuditsByType('baseline');
    this.audits.set(audits ?? []);

  }
  addItem() {
    if (!this.newDescription?.trim() && this.newType === 'text' && !this.newTextContent?.trim()) return;
    if (this.newType === 'file' && !this.newFileName?.trim()) return;
    if (this.newType === 'audit' && !this.selectedAudit()) return;

    const item: AuditEvidence = {
      id: crypto.randomUUID(),
      type: this.newType,
      description: this.newDescription?.trim() || undefined,
      content: this.newType === 'text' ? (this.newTextContent ?? '') : undefined,
      fileUrl: this.newType === 'file' ? this.newFileName.trim() : undefined,
      uploadedAt: new Date().toISOString()
    };

    this.evidence = [...this.evidence, item];

    // reset
    this.newType = 'text';
    this.newDescription = '';
    this.newTextContent = '';
    this.newFileName = '';
  }

  removeItem(id: string) {
    this.evidence = this.evidence.filter(e => e.id !== id);
  }

  clearAll() {
    this.evidence = [];
  }

  save() {
    const result: EvidenceDialogResult = {
      evidenceSummaryText: this.evidenceSummaryText ?? '',
      evidence: this.evidence
    };
    this.dialogRef.close(result);
  }

  cancel() {
    this.dialogRef.close();
  }

  onAuditIdSelected(auditId: string | null) {
    if (!auditId) return;
    const audit = this.audits().find(a => a.id === auditId);
    if (audit) this.selectAudit(audit);
    console.log(this.newType);
  }
  selectAudit(audit: AuditInstance) {
    this.selectedAudit.set(audit);
  }
}
