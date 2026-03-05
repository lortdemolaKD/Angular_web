import {Component, computed, Input, Signal, signal} from '@angular/core';
import {AuditEvidence, DynamicRow, DynamicTableConfig} from '../../Types';
import {DynamicFlexTable} from '../../dynamic-flex-table/dynamic-flex-table';
import {NgFor, NgIf} from '@angular/common';

@Component({
  selector: 'app-evidence-list',
  imports: [
     DynamicFlexTable
  ],
  templateUrl: './evidence-list.html',
  styleUrl: './evidence-list.css',
})
export class EvidenceList {

  @Input() evidence: Signal<AuditEvidence[]> = signal([]);

  tableConfig: DynamicTableConfig = {
    labelMapping: { id: 'ID', type: 'Type', description: 'Description', uploadedBy: 'Uploaded By', uploadedAt: 'Uploaded At' },
    ordering: ['id', 'type', 'description', 'uploadedBy', 'uploadedAt'],
    sortable: true
  };

  tableData: Signal<DynamicRow[]> = computed(() =>
    this.evidence().map(e => ({
      id: e.id,
      type: e.type,
      description: e.description,
      uploadedBy: e.uploadedBy,
      uploadedAt: e.uploadedAt
    }))
  );
}
