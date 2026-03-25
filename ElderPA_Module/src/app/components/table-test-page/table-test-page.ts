import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DynamicFlexTable } from '../dynamic-flex-table/dynamic-flex-table';
import {
  DynamicRow,
  DynamicTableConfig,
  DataTableColumnDef,
} from '../Types';
import { WalkthroughRegistryService } from '../../Services/walkthrough-registry.service';

type ExampleId =
  | 'basic'
  | 'with-caption'
  | 'compact'
  | 'with-search'
  | 'with-pagination'
  | 'empty'
  | 'loading'
  | 'column-defs'
  | 'numeric-align'
  | 'selection-bulk'
  | 'column-visibility'
  | 'frozen-columns'
  | 'column-filters'
  | 'cell-types'
  | 'inline-edit'
  | 'saved-views'
  | 'export-table'
  | 'mobile-cards';

interface TableExample {
  id: ExampleId;
  title: string;
  description: string;
  config: DynamicTableConfig;
  data: DynamicRow[];
  loading?: boolean;
}

@Component({
  selector: 'app-table-test-page',
  standalone: true,
  imports: [CommonModule, DynamicFlexTable, RouterLink],
  templateUrl: './table-test-page.html',
  styleUrl: './table-test-page.css',
})
export class TableTestPage {
  readonly selectedRow = signal<DynamicRow | null>(null);

  constructor(private walkthrough: WalkthroughRegistryService) {
    this.walkthrough.register('/table-test', [
      {
        targetId: 'tableTest.pageTitle',
        title: 'Table Test Page',
        description: 'This page tests the dynamic table component in different configurations.',
      },
      {
        targetId: 'tableTest.examplesGrid',
        title: 'Examples',
        description: 'Scroll through each example section to see different table behaviors.',
      },
      {
        targetId: 'tableTest.backLink',
        title: 'Back to Home',
        description: 'Return to the main dashboard.',
      },
    ]);
  }

  readonly basicData: DynamicRow[] = [
    { id: 1, name: 'Alice', role: 'Admin', status: 'Active' },
    { id: 2, name: 'Bob', role: 'User', status: 'Pending' },
    { id: 3, name: 'Carol', role: 'Editor', status: 'Active' },
  ];

  readonly basicConfig: DynamicTableConfig = {
    ordering: ['id', 'name', 'role', 'status'],
    labelMapping: { id: 'ID', name: 'Name', role: 'Role', status: 'Status' },
    sortable: true,
  };

  readonly withCaptionConfig: DynamicTableConfig = {
    ...this.basicConfig,
    caption: 'Team members',
    ariaLabel: 'Team members table',
  };

  readonly compactConfig: DynamicTableConfig = {
    ...this.basicConfig,
    density: 'compact',
    caption: 'Compact density',
  };

  readonly searchConfig: DynamicTableConfig = {
    ...this.basicConfig,
    search: true,
    searchPlaceholder: 'Search name, role, status…',
    caption: 'With global search',
  };

  readonly paginationConfig: DynamicTableConfig = {
    ...this.basicConfig,
    pagination: true,
    pageSizeOptions: [2, 5, 10],
    caption: 'With pagination (2 rows per page)',
  };

  readonly emptyConfig: DynamicTableConfig = {
    ...this.basicConfig,
    emptyMessage: 'No team members yet.',
    emptyActionLabel: 'Add member',
  };

  readonly loadingConfig: DynamicTableConfig = {
    ...this.basicConfig,
    caption: 'Loading state',
  };

  readonly columnDefsExample: DataTableColumnDef[] = [
    { id: 'id', label: 'ID', type: 'numeric', sortable: true, align: 'end', order: 0 },
    { id: 'name', label: 'Full name', sortable: true, headerTooltip: 'User full name', order: 1 },
    { id: 'role', label: 'Role', sortable: true, order: 2 },
    { id: 'status', label: 'Status', type: 'status', sortable: true, order: 3 },
  ];

  readonly columnDefsConfig: DynamicTableConfig = {
    columnDefs: this.columnDefsExample,
    caption: 'Column definitions (numeric ID, tooltip on name)',
    sortable: true,
  };

