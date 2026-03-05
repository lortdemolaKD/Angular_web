import { Component, Input, Output, EventEmitter, Signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuditInstance, DynamicRow, DynamicTableConfig } from '../../Types';
import { DynamicFlexTable } from '../../dynamic-flex-table/dynamic-flex-table';

@Component({
  selector: 'app-audit-list',
  standalone: true,
  imports: [CommonModule, DynamicFlexTable],
  templateUrl: './audit-list.html',
  styleUrl: './audit-list.css',
})
export class AuditList {
  @Input({ required: true }) audits!: Signal<AuditInstance[]>;
  @Output() auditSelected = new EventEmitter<AuditInstance>();

  tableConfig: DynamicTableConfig = {
    labelMapping: {
      name: 'Name',
      auditType: 'Type',
      created: 'Created',
      updated: 'Updated',
      overallScore: 'Score',
      status: 'Status',
    },
    ordering: ['name', 'auditType', 'created', 'updated', 'overallScore', 'status'],
    sortable: true,
  };

  readonly auditsWithStatus = computed(() =>
    (this.audits?.() ?? []).map(audit => {
      const allQuestionsHaveEvidence = (audit.questions ?? []).every(q => (q.evidence ?? []).length > 0);
      return { ...audit, status: allQuestionsHaveEvidence ? 'Complete' : 'Not Complete' } as AuditInstance;
    })
  );

  readonly tableData: Signal<DynamicRow[]> = computed(() =>
    this.auditsWithStatus()
      .slice()
      .sort((a, b) => {
        const da = a.updatedAt || a.createdAt || a.date || '';
        const db = b.updatedAt || b.createdAt || b.date || '';
        return da > db ? -1 : da < db ? 1 : 0;
      })
      .map(a => ({
        id: a.id,
        name: a.title?.trim() || `${String(a.auditType)} · ${a.date || '—'}`,
        auditType: a.auditType,
        created: a.createdAt || a.date || '—',
        updated: a.updatedAt || '—',
        overallScore: a.overallScore != null && a.overallScore > 0 ? a.overallScore + '%' : '—',
        status: a.status ?? '',
      }))
  );
  private firstEmitDone = false;  // Prevent repeat
  constructor() {
    effect(() => {
      const raw = this.audits();
      console.log('Raw audits sample:', raw.slice(0, 2).map(a => ({ id: a.id, _id: a._id })));
    });
  }

  onRowClicked(row: DynamicRow) {
    const rowId = row['id'] || row['_id'] || row['auditId'];
    console.log('Row clicked ID:', rowId, 'Full row:', row);

    const audit = this.auditsWithStatus().find(a =>
      (a.id || a._id) === rowId
    );

    console.log('Available audit IDs:', this.auditsWithStatus().map(a => a.id || a._id));
    console.log('Found audit:', audit?.id || audit?._id);

    if (audit) {
      this.auditSelected.emit(audit);
    } else {
      console.error('No audit matches rowId:', rowId);
    }
  }


}
