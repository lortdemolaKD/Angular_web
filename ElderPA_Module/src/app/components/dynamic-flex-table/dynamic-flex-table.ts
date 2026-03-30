import {
  Component,
  Input,
  Output,
  EventEmitter,
  Signal,
  signal,
  computed,
} from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import {
  DynamicRow,
  DynamicTableConfig,
  DataTableColumnDef,
  DataTableDensity,
  DataTableViewState,
} from '../Types';

export type SortDirection = 'asc' | 'desc' | 'none';

@Component({
  selector: 'app-dynamic-flex-table',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './dynamic-flex-table.html',
  styleUrl: './dynamic-flex-table.css',
})
export class DynamicFlexTable {
  private readonly _data = signal<DynamicRow[]>([]);
  private readonly _config = signal<DynamicTableConfig>({});
  private readonly _loading = signal(false);
  private readonly _totalCount = signal<number | null>(null);

  readonly sortColumn = signal<string | null>(null);
  readonly sortDirection = signal<SortDirection>('none');
  readonly selectedRowIds = signal<Set<string | number>>(new Set());
  readonly searchQuery = signal('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(25);
  readonly filterValues = signal<Record<string, unknown>>({});
  readonly visibleColumnIds = signal<Set<string>>(new Set());
  readonly columnOrderOverride = signal<string[] | null>(null);
  readonly columnWidths = signal<Record<string, number>>({});
  readonly savedViewsList = signal<DataTableViewState[]>([]);
  readonly editingCell = signal<{ rowId: string | number; colId: string } | null>(null);
  readonly editValue = signal('');
  readonly dragColIndex = signal<number | null>(null);
  readonly columnMenuOpen = signal(false);
  readonly savedViewOpen = signal(false);

  @Input() set data(value: DynamicRow[]) {
    this._data.set(value ?? []);
  }
  @Input() set config(value: DynamicTableConfig) {
    this._config.set(value ?? {});
  }
  @Input() set loading(value: boolean) {
    this._loading.set(!!value);
  }
  @Input() set totalCount(value: number | null) {
    this._totalCount.set(value ?? null);
  }

  @Output() rowClicked = new EventEmitter<DynamicRow>();
  @Output() emptyAction = new EventEmitter<void>();
  @Output() selectionChange = new EventEmitter<DynamicRow[]>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() pageChange = new EventEmitter<{ pageIndex: number; pageSize: number }>();
  @Output() sortChange = new EventEmitter<{ column: string | null; direction: SortDirection }>();
  @Output() filterChange = new EventEmitter<Record<string, unknown>>();
  @Output() cellEdit = new EventEmitter<{ row: DynamicRow; columnId: string; value: unknown; previousValue: unknown }>();
  @Output() bulkAction = new EventEmitter<{ action: string; rows: DynamicRow[] }>();

  readonly dataSignal = this._data;
  readonly configSignal = this._config;
  readonly sortColumnSignal = this.sortColumn;
  readonly sortDirectionSignal = this.sortDirection;
  readonly loadingSignal = this._loading;

  /** Base column definitions (from config) */
  readonly baseColumns: Signal<DataTableColumnDef[]> = computed(() => {
    const cfg = this._config();
    const records = this._data();
    const defs = cfg.columnDefs;
    if (defs?.length) {
      return [...defs];
    }
    const keys = new Set<string>();
    for (const row of records) Object.keys(row).forEach((k) => keys.add(k));
    const ordering = cfg.ordering ?? Array.from(keys);
    const labelMapping = cfg.labelMapping ?? {};
    return ordering
      .filter((key) => keys.has(key))
      .map((id) => ({
        id,
        label: labelMapping[id] ?? id,
        sortable: cfg.sortable ?? true,
        visible: true,
      })) as DataTableColumnDef[];
  });

  /** Effective columns: visibility + order overrides applied */
  readonly columns: Signal<DataTableColumnDef[]> = computed(() => {
    const base = this.baseColumns();
    const visibleSet = this.visibleColumnIds();
    const orderOverride = this.columnOrderOverride();
    let list = visibleSet.size > 0
      ? base.filter((c) => visibleSet.has(c.id))
      : base.filter((c) => c.visible !== false);
    if (orderOverride?.length) {
      const orderMap = new Map(orderOverride.map((id, i) => [id, i]));
      list = [...list].sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99));
    } else {
      list = [...list].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    }
    return list;
  });

  readonly density = computed(() => this._config().density ?? 'comfortable');
  readonly caption = computed(() => this._config().caption ?? null);
  readonly ariaLabel = computed(() => this._config().ariaLabel ?? null);
  readonly stickyHeader = computed(() => this._config().stickyHeader !== false);
  readonly emptyMessage = computed(
    () => this._config().emptyMessage ?? 'No data to display'
  );
  readonly emptyActionLabel = computed(
    () => this._config().emptyActionLabel ?? null
  );
  readonly showSearch = computed(() => !!this._config().search);
  readonly searchPlaceholder = computed(
    () => this._config().searchPlaceholder ?? 'Search…'
  );
  readonly showPagination = computed(() => !!this._config().pagination);
  readonly pageSizeOptions = computed(
    () => this._config().pageSizeOptions ?? [10, 25, 50, 100]
  );
  readonly selectionMode = computed(() => this._config().selection ?? 'none');
  readonly frozenCount = computed(() => this._config().frozenColumns ?? 0);
  readonly showColumnVisibility = computed(() => !!this._config().columnVisibility);
  readonly showColumnReorder = computed(() => !!this._config().columnReorder);
  readonly showColumnResize = computed(() => !!this._config().columnResize);
  readonly showSavedViews = computed(() => !!this._config().savedViews);
  readonly showExport = computed(() => !!this._config().export);
  /** Omit the toolbar row entirely when it would be empty (avoids stray padding/border above the table). */
  readonly showToolbar = computed(
    () =>
      this.showSearch() ||
      this.showColumnVisibility() ||
      this.showSavedViews() ||
      this.showExport()
  );
  readonly mobileCardLayout = computed(() => !!this._config().mobileCardLayout);

  readonly columnIds = computed(() => this.columns().map((c) => c.id));
  readonly allColumnIds = computed(() => this.baseColumns().map((c) => c.id));
  readonly hasSelection = computed(() => this.selectedRowIds().size > 0);
  readonly selectedRows = computed(() => {
    const ids = this.selectedRowIds();
    const data = this._data();
    return data.filter((r) => ids.has(this.getRowId(r)));
  });
  readonly activeFilterEntries = computed(() => {
    const f = this.filterValues();
    return Object.entries(f).filter(([, v]) => v != null && v !== '');
  });
  readonly hasActiveFilters = computed(() => this.activeFilterEntries().length > 0);
  readonly hasFilterableColumns = computed(() =>
    this.columns().some((c) => c.filterable === true)
  );
  readonly allRowsSelected = computed(() => {
    const r = this.rows();
    if (r.length === 0) return false;
    return r.every((row) => this.isSelected(row));
  });

  /** Sorted and filtered rows (before pagination) */
  private readonly sortedFilteredRows: Signal<DynamicRow[]> = computed(() => {
    let base = [...this._data()];
    const query = this.searchQuery().trim().toLowerCase();
    if (query) {
      const colIds = this.columnIds();
      base = base.filter((row) =>
        colIds.some((id) =>
          String(row[id] ?? '').toLowerCase().includes(query)
        )
      );
    }
    const filters = this.filterValues();
    for (const [colId, val] of Object.entries(filters)) {
      if (val == null || val === '') continue;
      const v = String(val).toLowerCase();
      base = base.filter((row) =>
        String(row[colId] ?? '').toLowerCase().includes(v)
      );
    }
    const column = this.sortColumn();
    const direction = this.sortDirection();
    if (!column || direction === 'none') return base;
    return base.sort((a, b) => {
      const x = a[column];
      const y = b[column];
      if (x == null && y != null) return direction === 'asc' ? -1 : 1;
      if (x != null && y == null) return direction === 'asc' ? 1 : -1;
      if (x == null && y == null) return 0;
      if (typeof x === 'number' && typeof y === 'number') {
        return direction === 'asc' ? x - y : y - x;
      }
      const xs = String(x).toLowerCase();
      const ys = String(y).toLowerCase();
      if (xs < ys) return direction === 'asc' ? -1 : 1;
      if (xs > ys) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  });

  /** Rows to display (paginated when pagination enabled) */
  readonly rows: Signal<DynamicRow[]> = computed(() => {
    const all = this.sortedFilteredRows();
    if (!this.showPagination()) return all;
    const size = this.pageSize();
    const start = this.pageIndex() * size;
    return all.slice(start, start + size);
  });

  readonly totalFilteredCount = computed(() => this.sortedFilteredRows().length);
  readonly paginationLabel = computed(() => {
    const total = this._totalCount() ?? this.totalFilteredCount();
    if (!this.showPagination() || total === 0)
      return `${this.totalFilteredCount()} row(s)`;
    const size = this.pageSize();
    const start = this.pageIndex() * size;
    const end = Math.min(start + size, total);
    return `${start + 1}–${end} of ${total}`;
  });

  readonly isEmpty = computed(() => this._data().length === 0 && !this._loading());
  readonly hasDataNoMatches = computed(
    () =>
      this._data().length > 0 &&
      this.sortedFilteredRows().length === 0 &&
      !this._loading()
  );
  readonly showEmptyState = computed(
    () => this.isEmpty() && !this._loading()
  );
  readonly showNoMatchesState = computed(
    () => this.hasDataNoMatches() && !this._loading()
  );

  readonly sortable = computed(() => this._config().sortable !== false);

  toggleSort(columnId: string, column: DataTableColumnDef): void {
    if (column.sortable === false) return;
    const current = this.sortColumn();
    const dir = this.sortDirection();
    let next: SortDirection = 'asc';
    if (current !== columnId) {
      this.sortColumn.set(columnId);
      this.sortDirection.set('asc');
      next = 'asc';
    } else {
      switch (dir) {
        case 'asc':
          this.sortDirection.set('desc');
          next = 'desc';
          break;
        case 'desc':
          this.sortDirection.set('none');
          this.sortColumn.set(null);
          next = 'none';
          break;
        default:
          this.sortDirection.set('asc');
          next = 'asc';
      }
    }
    this.sortChange.emit({
      column: next === 'none' ? null : columnId,
      direction: next,
    });
  }

  getSortIndicator(columnId: string): string {
    if (this.sortColumn() !== columnId) return '↕';
    const d = this.sortDirection();
    return d === 'asc' ? '↑' : d === 'desc' ? '↓' : '↕';
  }

  getSortAriaSort(columnId: string): 'ascending' | 'descending' | 'none' {
    if (this.sortColumn() !== columnId) return 'none';
    const d = this.sortDirection();
    return d === 'asc' ? 'ascending' : d === 'desc' ? 'descending' : 'none';
  }

  onEmptyAction(): void {
    this.emptyAction.emit();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement)?.value ?? '';
    this.searchQuery.set(value);
    this.searchChange.emit(value);
    if (this.showPagination()) this.pageIndex.set(0);
  }

  onPageSizeChange(event: Event): void {
    const size = Number((event.target as HTMLSelectElement)?.value) || 25;
    this.pageSize.set(size);
    this.pageIndex.set(0);
    this.pageChange.emit({ pageIndex: 0, pageSize: size });
  }

  getCellAlign(col: DataTableColumnDef): 'left' | 'center' | 'right' {
    if (col.align === 'end') return 'right';
    if (col.align === 'center') return 'center';
    if (col.type === 'numeric') return 'right';
    return 'left';
  }

  /** Row identity for trackBy and selection (prefer id field) */
  getRowId(row: DynamicRow): string | number {
    return row['id'] ?? row['_id'] ?? JSON.stringify(row);
  }

  /** For cell title attribute (template cannot use global String) */
  cellTitle(value: unknown): string | null {
    return value != null ? `${value}` : null;
  }

  progressWidth(row: DynamicRow, col: DataTableColumnDef): number {
    const v = row[col.id];
    const num = typeof v === 'number' ? v : Number(v);
    const max = col.progressMax ?? 100;
    return Math.min(100, max ? (num / max) * 100 : num);
  }

  isSelected(row: DynamicRow): boolean {
    return this.selectedRowIds().has(this.getRowId(row));
  }

  toggleSelectRow(row: DynamicRow, event?: Event): void {
    if (event) event.stopPropagation();
    const id = this.getRowId(row);
    const set = new Set(this.selectedRowIds());
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this.selectedRowIds.set(set);
    this.emitSelectionChange();
  }

  selectAllOnPage(): void {
    const rows = this.rows();
    const set = new Set(this.selectedRowIds());
    const ids = rows.map((r) => this.getRowId(r));
    const allSelected = ids.every((id) => set.has(id));
    if (allSelected) ids.forEach((id) => set.delete(id));
    else ids.forEach((id) => set.add(id));
    this.selectedRowIds.set(set);
    this.emitSelectionChange();
  }

  clearSelection(): void {
    this.selectedRowIds.set(new Set());
    this.emitSelectionChange();
  }

  private emitSelectionChange(): void {
    this.selectionChange.emit(this.selectedRows());
  }

  setFilter(colId: string, value: unknown): void {
    this.filterValues.update((f) => ({ ...f, [colId]: value }));
    this.filterChange.emit(this.filterValues());
    if (this.showPagination()) this.pageIndex.set(0);
  }

  clearAllFilters(): void {
    this.filterValues.set({});
    this.filterChange.emit({});
    if (this.showPagination()) this.pageIndex.set(0);
  }

  toggleColumnVisible(colId: string): void {
    const set = new Set(this.visibleColumnIds());
    if (set.size === 0) {
      this.allColumnIds().forEach((id) => set.add(id));
    }
    if (set.has(colId)) set.delete(colId);
    else set.add(colId);
    this.visibleColumnIds.set(set);
  }

  isColumnVisible(colId: string): boolean {
    const set = this.visibleColumnIds();
    if (set.size === 0) return true;
    return set.has(colId);
  }

  moveColumn(fromIndex: number, toIndex: number): void {
    const cols = this.columns();
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= cols.length || toIndex >= cols.length) return;
    const order = cols.map((c) => c.id);
    const [removed] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, removed);
    this.columnOrderOverride.set(order);
  }

  onHeaderDragStart(event: DragEvent, colIndex: number): void {
    if (!this.showColumnReorder()) return;
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', String(colIndex));
    }
    this.dragColIndex.set(colIndex);
  }

  onHeaderDragover(event: DragEvent): void {
    if (this.showColumnReorder()) event.preventDefault();
  }

  onHeaderDrop(event: DragEvent, toIndex: number): void {
    if (!this.showColumnReorder()) return;
    event.preventDefault();
    const from = this.dragColIndex();
    if (from !== null) {
      this.moveColumn(from, toIndex);
    }
    this.dragColIndex.set(null);
  }

  setColumnWidth(colId: string, px: number): void {
    this.columnWidths.update((w) => ({ ...w, [colId]: px }));
  }

  getColumnWidth(col: DataTableColumnDef): string | null {
    const w = this.columnWidths()[col.id];
    if (w != null) return `${w}px`;
    return col.width ?? null;
  }

  getColumnLabel(colId: string): string {
    const col = this.columns().find((c) => c.id === colId);
    return col?.label ?? colId;
  }

  saveView(name: string): void {
    const view: DataTableViewState = {
      id: `view-${Date.now()}`,
      name,
      columnOrder: this.columns().map((c) => c.id),
      columnVisibility: {},
      sortColumn: this.sortColumn(),
      sortDirection: this.sortDirection(),
      filters: { ...this.filterValues() },
      density: this.density(),
    };
    this.baseColumns().map((c) => c.id).forEach((id) => {
      view.columnVisibility[id] = this.isColumnVisible(id);
    });
    this.savedViewsList.update((list) => [...list, view]);
    this.savedViewOpen.set(false);
  }

  applyView(view: DataTableViewState): void {
    this.columnOrderOverride.set(view.columnOrder);
    this.visibleColumnIds.set(new Set(Object.keys(view.columnVisibility).filter((k) => view.columnVisibility[k])));
    this.sortColumn.set(view.sortColumn);
    this.sortDirection.set(view.sortDirection);
    this.filterValues.set(view.filters as Record<string, unknown>);
    this.savedViewOpen.set(false);
  }

  startEdit(row: DynamicRow, colId: string): void {
    this.editingCell.set({ rowId: this.getRowId(row), colId });
    this.editValue.set(this.cellTitle(row[colId]) ?? '');
  }

  commitEdit(): void {
    const ed = this.editingCell();
    if (!ed) return;
    const rows = this._data();
    const row = rows.find((r) => this.getRowId(r) === ed.rowId);
    if (row) {
      const prev = row[ed.colId];
      const val = this.editValue();
      const numVal = Number(val);
      const newVal = isNaN(numVal) ? val : numVal;
      row[ed.colId] = newVal;
      this.cellEdit.emit({ row, columnId: ed.colId, value: newVal, previousValue: prev });
    }
    this.editingCell.set(null);
  }

  cancelEdit(): void {
    this.editingCell.set(null);
  }

  isEditing(row: DynamicRow, colId: string): boolean {
    const ed = this.editingCell();
    return ed !== null && ed.colId === colId && ed.rowId === this.getRowId(row);
  }

  exportCSV(): void {
    const cols = this.columns();
    const rows = this.sortedFilteredRows();
    const headers = cols.map((c) => c.label).join(',');
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers, ...rows.map((r) => cols.map((c) => escape(r[c.id])).join(','))];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  exportExcel(): void {
    this.exportCSV();
  }

  onRowClick(row: DynamicRow): void {
    if (this.selectionMode() === 'single') {
      this.selectedRowIds.set(new Set([this.getRowId(row)]));
      this.emitSelectionChange();
    }
    this.rowClicked.emit(row);
  }
}
