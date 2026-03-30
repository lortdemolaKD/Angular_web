import { Component, Input, Output, EventEmitter, Signal, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuditInstance, DataTableColumnDef, DynamicRow, DynamicTableConfig } from '../../Types';
import { DynamicFlexTable } from '../../dynamic-flex-table/dynamic-flex-table';
import { isAuditLibDebug } from '../audit-lib-debug';
import {
  type AuditListGroupMode,
  filterAuditsByDateRange,
  buildAuditGroupSections,
} from './audit-list-grouping';

/** Same title is used for each period (e.g. Feb vs Mar); show scheduled date in the Name column. */
function auditListDisplayName(a: AuditInstance): string {
  const title = a.title?.trim() || '';
  const date = a.date || '';
  if (!title) return `${String(a.auditType)} · ${date || '—'}`;
  if (title.toLowerCase() === 'monthly worker timetable' && date) {
    return `${title} · ${date}`;
  }
  return title;
}

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

  readonly groupMode = signal<AuditListGroupMode>('none');
  /** Inclusive `yyyy-mm-dd`; empty = no bound */
  readonly dateRangeFrom = signal<string>('');
  readonly dateRangeTo = signal<string>('');

  readonly groupModeOptions: { value: AuditListGroupMode; label: string }[] = [
    { value: 'none', label: 'None (flat list)' },
    { value: 'template', label: 'By template' },
    { value: 'month', label: 'By month' },
    { value: 'status', label: 'By status' },
    { value: 'scoreBand', label: 'By score' },
  ];

  tableConfig: DynamicTableConfig = {
    sortable: true,
    density: 'compact',
    /** Percent widths + low mins keep the grid inside narrow sidebars; text wraps in cells. */
    columnDefs: [
      { id: 'name', label: 'Name', sortable: true, visible: true, order: 0, minWidth: 48, width: '28%' },
      { id: 'auditType', label: 'Type', sortable: true, visible: true, order: 1, minWidth: 40, width: '12%' },
      { id: 'created', label: 'Created', sortable: true, visible: true, order: 2, minWidth: 44, width: '14%' },
      { id: 'updated', label: 'Updated', sortable: true, visible: true, order: 3, minWidth: 44, width: '14%' },
      { id: 'overallScore', label: 'Score', sortable: true, visible: true, order: 4, minWidth: 36, width: '8%' },
      { id: 'status', label: 'Status', sortable: true, visible: true, order: 5, minWidth: 44, width: '24%' },
    ] satisfies DataTableColumnDef[],
  };

  readonly auditsWithStatus = computed(() =>
    (this.audits?.() ?? []).map((audit) => {
      const allQuestionsHaveEvidence = (audit.questions ?? []).every((q) => (q.evidence ?? []).length > 0);
      return {
        ...audit,
        status: allQuestionsHaveEvidence ? 'Complete' : 'Not Complete',
      } as AuditInstance;
    })
  );

  readonly filteredAudits = computed(() =>
    filterAuditsByDateRange(this.auditsWithStatus(), this.dateRangeFrom(), this.dateRangeTo())
  );

  readonly flatTableData: Signal<DynamicRow[]> = computed(() =>
    this.#auditsToRows(
      this.filteredAudits()
        .slice()
        .sort((a, b) => {
          const da = a.updatedAt || a.createdAt || a.date || '';
          const db = b.updatedAt || b.createdAt || b.date || '';
          return da > db ? -1 : da < db ? 1 : 0;
        })
    )
  );

  readonly groupedTableSections = computed(() => {
    const mode = this.groupMode();
    const filtered = this.filteredAudits();
    if (mode === 'none' || !filtered.length) return null;
    const sections = buildAuditGroupSections(filtered, mode);
    return sections.map((s) => ({
      key: s.key,
      label: s.label,
      rows: this.#auditsToRows(s.audits),
    }));
  });

  readonly hasDateRange = computed(() => !!this.dateRangeFrom().trim() || !!this.dateRangeTo().trim());

  constructor() {
    effect(() => {
      if (!isAuditLibDebug()) return;
      const raw = this.audits();
      const rows = raw.map((a) => ({
        id: String((a as any).id ?? (a as any)._id ?? ''),
        title: String((a as any).title ?? ''),
        companyId: String((a as any).companyId ?? ''),
        locationId: String((a as any).locationId ?? ''),
        auditType: String((a as any).auditType ?? ''),
        questions: (a as any).questions?.length ?? 0,
      }));
      console.log('[AuditLib] audit-list snapshot', { count: raw.length, rows });
    });
  }

  setGroupMode(value: string): void {
    this.groupMode.set(value as AuditListGroupMode);
  }

  /** Include group mode in the track id so changing "Group by" recreates rows and all sections start collapsed. */
  groupSectionTrackId(g: { key: string }): string {
    return `${this.groupMode()}:${g.key}`;
  }

  onDateFromInput(value: string): void {
    this.dateRangeFrom.set(value ?? '');
  }

  onDateToInput(value: string): void {
    this.dateRangeTo.set(value ?? '');
  }

  clearDateRange(): void {
    this.dateRangeFrom.set('');
    this.dateRangeTo.set('');
  }

  #auditsToRows(audits: AuditInstance[]): DynamicRow[] {
    return audits.map((a) => ({
      id: a.id,
      name: auditListDisplayName(a),
      auditType: a.auditType,
      created: a.createdAt || a.date || '—',
      updated: a.updatedAt || '—',
      overallScore: a.overallScore != null && a.overallScore > 0 ? a.overallScore + '%' : '—',
      status: a.status ?? '',
    }));
  }

  onRowClicked(row: DynamicRow) {
    const rowId = row['id'] || row['_id'] || row['auditId'];
    if (isAuditLibDebug()) {
      console.log('[AuditLib] row click', { rowId, row });
    }

    const audit =
      this.filteredAudits().find((a) => (a.id || a._id) === rowId) ??
      this.auditsWithStatus().find((a) => (a.id || a._id) === rowId);

    if (isAuditLibDebug()) {
      console.log('[AuditLib] resolve audit', {
        foundId: audit?.id ?? audit?._id,
        ids: this.filteredAudits().map((a) => a.id || a._id),
      });
    }

    if (audit) {
      this.auditSelected.emit(audit);
    } else {
      console.error('No audit matches rowId:', rowId);
    }
  }
}
