import {Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, signal, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import {FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, FormsModule} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { AuditField, FieldType, TableColumnType } from '../../../Types';
import {MatTooltip} from '@angular/material/tooltip';

@Component({
  selector: 'app-field-config',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltip,
    FormsModule
  ],
  template: `
    <div class="config-container">
      <!-- Empty State -->
      <div *ngIf="!field" class="empty-state">
        <mat-icon class="empty-icon">settings</mat-icon>
        <p class="empty-title">No field selected</p>
        <p class="empty-subtitle">Select a field from the canvas to edit its properties</p>
      </div>

      <!-- Field Configuration Form -->
      <div *ngIf="field && configForm" class="config-content">
        <div class="config-header">
          <div class="field-type-badge">
            <mat-icon>{{ getIconForFieldType(field.type) }}</mat-icon>
            <span>{{ getFieldTypeName(field.type) }}</span>
          </div>
          <button mat-icon-button (click)="closeConfig()" matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <form [formGroup]="configForm" class="config-form">

          <!-- Scrollable form fields -->
          <div class="config-form-scroll">
          <!-- Basic Properties -->
          <div class="form-section" >
            <h4 class="section-title">Basic Properties</h4>

            <!-- Field ID (readonly) -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Field ID</mat-label>
              <input matInput formControlName="id" readonly>
              <mat-hint>Auto-generated unique identifier</mat-hint>
            </mat-form-field>

            <!-- Label -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Label</mat-label>
              <input matInput formControlName="label" placeholder="Enter field label">
              <mat-icon matSuffix>label</mat-icon>
            </mat-form-field>

            <!-- Placeholder -->
            <mat-form-field appearance="outline" class="full-width" *ngIf="showPlaceholder()">
              <mat-label>Placeholder</mat-label>
              <input matInput formControlName="placeholder" placeholder="Enter placeholder text">
              <mat-icon matSuffix>text_fields</mat-icon>
            </mat-form-field>

            <!-- Required Toggle -->
            <div class="checkbox-row">
              <mat-checkbox formControlName="required">
                Required Field
              </mat-checkbox>
            </div>
          </div>

          <mat-divider></mat-divider>

          <!-- Options (for checkbox/radio/select) -->
          <!-- Options Section - MUST have formArrayName="options" -->
          <div class="form-section"  *ngIf="showOptions() && configForm">
            <h4 class="section-title">Options</h4>

            <div formArrayName="options" class="options-list" *ngIf="optionsArray">
              <!-- ✅ Null-safe *ngFor -->
              <div
                *ngFor="let option of optionsArray.controls; let i = index"
                class="option-row">

                <mat-form-field appearance="outline" class="option-input">
                  <mat-label>Option {{i + 1}}</mat-label>
                  <input matInput [formControlName]="i" placeholder="Enter option text">
                </mat-form-field>

                <button
                  mat-icon-button
                  color="warn"
                  (click)="removeOption(i)"
                  [disabled]="optionsArray.length === 1">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>

            <!-- ✅ Show add button always when section visible -->
            <button mat-stroked-button (click)="addOption()" class="add-option-btn">
              <mat-icon>add</mat-icon> Add Option
            </button>
          </div>



          <!-- Table Configuration -->
          <div class="form-section" *ngIf="field.type === 'table'">
            <h4 class="section-title">Table Configuration</h4>

            <div class="table-config" *ngIf="tableConfigGroup">
              <div formGroupName="tableConfig">

                <!-- Number of rows -->
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Initial Rows</mat-label>
                  <input matInput type="number" formControlName="rows" min="1" max="50">
                  <mat-hint>Users can add/remove rows later</mat-hint>
                </mat-form-field>

                <!-- Column Headers -->
                <div formArrayName="headers" class="headers-list">
                  <h5>Column Headers</h5>
                  <div *ngFor="let header of headersArray.controls; let i = index" class="header-row">
                    <mat-form-field appearance="outline" class="header-input">
                      <mat-label>Column {{ i + 1 }}</mat-label>
                      <input matInput [formControlName]="i" placeholder="Enter column name">
                    </mat-form-field>

                    <!-- Column Type -->
                    <mat-form-field appearance="outline" class="type-select">
                      <mat-label>Type</mat-label>
                      <mat-select [value]="getColumnType(i)" (selectionChange)="updateColumnType(i, $event.value)">
                        <mat-option value="text">Text</mat-option>
                        <mat-option value="number">Number</mat-option>
                        <mat-option value="date">Date</mat-option>
                        <mat-option value="checkbox">Checkbox</mat-option>
                        <mat-option value="select">Select</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <button
                      mat-icon-button
                      color="warn"
                      (click)="removeHeader(i)"
                      [disabled]="headersArray.length <= 1"
                      matTooltip="Remove column">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>

                <button mat-stroked-button (click)="addHeader()" class="add-header-btn">
                  <mat-icon>add</mat-icon>
                  Add Column
                </button>
                <div class="col-options-section" *ngIf="tableConfigGroup">
                  <h5>Column Options (for Select columns)</h5>

                  <div *ngFor="let header of headersArray.controls; let i = index" class="col-options-group">
                    <div *ngIf="getColumnType(i) === 'select'" class="select-col-options">
                      <h6>Options for Column {{i+1}} ({{headersArray.at(i)?.value || 'Unnamed'}})</h6>

                      <div [formArrayName]="'colOptions'" class="options-container">
                        <div [formArrayName]="i">
                          <div *ngFor="let optCtrl of getColumnOptions(i).controls; let optIdx = index; trackBy: trackByFn"
                               class="option-row">
                            <mat-form-field appearance="outline" class="option-input">
                              <mat-label>Option {{optIdx + 1}}</mat-label>
                              <input matInput [formControlName]="optIdx" placeholder="Enter option text">
                            </mat-form-field>
                            <button mat-icon-button color="warn" (click)="removeColOption(i, optIdx)"
                                    [disabled]="getColumnOptions(i).length === 1">
                              <mat-icon>delete</mat-icon>
                            </button>
                          </div>

                          <button mat-stroked-button (click)="addColOption(i)" class="add-col-opt-btn">
                            <mat-icon>add</mat-icon> Add Option
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="form-section" *ngIf="showAuditConfig()">
            <h4 class="section-title">Audit Question</h4>

            <!-- Domain -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>CQC Domain</mat-label>
              <!-- ⚠️ Note: [ngModel] reading from getter, (ngModelChange) calling update method -->
              <mat-select
                [ngModel]="auditMetadata.domain"
                (ngModelChange)="updateMetadata('domain', $event)"
                [ngModelOptions]="{standalone: true}">
                <mat-option value="Safe">Safe</mat-option>
                <mat-option value="Effective">Effective</mat-option>
                <mat-option value="Caring">Caring</mat-option>
                <mat-option value="Responsive">Responsive</mat-option>
                <mat-option value="WellLed">WellLed</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Regulation ID -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Regulation ID</mat-label>
              <input matInput
                     [ngModel]="auditMetadata.regulationId"
                     (ngModelChange)="updateMetadata('regulationId', $event)"
                     [ngModelOptions]="{standalone: true}"
                     placeholder="e.g. REG-001">
            </mat-form-field>

            <!-- Max Score -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Max Score</mat-label>
              <input matInput type="number" min="0" max="10"
                     [ngModel]="auditMetadata.scoreMax"
                     (ngModelChange)="updateMetadata('scoreMax', $event)"
                     [ngModelOptions]="{standalone: true}">
            </mat-form-field>
          </div>
          <mat-divider></mat-divider>
          </div>
          <!-- /config-form-scroll -->

          <!-- Actions: fixed at bottom of panel -->
          <div class="form-actions">
            <button mat-raised-button color="primary" (click)="saveChanges()" [disabled]="!configForm.valid">
              <mat-icon>save</mat-icon>
              Save Changes
            </button>
            <button mat-stroked-button (click)="resetForm()">
              <mat-icon>refresh</mat-icon>
              Reset
            </button>
          </div>

        </form>
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

    .config-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--color-surface);
      border-left: 1px solid var(--sidebar-hover);
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 40px;
      text-align: center;
      color: var(--color-text);
      opacity: 0.8;
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

    /* Config Content */
    .config-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .config-header {
      padding: 16px 20px;
      background: var(--sidebar-bg);
      border-bottom: 1px solid var(--sidebar-hover);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .field-type-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--color-surface);
      padding: 6px 12px;
      border-radius: 16px;
      border: 1px solid var(--sidebar-hover);
      font-weight: 500;
      color: var(--color-primary);
    }

    .field-type-badge mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .config-form {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .config-form-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 0 20px 20px;
    }

    /* Form Sections */
    .form-section {
      padding: 20px 0;
    }

    .section-title {
      margin: 0 0 16px 0;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--color-text);
      opacity: 0.9;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .full-width {
      width: 100%;
    }

    .checkbox-row {
      margin: 12px 0;
    }

    /* Options */
    .options-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 12px;
    }

    .option-row {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }

    .option-input {
      flex: 1;
    }

    .add-option-btn {
      width: 100%;
    }

    /* Table Config */
    .table-config {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .headers-list h5 {
      margin: 0 0 12px 0;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--color-text);
    }

    .headers-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 12px;
    }

    .header-row {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }

    .header-input {
      flex: 2;
    }

    .type-select {
      flex: 1;
      min-width: 120px;
    }

    .add-header-btn {
      width: 100%;
    }

    /* Actions: pinned to bottom of panel */
    .form-actions {
      display: flex;
      gap: 12px;
      flex-shrink: 0;
      padding: 16px 20px;
      background: var(--color-surface);
      border-top: 1px solid var(--sidebar-hover);
      margin: 0 -20px 0;
    }

    .form-actions button {
      flex: 1;
    }

    /* Material Overrides */
    ::ng-deep .mat-mdc-form-field {
      margin-bottom: 8px;
    }

    mat-divider {
      margin: 0 -20px;
    }
    .col-options-section {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--sidebar-hover);
    }

    .col-options-group {
      margin-bottom: 16px;
    }

    .select-col-options {
      background: var(--sidebar-bg);
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid var(--color-primary);
    }

    .options-container {
      margin-top: 12px;
    }

    .add-col-opt-btn {
      width: 100%;
      margin-top: 8px;
    }

  `]
})
export class FieldConfigComponent implements OnChanges, OnInit {
  @Input() field: AuditField | null = null;
  @Output() fieldUpdated = new EventEmitter<AuditField>();
  @Output() configClosed = new EventEmitter<void>();