  readonly numericAlignData: DynamicRow[] = [
    { product: 'Widget A', price: 12.99, qty: 150, total: 1948.5 },
    { product: 'Widget B', price: 8.5, qty: 320, total: 2720 },
    { product: 'Widget C', price: 24.0, qty: 45, total: 1080 },
  ];

  readonly numericAlignConfig: DynamicTableConfig = {
    columnDefs: [
      { id: 'product', label: 'Product', sortable: true, order: 0 },
      { id: 'price', label: 'Price', type: 'numeric', align: 'end', order: 1 },
      { id: 'qty', label: 'Qty', type: 'numeric', align: 'end', order: 2 },
      { id: 'total', label: 'Total', type: 'numeric', align: 'end', order: 3 },
    ],
    caption: 'Numeric columns right-aligned',
    sortable: true,
  };

  readonly selectionBulkConfig: DynamicTableConfig = {
    ...this.basicConfig,
    selection: 'multiple',
    caption: 'Row selection + bulk actions',
  };

  readonly columnVisibilityConfig: DynamicTableConfig = {
    ...this.basicConfig,
    columnVisibility: true,
    caption: 'Column show/hide',
  };

  readonly frozenColumnsConfig: DynamicTableConfig = {
    ...this.basicConfig,
    frozenColumns: 1,
    caption: 'Frozen first column (scroll horizontally)',
  };

  readonly columnFiltersConfig: DynamicTableConfig = {
    columnDefs: [
      { id: 'id', label: 'ID', sortable: true, filterable: true, order: 0 },
      { id: 'name', label: 'Name', sortable: true, filterable: true, order: 1 },
      { id: 'role', label: 'Role', sortable: true, filterable: true, order: 2 },
      { id: 'status', label: 'Status', sortable: true, filterable: true, order: 3 },
    ],
    caption: 'Per-column filters',
    sortable: true,
  };

  readonly cellTypesData: DynamicRow[] = [
    { id: 1, name: 'Alice', status: 'Active', score: 85, initials: 'Alice' },
    { id: 2, name: 'Bob', status: 'Pending', score: 42, initials: 'Bob' },
    { id: 3, name: 'Carol', status: 'Complete', score: 98, initials: 'Carol' },
  ];

  readonly cellTypesConfig: DynamicTableConfig = {
    columnDefs: [
      { id: 'id', label: 'ID', type: 'numeric', align: 'end', order: 0 },
      { id: 'name', label: 'Name', order: 1 },
      { id: 'initials', label: 'Avatar', type: 'avatar', order: 2 },
      { id: 'status', label: 'Status', type: 'status', options: { Active: 'Active', Pending: 'Pending', Complete: 'Complete' }, order: 3 },
      { id: 'score', label: 'Score', type: 'progress', progressMax: 100, order: 4 },
    ],
    caption: 'Cell types: avatar, status, progress',
    sortable: true,
  };

  readonly inlineEditConfig: DynamicTableConfig = {
    columnDefs: [
      { id: 'id', label: 'ID', type: 'numeric', order: 0 },
      { id: 'name', label: 'Name', editable: true, order: 1 },
      { id: 'role', label: 'Role', editable: true, order: 2 },
      { id: 'status', label: 'Status', order: 3 },
    ],
    caption: 'Inline edit (double-click Name or Role)',
    sortable: true,
  };

  readonly savedViewsConfig: DynamicTableConfig = {
    ...this.basicConfig,
    savedViews: true,
    columnVisibility: true,
    caption: 'Saved views + column visibility',
  };

  readonly exportConfig: DynamicTableConfig = {
    ...this.basicConfig,
    search: true,
    export: true,
    caption: 'Export CSV/Excel (current view)',
  };

  readonly mobileCardsConfig: DynamicTableConfig = {
    ...this.basicConfig,
    mobileCardLayout: true,
    caption: 'Mobile card layout (resize to &lt;768px)',
  };

