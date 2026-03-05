import {
  Component, Input, Output, EventEmitter, signal, WritableSignal, computed, effect,
  ChangeDetectionStrategy, OnChanges, SimpleChanges, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuditField, FieldType } from '../../../Types'; // Adjust path
import { PaletteItem } from './field-palette.component';
import {MatChip} from '@angular/material/chips';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-field-canvas',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatChip,

  ],
  template: `
    <div class="canvas-container">
      <div class="canvas-header">
        <h3>Form Canvas</h3>
        <span class="field-count">{{ fieldsSignal().length }} field(s)</span>
      </div>

      <!--
        cdkDropList: Defines this as a drop target
        id: Must match the connectedTo in the palette
        cdkDropListConnectedTo: Allows connection back to palette if needed
        (cdkDropListDropped): Handles the drop event
      -->
      <div
        cdkDropList
        #canvasList="cdkDropList"
        id="builder-canvas"
        [cdkDropListData]="fieldsForDropList()"
        [cdkDropListConnectedTo]="['field-palette']"
        (cdkDropListDropped)="onDrop($event)"
        class="canvas-dropzone">

        <!-- Empty State -->
        <div *ngIf="fieldsSignal().length === 0" class="empty-state">
          <mat-icon class="empty-icon">widgets</mat-icon>
          <p class="empty-title">Your canvas is empty</p>
          <p class="empty-subtitle">Drag fields from the toolbox to build your template</p>
        </div>

        <!-- Dropped Fields -->
        <div
          *ngFor="let field of fieldsSignal(); let i = index"
          cdkDrag
          [cdkDragData]="field"
          class="canvas-field-item"
          [class.selected]="selectedFieldIdSignal() === field.id"
          (click)="selectField(field)">

          <!-- Custom Drag Placeholder -->
          <div *cdkDragPlaceholder class="field-placeholder"></div>

          <!-- Field Content -->
          <div class="field-header">
            <div class="field-info">
              <mat-icon class="field-icon">{{ getIconForFieldType(field.type) }}</mat-icon>
              <div class="field-details">
                <span class="field-label">{{ field.label || 'Untitled Field' }}</span>
                <span class="field-meta">{{ getFieldTypeName(field.type) }} • ID: {{ field.id }}</span>
              </div>
            </div>

            <div class="field-actions">
              <button
                mat-icon-button
                (click)="duplicateField(field, $event)"
                matTooltip="Duplicate"
                class="action-btn">
                <mat-icon>content_copy</mat-icon>
              </button>
              <button
                mat-icon-button
                (click)="deleteField(field.id, $event)"
                matTooltip="Delete"
                class="action-btn delete-btn">
                <mat-icon>delete</mat-icon>
              </button>
              <mat-icon class="drag-handle" cdkDragHandle>drag_indicator</mat-icon>
            </div>
          </div>

          <!-- Field Preview (Basic representation) -->
          <div class="field-preview">
            <div [ngSwitch]="field.type" class="preview-content">
              <!-- Text/TextArea -->
              <div *ngSwitchCase="'text'" class="preview-input">
                <input type="text" [placeholder]="field.placeholder || field.label || 'Text input'" disabled>
              </div>
              <div *ngSwitchCase="'textarea'" class="preview-textarea">
                <textarea [placeholder]="field.placeholder || field.label || 'Text area'" rows="3" disabled></textarea>
              </div>

              <!-- Number -->
              <div *ngSwitchCase="'number'" class="preview-input">
                <input type="number" [placeholder]="field.placeholder || field.label || 'Number input'" disabled>
              </div>

              <!-- Date -->
              <div *ngSwitchCase="'date'" class="preview-input">
                <input type="date" disabled>
              </div>

              <!-- Checkbox -->
              <div *ngSwitchCase="'checkbox'" class="preview-options">
                <div *ngFor="let option of field.options || ['Option 1']" class="option-item">
                  <input type="checkbox" disabled>
                  <label>{{ option }}</label>
                </div>
              </div>

              <!-- Radio -->
              <div *ngSwitchCase="'radio'" class="preview-options">
                <div *ngFor="let option of field.options || ['Option 1', 'Option 2']" class="option-item">
                  <input type="radio" [name]="field.id" disabled>
                  <label>{{ option }}</label>
                </div>
              </div>

              <!-- Select -->
              <div *ngSwitchCase="'select'" class="preview-select">
                <select disabled>
                  <option>Select an option</option>
                  <option *ngFor="let option of field.options || ['Option 1', 'Option 2']">{{ option }}</option>
                </select>
              </div>

              <!-- Table -->
              <!-- Table Preview - DYNAMIC -->
              <div *ngSwitchCase="'table'" class="preview-table">
                <table>
                  <thead>
                  <tr>
                    <!--  Dynamic headers -->
                    <th *ngFor="let header of field.tableConfig?.headers; let j = index; trackBy: trackByIndex">
                      {{ header || 'Column ' + (j + 1) }}
                    </th>
                  </tr>
                  </thead>
                  <tbody>
                  <!--  Dynamic rows -->
                  <tr *ngFor="let _ of [].constructor(field.tableConfig?.rows || 1)">
                    <td *ngFor="let header of field.tableConfig?.headers; let colIdx = index">

                      <!--  Render by column type -->
                      <div *ngIf="field.tableConfig?.colTypes?.[colIdx] === 'select'; else simpleCell"
                           class="preview-select-cell">
                        <select disabled>
                          <option>Select...</option>
                          <!--  Dynamic column options -->
                          <option *ngFor="let opt of field.tableConfig?.colOptions?.[colIdx]?.options || ['Option 1']"
                                  [value]="opt">
                            {{ opt }}
                          </option>
                        </select>
                      </div>

                      <ng-template #simpleCell>
                        <!-- Other types: text, number, checkbox, etc. -->
                        <span>{{ header }} Cell</span>
                      </ng-template>

                    </td>
                  </tr>
                  </tbody>
                </table>
              </div>


              <!-- Question (Audit) -->
              <!-- Audit Question Preview -->
              <!-- ✅ UPDATED: Uses REAL field.metadata values -->
              <div *ngSwitchCase="'question'" class="preview-question">
                <!-- Header with REAL metadata -->
                <div class="question-header">
                  <mat-icon>help_outline</mat-icon>
                  <div class="question-meta">
                    <!-- ✅ Uses your saved metadata -->
                    <span class="domain-badge">{{ field.metadata?.domain || 'WellLed' }}</span>
                    <br/>
                    <span class="regulation-tag">{{ field.metadata?.regulationId || 'REG-001' }}</span>
                  </div>
                </div>

                <!-- Question Text -->
                <div class="question-content">
                  <label class="question-label">{{ field.label || 'Audit Question' }}</label>
                </div>

                <!-- Score + Evidence Row -->
                <div class="question-fields">
                  <!-- ✅ Dynamic Score from metadata -->
                  <div class="score-section">
                    <label>Score (0-{{ field.metadata?.scoreMax || 5 }})</label>

                  </div>

                  <div class="evidence-section">
                    <label>Evidence</label>
                    <div class="evidence-preview">
                      <!-- ✅ Empty chips for preview mode -->
                      <mat-chip *ngFor="let evidence of []" disabled>Sample Evidence</mat-chip>

                    </div>
                  </div>

                  <!-- Action Required -->
                  <div class="action-section">
                    <label>Action Required</label>
                    <input type="text"
                           placeholder="None/Update Required/Follow-up"
                           value="None"
                           disabled>
                  </div>


                </div>
              </div>


              <!-- Section Header -->
              <div *ngSwitchCase="'section'" class="preview-section">
                <h4>{{ field.label || 'Section Header' }}</h4>
              </div>

              <!-- Default -->
              <div *ngSwitchDefault class="preview-placeholder">
                <span>{{ field.type }} field</span>
              </div>
            </div>

            <!-- Required Indicator -->
            <div *ngIf="field.required" class="required-badge">
              <mat-icon>error</mat-icon>
              <span>Required</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .canvas-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--color-background);
    }

    .canvas-header {
      padding: 16px 20px;
      background: var(--color-surface);
      border-bottom: 1px solid var(--sidebar-hover);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .canvas-header h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 500;
      color: var(--color-text);
    }

    .field-count {
      font-size: 0.85rem;
      color: var(--color-text);
      background: var(--sidebar-bg);
      padding: 4px 12px;
      border-radius: 12px;
    }

    .canvas-dropzone {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 400px;
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--color-text);
      opacity: 0.8;
      text-align: center;
      padding: 40px;
    }

    .empty-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: var(--sidebar-hover);
      margin-bottom: 16px;
    }

    .empty-title {
      font-size: 1.1rem;
      font-weight: 500;
      margin: 0 0 8px 0;
      color: var(--color-text);
    }

    .empty-subtitle {
      font-size: 0.9rem;
      margin: 0;
      color: var(--color-text);
      opacity: 0.8;
    }

    /* Field Item */
    .canvas-field-item {
      background: var(--color-surface);
      border: 2px solid var(--sidebar-hover);
      border-radius: 8px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .canvas-field-item:hover {
      border-color: var(--sidebar-hover);
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }

    .canvas-field-item.selected {
      border-color: var(--color-primary);
      background: var(--color-primary-container);
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }

    .field-placeholder {
      background: var(--color-primary-container);
      border: 2px dashed var(--color-primary);
      border-radius: 8px;
      min-height: 80px;
      opacity: 0.5;
    }

    /* Field Header */
    .field-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .field-info {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .field-icon {
      color: var(--color-primary);
    }

    .field-details {
      display: flex;
      flex-direction: column;
    }

    .field-label {
      font-weight: 500;
      font-size: 0.95rem;
      color: var(--color-text);
    }

    .field-meta {
      font-size: 0.75rem;
      color: var(--color-text);
      opacity: 0.75;
      margin-top: 2px;
    }

    .field-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .action-btn {
      width: 32px;
      height: 32px;
      color: var(--color-text);
    }

    .action-btn:hover {
      color: var(--color-primary);
      background: var(--color-primary-container);
    }

    .delete-btn:hover {
      color: var(--color-secondary);
      background: var(--color-secondary-container);
    }

    .drag-handle {
      cursor: grab;
      color: var(--color-text);
      opacity: 0.6;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    /* Field Preview */
    .field-preview {
      background: var(--sidebar-bg);
      border: 1px solid var(--sidebar-hover);
      border-radius: 4px;
      padding: 12px;
      position: relative;
    }

    .preview-content {
      opacity: 0.7;
      pointer-events: none;
    }

    .preview-input input,
    .preview-textarea textarea,
    .preview-select select {
      width: 100%;
      padding: 8px;
      border: 1px solid var(--sidebar-hover);
      border-radius: 4px;
      font-size: 0.9rem;
      background: var(--color-surface);
      color: var(--color-text);
    }

    .preview-textarea textarea {
      resize: none;
      font-family: inherit;
    }

    .preview-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .option-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .option-item label {
      font-size: 0.9rem;
      color: var(--color-text);
    }

    .preview-table table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }

    .preview-table th,
    .preview-table td {
      border: 1px solid var(--sidebar-hover);
      padding: 6px 8px;
      text-align: left;
    }

    .preview-table th {
      background: var(--sidebar-bg);
      font-weight: 500;
    }

    .preview-question {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .question-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .question-row label {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--color-text);
    }

    .question-row input,
    .question-row textarea {
      padding: 6px;
      border: 1px solid var(--sidebar-hover);
      border-radius: 4px;
      font-size: 0.85rem;
      background: var(--color-surface);
      color: var(--color-text);
    }

    .preview-section h4 {
      margin: 0;
      font-size: 1.1rem;
      color: var(--color-text);
      border-bottom: 2px solid var(--color-primary);
      padding-bottom: 8px;
    }

    .preview-placeholder {
      padding: 20px;
      text-align: center;
      color: var(--color-text);
      opacity: 0.8;
      font-style: italic;
    }

    .required-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--color-add-accent, #ffc107);
      color: var(--color-on-primary);
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 0.7rem;
      font-weight: 500;
    }

    .required-badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
  `]
})
export class FieldCanvasComponent implements OnChanges  {
  /**
   * Two-way binding for fields array using signals
   */
  private _fields = signal<AuditField[]>([]);
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields'] && changes['fields'].firstChange && this.fields) {
      const value = Array.isArray(this.fields)
        ? this.fields
        : this.fields();