  configForm!: FormGroup;

  // Visibility Signals
  showPlaceholder = signal(false);
  showOptions = signal(false);
  showAuditConfig = signal(false);

  constructor(private fb: FormBuilder) {}

  ngOnInit() {
    this.updateVisibilityFlags();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['field'] && this.field) {
      console.log('🔄 Field changed:', this.field.type, this.field.id);

      // ✅ 1. Ensure metadata exists immediately
      if (!this.field.metadata) {
        this.field.metadata = {};
      }

      // ✅ 2. Build form (Table/Options logic)
      this.buildForm();

      // ✅ 3. Update flags
      this.updateVisibilityFlags();
    }
  }

  // ==========================================================
  // 1. DIRECT METADATA HANDLING (Like Table Arrays)
  // ==========================================================

  /**
   * Safe getter for template binding
   */
  get auditMetadata() {
    if (this.field && !this.field.metadata) {
      this.field.metadata = {};
    }
    return this.field?.metadata || {};
  }

  /**
   * Updates metadata directly and emits immediately.
   * This behaves like your table array updates - bypasses the form validation lag.
   */
  updateMetadata(key: string, value: any): void {
    if (!this.field) return;

    // 1. Merge new value
    const newMeta = {
      ...(this.field.metadata || {}),
      [key]: value
    };

    // 2. Create new field reference
    const updatedField = {
      ...this.field,
      metadata: newMeta
    };

    // 3. Update local state & Emit
    this.field = updatedField;
    this.fieldUpdated.emit(this.field);

    console.log('💾 Metadata saved directly:', key, value);
  }


  // ==========================================================
  // 2. REACTIVE FORM HANDLING (Label, Table, Options)
  // ==========================================================

  private buildForm(): void {
    this.configForm = this.fb.group({});
    if (!this.field) return;

    // --- Basic Props ---
    const formConfig: any = {
      id: [{ value: this.field.id, disabled: true }],
      label: [this.field.label, Validators.required],
      required: [this.field.required || false],
      placeholder: [this.field.placeholder || ''],
    };

    // --- Options (Checkbox/Select) ---
    if (this.showOptions()) {
      const fieldOptions = this.field.options || ['Option 1', 'Option 2'];
      formConfig.options = this.fb.array(
        fieldOptions.map(opt => this.fb.control(opt || '', Validators.required))
      );
    }

    // --- Table Config ---
    if (this.field.type === 'table' && this.field.tableConfig) {
      const tableConfig = this.field.tableConfig;
      const numCols = tableConfig.headers?.length || 1;

      formConfig.tableConfig = this.fb.group({
        rows: [tableConfig.rows || 1, [Validators.required, Validators.min(1)]],
        headers: this.fb.array(
          (tableConfig.headers || ['Column 1']).map(h => this.fb.control(h, Validators.required))
        ),
        colTypes: this.fb.array(
          Array(numCols).fill('text').map((_, i) =>
            this.fb.control(tableConfig.colTypes?.[i] || 'text', Validators.required)
          )
        ),
        colOptions: this.fb.array(
          (tableConfig.headers || ['Column 1']).map((_, i) => {
            const savedOpts = tableConfig.colOptions?.[i];
            let optionsArray: string[];
            if (Array.isArray(savedOpts)) {
              optionsArray = savedOpts;
            } else if (savedOpts && typeof savedOpts === 'object' && 'options' in savedOpts) {
              optionsArray = (savedOpts as any).options || ['Option 1'];
            } else {
              optionsArray = ['Option 1', 'Option 2'];
            }
            return this.fb.array(optionsArray.map(opt => this.fb.control(opt || 'Option 1')));
          })
        )
      });
    }

    // Initialize Form
    this.configForm = this.fb.group(formConfig);
  }

  saveChanges(): void {
    if (!this.field || !this.configForm.valid) return;

    // 1. Capture Form Values
    const updatedField: AuditField = {
      ...this.field,
      label: this.configForm.get('label')?.value,
      required: this.configForm.get('required')?.value,
      // Metadata preserved from direct updates
      metadata: this.field.metadata
    };

    if (this.showPlaceholder()) {
      updatedField.placeholder = this.configForm.get('placeholder')?.value;
    }

    if (this.showOptions()) {
      updatedField.options = this.optionsArray.value;
    }

    if (this.field.type === 'table' && this.tableConfigGroup) {
      updatedField.tableConfig = {
        rows: this.tableConfigGroup.get('rows')?.value,
        headers: this.headersArray.value,
        colTypes: this.colTypesControl?.value,
        colOptions: this.colOptionsArray.value
      };
    }

    // NOTE: We do NOT need to read metadata from configForm
    // because updateMetadata() kept this.field.metadata fresh.

    this.fieldUpdated.emit(updatedField);
  }

  // ==========================================================
  // 3. HELPERS & GETTERS
  // ==========================================================

  private updateVisibilityFlags(): void {
    if (!this.field) {
      this.showPlaceholder.set(false);
      this.showOptions.set(false);
      this.showAuditConfig.set(false);
      return;
    }

    const placeholderTypes: FieldType[] = ['text', 'textarea', 'number', 'date'];
    this.showPlaceholder.set(placeholderTypes.includes(this.field.type));

    const optionTypes: FieldType[] = ['checkbox', 'radio', 'select'];
    this.showOptions.set(optionTypes.includes(this.field.type));

    // ✅ Enable Audit Config for Questions
    this.showAuditConfig.set(this.field.type === 'question');
  }

  // --- Option Helpers ---
  get optionsArray(): FormArray {
    const arr = this.configForm.get('options');
    if (arr instanceof FormArray) return arr;
    // Fallback
    if (this.showOptions()) {
      const newArray = this.fb.array((this.field?.options || []).map(o => this.fb.control(o)));
      this.configForm.setControl('options', newArray);
      return newArray;
    }
    return this.fb.array([]);
  }

  addOption(): void {
    if (this.optionsArray) this.optionsArray.push(this.fb.control(`Option ${this.optionsArray.length + 1}`));
  }

  removeOption(index: number): void {
    if (this.optionsArray.length > 1) this.optionsArray.removeAt(index);
  }

  // --- Table Helpers ---
  get tableConfigGroup(): FormGroup | null {
    return this.configForm.get('tableConfig') as FormGroup || null;
  }
  get headersArray(): FormArray {
    return this.tableConfigGroup?.get('headers') as FormArray || this.fb.array([]);
  }
  get colTypesControl() {
    return this.tableConfigGroup?.get('colTypes');
  }
  get colOptionsArray(): FormArray {
    return this.tableConfigGroup?.get('colOptions') as FormArray || this.fb.array([]);
  }

  addHeader(): void {
    if (!this.headersArray || !this.tableConfigGroup) return;
    this.headersArray.push(this.fb.control(`Column ${this.headersArray.length + 1}`));
    const colTypes = this.colTypesControl?.value || [];
    colTypes.push('text');
    this.colTypesControl?.setValue(colTypes);
    this.colOptionsArray.push(this.fb.array(['Option 1', 'Option 2'].map(o => this.fb.control(o))));
  }

  removeHeader(index: number): void {
    if (this.headersArray.length > 1) {
      this.headersArray.removeAt(index);
      const colTypes = [...(this.colTypesControl?.value || [])];
      colTypes.splice(index, 1);
      this.colTypesControl?.setValue(colTypes);
      if (this.colOptionsArray.length > index) this.colOptionsArray.removeAt(index);
    }
  }

  getColumnType(index: number): TableColumnType {
    return (this.colTypesControl?.value || [])[index] || 'text';
  }

  updateColumnType(index: number, type: TableColumnType) {
    const colTypes = [...(this.colTypesControl?.value || [])];
    colTypes[index] = type;
    this.colTypesControl?.setValue(colTypes);

    if (type === 'select') {
      if (!this.colOptionsArray.at(index)) {
        this.colOptionsArray.insert(index, this.fb.array(['Option 1', 'Option 2'].map(o => this.fb.control(o))));
      } else {
        const currentOpts = this.colOptionsArray.at(index) as FormArray;
        if (currentOpts.length === 0) {
          currentOpts.push(this.fb.control('Option 1'));
          currentOpts.push(this.fb.control('Option 2'));
        }
      }
    }
  }

  getColumnOptions(colIndex: number): FormArray {
    return this.colOptionsArray.at(colIndex) as FormArray || this.fb.array([]);
  }

  addColOption(colIndex: number): void {
    this.getColumnOptions(colIndex).push(this.fb.control(`Option ${this.getColumnOptions(colIndex).length + 1}`));
  }

  removeColOption(colIndex: number, optIndex: number): void {
    if (this.getColumnOptions(colIndex).length > 1) {
      this.getColumnOptions(colIndex).removeAt(optIndex);
    }
  }

  trackByFn(index: number, item: any): any { return index; }

  // Reset/Close
  resetForm(): void { this.buildForm(); }
  closeConfig(): void { this.configClosed.emit(); }

  // Utils
  getIconForFieldType(type: FieldType | string): string {
    const iconMap: Record<string, string> = {
      'text': 'short_text', 'textarea': 'notes', 'number': 'looks_one',
      'checkbox': 'check_box', 'radio': 'radio_button_checked', 'select': 'arrow_drop_down_circle',
      'date': 'calendar_today', 'table': 'table_chart', 'question': 'help_outline', 'section': 'title'
    };
    return iconMap[type] || 'input';
  }

  getFieldTypeName(type: FieldType | string): string {
    const nameMap: Record<string, string> = {
      'text': 'Short Text', 'textarea': 'Long Text', 'number': 'Number',
      'checkbox': 'Checkbox', 'radio': 'Radio Group', 'select': 'Dropdown',
      'date': 'Date', 'table': 'Table', 'question': 'Audit Question', 'section': 'Section'
    };
    return nameMap[type] || type;
  }
}