  readonly examples: TableExample[] = [
    {
      id: 'basic',
      title: 'Basic table',
      description: 'Default table with ordering and sortable headers.',
      config: this.basicConfig,
      data: this.basicData,
    },
    {
      id: 'with-caption',
      title: 'With caption & ARIA',
      description: 'Semantic caption and aria-label for accessibility.',
      config: this.withCaptionConfig,
      data: this.basicData,
    },
    {
      id: 'compact',
      title: 'Compact density',
      description: 'Reduced padding and font size.',
      config: this.compactConfig,
      data: this.basicData,
    },
    {
      id: 'with-search',
      title: 'With search',
      description: 'Global search filters across all columns.',
      config: this.searchConfig,
      data: this.basicData,
    },
    {
      id: 'with-pagination',
      title: 'With pagination',
      description: 'Page size selector and range label.',
      config: this.paginationConfig,
      data: this.basicData,
    },
    {
      id: 'empty',
      title: 'Empty state',
      description: 'Empty message and optional CTA button.',
      config: this.emptyConfig,
      data: [],
    },
    {
      id: 'loading',
      title: 'Loading state',
      description: 'Skeleton/spinner while data loads.',
      config: this.loadingConfig,
      data: this.basicData,
      loading: true,
    },
    {
      id: 'column-defs',
      title: 'Column definitions',
      description: 'Per-column type, alignment, tooltip.',
      config: this.columnDefsConfig,
      data: this.basicData,
    },
    {
      id: 'numeric-align',
      title: 'Numeric alignment',
      description: 'Right-aligned numeric columns.',
      config: this.numericAlignConfig,
      data: this.numericAlignData,
    },
    {
      id: 'selection-bulk',
      title: 'Row selection + bulk actions',
      description: 'Checkboxes, select all on page, bulk toolbar (Clear / Delete).',
      config: this.selectionBulkConfig,
      data: this.basicData,
    },
    {
      id: 'column-visibility',
      title: 'Column show/hide',
      description: 'Columns menu to toggle visible columns.',
      config: this.columnVisibilityConfig,
      data: this.basicData,
    },
    {
      id: 'frozen-columns',
      title: 'Frozen leading column',
      description: 'First column stays fixed when scrolling horizontally.',
      config: this.frozenColumnsConfig,
      data: this.basicData,
    },
    {
      id: 'column-filters',
      title: 'Per-column filters',
      description: 'Filter row under headers; chips and Clear all when active.',
      config: this.columnFiltersConfig,
      data: this.basicData,
    },
    {
      id: 'cell-types',
      title: 'Cell types (badge, avatar, progress)',
      description: 'Avatar initials, status styling, progress bar.',
      config: this.cellTypesConfig,
      data: this.cellTypesData,
    },
    {
      id: 'inline-edit',
      title: 'Inline editing',
      description: 'Double-click Name or Role to edit; Enter to save, Escape to cancel.',
      config: this.inlineEditConfig,
      data: this.basicData,
    },
    {
      id: 'saved-views',
      title: 'Saved views',
      description: 'Save current columns/sort/filters; apply a saved view.',
      config: this.savedViewsConfig,
      data: this.basicData,
    },
    {
      id: 'export-table',
      title: 'Export',
      description: 'Export CSV or Excel (current filtered/sorted data).',
      config: this.exportConfig,
      data: this.basicData,
    },
    {
      id: 'mobile-cards',
      title: 'Mobile card layout',
      description: 'On narrow viewport (&lt;768px) table becomes cards.',
      config: this.mobileCardsConfig,
      data: this.basicData,
    },
  ];

  loadingFor(id: ExampleId): boolean {
    return id === 'loading';
  }

  dataFor(ex: TableExample): DynamicRow[] {
    if (ex.id === 'empty') return [];
    if (ex.id === 'numeric-align') return this.numericAlignData;
    if (ex.id === 'cell-types') return this.cellTypesData;
    return this.basicData;
  }

  onRowClicked(row: DynamicRow): void {
    this.selectedRow.set(row);
  }

  onEmptyAction(): void {
    console.log('Empty action clicked – e.g. open add member dialog');
  }

  onSelectionChange(rows: DynamicRow[]): void {
    if (rows.length === 1) this.selectedRow.set(rows[0]);
    else if (rows.length === 0) this.selectedRow.set(null);
    else this.selectedRow.set(null);
  }

  onBulkAction(event: { action: string; rows: DynamicRow[] }): void {
    console.log('Bulk action:', event.action, event.rows);
  }

  onCellEdit(event: { row: DynamicRow; columnId: string; value: unknown; previousValue: unknown }): void {
    console.log('Cell edit:', event.columnId, event.previousValue, '→', event.value);
  }
}