      this._fields.set([...value]);
      this.cdr.markForCheck();
    }

    if (changes['key']) {
      const value = Array.isArray(this.fields)
        ? this.fields
        : this.fields?.() ?? [];

      this._fields.set([...value]);
      this.cdr.markForCheck();
    }
  }

  constructor(private cdr: ChangeDetectorRef) {
    effect(() => {
      console.log('🔄 CANVAS: rendered', this.fieldsSignal().length, 'fields');
    });
  }
  @Input() fields?: WritableSignal<AuditField[]> | AuditField[];
  @Input() key?: string;
  fieldsSignal = computed(() => this._fields());

  @Output() fieldsChange = new EventEmitter<AuditField[]>();

  /**
   * Selected field for editing in properties panel
   */
  private _selectedFieldId = signal<string | null>(null);

// 2. Input from parent (read-only)
  @Input() parentSelectedFieldId: string | null = null;

// 3. Computed: Use internal unless parent overrides
  selectedFieldIdSignal = computed(() =>
    this.parentSelectedFieldId !== undefined ?
      this.parentSelectedFieldId :
      this._selectedFieldId()
  );
  @Output() fieldSelected = new EventEmitter<AuditField | null>();
  trackByIndex(index: number): number {
    return index;
  }

  /**
   * Handle drop events from palette or reordering
   * Fixed type signature to handle both AuditField[] and PaletteItem[]
   */
  onDrop(event: CdkDragDrop<AuditField[]>) {
    const currentFields = this.fieldsSignal();

    // Deselect FIRST, always (prevents stale form during update)
    this._selectedFieldId.set(null);
    this.fieldSelected.emit(null);

    if (event.previousContainer === event.container) {
      const updatedFields = [...currentFields];
      moveItemInArray(updatedFields, event.previousIndex, event.currentIndex);
      this.updateFields(updatedFields);

      // Re-select at new position (safe post-update)
      const newIndex = Math.min(event.currentIndex, updatedFields.length - 1);
      this.selectField(updatedFields[newIndex]);
    } else {
      const dragData = event.item.data;
      if (this.isPaletteItem(dragData)) {
        const newField = this.createFieldFromPaletteItem(dragData);
        const updatedFields = [...currentFields];
        updatedFields.splice(event.currentIndex, 0, newField);
        this.updateFields(updatedFields);

        // Auto-select new (at exact index)
        this.selectField(newField);
      }
    }
  }

  /**
   * Type guard to check if data is PaletteItem
   */
  private isPaletteItem(data: any): data is PaletteItem {
    return data && 'icon' in data && 'description' in data && 'defaultConfig' in data;
  }

  /**
   * Create a new AuditField from a palette item
   */
  private createFieldFromPaletteItem(item: PaletteItem): AuditField {
    const id = this.generateFieldId(item.type as string);
    if (item.type === 'question') {
      return {
        id,
        type: 'question' as FieldType,
        label: item.defaultConfig?.question || 'New Audit Question',
        required: item.defaultConfig?.required ?? true,

        // Audit-specific metadata
        metadata: {
          domain: item.defaultConfig?.domain || 'WellLed',
          regulationId: item.defaultConfig?.regulation || 'REG-001',
          scoreMax: item.defaultConfig?.scoreMax || 5
        },

        // Question sub-structure for scoring/evidence
        validation: {
          score: {
            min: 0,
            max: item.defaultConfig?.scoreMax || 5
          }
        },

        helpText: item.defaultConfig?.helpText || 'CQC audit question with scoring'
      } as AuditField;
    }
    const baseField: AuditField = {
      id,
      type: item.type as FieldType,
      label: item.label,
      required: item.defaultConfig?.required ?? false,
    };

    // Apply type-specific defaults
    if (item.defaultConfig) {
      // Options for checkbox/radio/select
      if (item.defaultConfig.options) {
        baseField.options = [...item.defaultConfig.options];
      }

      // Table config
      if (item.defaultConfig.tableConfig) {
        baseField.tableConfig = {
          headers: [...item.defaultConfig.tableConfig.headers],
          rows: item.defaultConfig.tableConfig.rows,
          colTypes: [...item.defaultConfig.tableConfig.colTypes]
        };
      }

      // Placeholder
      if (item.defaultConfig.placeholder) {
        baseField.placeholder = item.defaultConfig.placeholder;
      }
    }

    return baseField;
  }

  /**
   * Generate unique field ID
   */
  private generateFieldId(type: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `${type}_${timestamp}_${random}`;
  }

  /**
   * Select a field for editing
   */
  selectField(field: AuditField) {
    this._selectedFieldId.set(field.id);
    this.fieldSelected.emit(field);
  }

  /**
   * Duplicate a field
   */
  duplicateField(field: AuditField, event: Event) {
    event.stopPropagation(); // Prevent selection

    const currentFields = this.fieldsSignal();
    const index = currentFields.findIndex(f => f.id === field.id);

    // Deep clone the field
    const duplicated: AuditField = JSON.parse(JSON.stringify(field));
    duplicated.id = this.generateFieldId(field.type);
    duplicated.label = `${field.label} (Copy)`;

    const updatedFields = [...currentFields];
    updatedFields.splice(index + 1, 0, duplicated);
    this.updateFields(updatedFields);

    // Select the new duplicate
    this.selectField(duplicated);
  }

  /**
   * Delete a field
   */
  deleteField(fieldId: string, event: Event) {
    event.stopPropagation(); // Prevent selection

    if (!confirm('Are you sure you want to delete this field?')) {
      return;
    }

    const currentFields = this.fieldsSignal();
    const updatedFields = currentFields.filter(f => f.id !== fieldId);
    this.updateFields(updatedFields);

    // Deselect if deleted field was selected
    if (this._selectedFieldId() === fieldId) {
      this._selectedFieldId.set(null);
      this.fieldSelected.emit(null);
    }
  }
  public fieldsForDropList(): AuditField[] {
    return this._fields();
  }
  /**
   * Update fields and emit change
   */
  private updateFields(fields: AuditField[]) {
    this._fields.set(fields);
    this.fieldsChange.emit(fields);

    this._selectedFieldId.set(null);
    this.fieldSelected.emit(null);
  }

  /**
   * Get icon for field type
   */
  getIconForFieldType(type: FieldType | string): string {
    const iconMap: Record<string, string> = {
      'text': 'short_text',
      'textarea': 'notes',
      'number': 'looks_one',
      'checkbox': 'check_box',
      'radio': 'radio_button_checked',
      'select': 'arrow_drop_down_circle',
      'date': 'calendar_today',
      'table': 'table_chart',
      'question': 'help_outline',
      'section': 'title'
    };
    return iconMap[type] || 'input';
  }

  /**
   * Get friendly name for field type
   */
  getFieldTypeName(type: FieldType | string): string {
    const nameMap: Record<string, string> = {
      'text': 'Short Text',
      'textarea': 'Long Text',
      'number': 'Number',
      'checkbox': 'Checkbox',
      'radio': 'Radio Group',
      'select': 'Dropdown',
      'date': 'Date',
      'table': 'Table',
      'question': 'Audit Question',
      'section': 'Section'
    };
    return nameMap[type] || type;
  }
}
