import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  ViewChild,
  ViewChildren,
  QueryList,
  signal,
  computed, SimpleChanges, OnChanges, OnDestroy, ChangeDetectorRef
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidatorFn,
  ValidationErrors, FormControl
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatMenu, MatMenuContent, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  AuditField,
  CustomAuditTemplate,
  AuditResponse,
  FieldType,
  TableColumnType, TableConfiguration,
} from '../../shared/models/template.models';
import {FormSubmissionData, PdfExportService} from '../../../../Services/pdf-export.service';
import {Subject} from 'rxjs';

@Component({
  selector: 'app-form-renderer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatRadioModule,
    MatSelectModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatCardModule,
    MatDividerModule,
    MatProgressBarModule,
    MatStepperModule,
    MatTooltipModule
  ],
  templateUrl: './form-renderer.component.html',
  styleUrls: ['./form-renderer.component.css']
})
export class FormRendererComponent implements OnInit, OnChanges,OnDestroy {
  @Input() template!: CustomAuditTemplate;
  @Input() existingResponse?: AuditResponse;
  @Input() readonly: boolean = false;
  @Input() showProgress: boolean = true;

  @Output() formSubmit = new EventEmitter<AuditResponse>();
  @Output() formChange = new EventEmitter<{ responses: Record<string, any> }>();
  @Output() formValidationChange = new EventEmitter<{ valid: boolean; errors: string[] }>();
  @Output() formValueChange = new EventEmitter<Record<string, any>>();
  auditForm!: FormGroup;
  tableColumnsDef = new Map<string, string[]>();

  // Progress tracking
  completionPercentage = computed(() => {
    const tmpl = this.templateSignal(); // ← Dependency on signal
    if (!tmpl?.fields || tmpl.fields.length === 0) return 0;
    if (!this.auditForm) return 0;

    const totalFields = tmpl.fields.filter(f => f.type !== 'section').length;
    if (totalFields === 0) return 0;

    let completedFields = 0;
    this.template.fields.forEach(field => {
      if (field.type === 'section') return;
      const control = this.auditForm.get(field.id);
      if (!control) return;
      if (control && control.value !== null && control.value !== '' && control.value !== undefined) {
        if (Array.isArray(control.value) && control.value.length === 0) return;
        completedFields++;
      }
    });

    return Math.round((completedFields / totalFields) * 100);
  });

  // Group fields by section
  fieldSections = computed(() => {
    const tmpl = this.templateSignal(); // ← Dependency on signal
    if (!tmpl?.fields) return [];

    const sections: Array<{ title: string; fields: AuditField[] }> = [];
    let currentSection: { title: string; fields: AuditField[] } = {
      title: 'General',
      fields: []
    };

    tmpl.fields.forEach(field => {
      if (field.type === 'section') {
        if (currentSection.fields.length > 0) sections.push(currentSection);
        currentSection = { title: field.label || 'Untitled Section', fields: [] };
      } else {
        currentSection.fields.push(field);
      }
    });

    if (currentSection.fields.length > 0) sections.push(currentSection);
    return sections;
  });
  private templateSignal = signal<CustomAuditTemplate | null>(null);
  @ViewChildren(MatTable) tables!: QueryList<MatTable<any>>;

  constructor(private fb: FormBuilder,private pdfExportService: PdfExportService,private cdr: ChangeDetectorRef  ) {}
  exportToPdf(): void {
    const submissionData: FormSubmissionData = {
      templateName: this.template.name,
      submittedAt: new Date(),
      submittedBy: 'Current User', // Replace with actual user
      formData: this.auditForm.value,
      fields: this.template.fields
    };

    this.pdfExportService.exportFormToPdf(submissionData);
  }
  private _initialized = false;
  ngOnInit(): void {
    if (this._initialized) return;
    this._initialized = true;
    this.templateSignal.set(this.template);
    this.template.fields.forEach(f => {
      this.initTableConfig(f);
    });
    this.buildForm();
    this.setupFormValueChangeListener();
    // Emit changes on value updates
    this.auditForm.valueChanges.subscribe(values => {
      this.formChange.emit({
        responses: this.getFormValues()
      });

      // Emit validation status
      this.emitValidationStatus();
    });

    // Initial validation emit
    this.emitValidationStatus();

  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['template']) {
      this.templateSignal.set(this.template);
    }

    if (changes['template']?.currentValue && !changes['template'].firstChange) {
      this.rebuildForm();
    }

    // When existingResponse arrives or updates (e.g. after selecting an audit), repopulate the form
    if (changes['existingResponse']?.currentValue && this.template?.fields?.length) {
      if (this.auditForm) {
        this.rebuildForm();
      }
    }
  }
  private rebuildForm(): void {


    // 1. Unsubscribe old events
    this.destroy$.next();
    this.tableColumnsDef.clear();

    // 2. NO: this.auditForm = null!  ← DELETE THIS

    // 3. Reset existing form first (preserves lifecycle)
    if (this.auditForm) {
      this.auditForm.reset();
      Object.keys(this.auditForm.controls).forEach(key => {
        this.auditForm.removeControl(key);
      });
    }

    // 4. Rebuild fresh
    this.template.fields.forEach(f => this.initTableConfig(f));
    this.buildForm();

    // 5. Re-hook
    this.setupFormValueChangeListener();
    this.emitValidationStatus();


  }


  private setupFormValueChangeListener(): void {
    this.auditForm.valueChanges.subscribe(values => {

      this.formValueChange.emit(values);
    });
  }
  /**
   * Build the reactive form based on template fields
   */
  /**
   * Build the reactive form based on template fields
   */
  private buildForm(): void {

    if (!this.template?.fields) {
      console.warn('FORM: No template fields - skipping');
      return;
    }

    const formConfig: { [key: string]: any } = {};
    this.template.fields.forEach(field => {
      if (field.type === 'section') return;

      switch (field.type) {
        case 'text':
        case 'textarea':
        case 'date':
          formConfig[field.id] = [
            { value: this.normalizeScalarValue(this.getExistingValue(field.id), field.type) ?? field.defaultValue ?? '', disabled: this.readonly },
            field.required ? Validators.required : null
          ];
          break;
        case 'number':
          formConfig[field.id] = [
            { value: this.normalizeScalarValue(this.getExistingValue(field.id), field.type) ?? field.defaultValue ?? null, disabled: this.readonly },
            field.required ? Validators.required : null
          ];
          break;

        case 'checkbox':
          if (field.options && field.options.length > 0) {
            // Multiple checkboxes
            const checkboxArray = this.fb.array(
              field.options.map(option =>
                this.fb.control({
                  value: this.isOptionChecked(field.id, option),
                  disabled: this.readonly
                })
              ),
              field.required ? this.requireCheckboxToBeChecked : null
            );
            formConfig[field.id] = checkboxArray;
          } else {
            // Single checkbox
            formConfig[field.id] = [
              { value: this.getExistingValue(field.id) || false, disabled: this.readonly },
              field.required ? Validators.requiredTrue : null
            ];
          }
          break;

        case 'radio':
        case 'select':
          formConfig[field.id] = [
            { value: this.normalizeScalarValue(this.getExistingValue(field.id), 'text') || '', disabled: this.readonly },
            field.required ? Validators.required : null
          ];
          break;

        case 'table':
          if (field.tableConfig) {
            const tableArray = this.fb.array(
              Array(field.tableConfig.rows).fill(null).map((_, rowIndex) => {
                const rowConfig: any = {};
                field.tableConfig!.headers.forEach((header, colIndex) => {
                  let cellValue = this.getTableCellValue(field.id, rowIndex, colIndex);
                  if (cellValue === '' && colIndex === 0 && field.tableConfig?.defaultFirstColumnValues?.[rowIndex]) {
                    cellValue = field.tableConfig.defaultFirstColumnValues[rowIndex];
                  }
                  rowConfig[header] = [{ value: cellValue || '', disabled: this.readonly }];
                });
                return this.fb.group(rowConfig);
              })
            );
            formConfig[field.id] = tableArray;
          }
          break;

        case 'question':
          // Question type with score/evidence
          formConfig[field.id] = this.fb.group({
            score: [
              { value: this.getExistingValue(field.id)?.score || 0, disabled: this.readonly },
              Validators.required
            ],
            evidence: [
              { value: this.getExistingValue(field.id)?.evidence || '', disabled: this.readonly }
            ],
            actionRequired: [
              { value: this.getExistingValue(field.id)?.actionRequired || '', disabled: this.readonly }
            ]
          });
          break;

        default:
          // For any future field types, create a basic control
          formConfig[field.id] = [{ value: '', disabled: this.readonly }];
      }
    });

    this.auditForm = this.fb.group(formConfig);

    // Setup table columns
    this.template.fields
      .filter(f => f.type === 'table' && f.tableConfig)
      .forEach(field => {
        this.tableColumnsDef.set(
          field.id,
          [...field.tableConfig!.headers, 'actions']
        );
      });

  }
  private destroy$ = new Subject<void>();
  ngOnDestroy(): void {  // ← Add this method

    this.destroy$.next();
    this.destroy$.complete();
  }
  /**
   * Initialize table configuration
   */
  initTableConfig(field: AuditField): void {
    if (field.type !== 'table' || !field.tableConfig) return;

    const { headers } = field.tableConfig;
    const existing = field.tableConfig.colTypes ?? [];
    field.tableConfig.colTypes = headers.map((_, i) => existing[i] ?? 'text');
  }

  /**
   * Validators
   */
  private requireCheckboxToBeChecked: ValidatorFn =
    (control: AbstractControl): ValidationErrors | null => {
      const formArray = control as FormArray;
      const checked = formArray.controls.some(c => c.value === true);
      return checked ? null : { required: true };
    };
  trackSection(index: number, section: any): string {
    return `section-${index}-${section?.title || 'unknown'}`;
  }

  trackField(index: number, field: AuditField): string {
    return `field-${index}-${field?.id || 'unknown'}`;
  }

  trackOption(index: number, option: string): string {
    return `option-${index}-${option}`;
  }

  /**
   * Get existing values from response
   */
  private getExistingValue(fieldId: string): any {
    return this.existingResponse?.responses?.[fieldId];
  }

  /**
   * Normalize response value for scalar fields (text, number, date) so objects are not shown as [object Object].
   * Extracts a displayable string/number from question-style objects { score, evidence, value, text }.
   */
  private normalizeScalarValue(value: any, fieldType: string): string | number | null | undefined {
    if (value == null) return value;
    if (typeof value === 'object') {
      if (fieldType === 'number') {
        const n = (value as any).score ?? (value as any).value;
        return typeof n === 'number' ? n : (typeof n === 'string' ? Number(n) : null);
      }
      // Text/textarea/date: prefer evidence, then value, then text; fallback to score as string so we don't show empty
      const evidence = (value as any).evidence;
      if (evidence !== undefined && evidence !== null) return String(evidence);
      const v = (value as any).value;
      if (v !== undefined && v !== null) return typeof v === 'object' ? JSON.stringify(v) : String(v);
      const text = (value as any).text;
      if (text !== undefined && text !== null) return String(text);
      const score = (value as any).score;
      if (score !== undefined && score !== null) return String(score);
      return '';
    }
    return value;
  }

  private isOptionChecked(fieldId: string, option: string): boolean {
    const value = this.getExistingValue(fieldId);
    return Array.isArray(value) ? value.includes(option) : false;
  }

  private getTableCellValue(fieldId: string, rowIndex: number, colIndex: number): string {
    const tableData = this.getExistingValue(fieldId);
    if (!Array.isArray(tableData) || !tableData[rowIndex]) return '';
    const row = tableData[rowIndex];
    if (Array.isArray(row)) {
      const v = row[colIndex];
      return v != null && v !== '' ? String(v) : '';
    }
    if (row && typeof row === 'object') {
      const field = this.template?.fields?.find((f) => f.id === fieldId && f.type === 'table');
      const header = field?.tableConfig?.headers?.[colIndex];
      if (header != null && (row as any)[header] != null && (row as any)[header] !== '') {
        return String((row as any)[header]);
      }
    }
    return '';
  }

  /**
   * Get form values for submission
   */
  private getFormValues(): Record<string, any> {
    const responses: Record<string, any> = {};

    this.template.fields.forEach(field => {
      if (field.type === 'section') return;

      const control = this.auditForm.get(field.id);

      switch (field.type) {
        case 'checkbox':
          if (field.options && field.options.length > 0) {
            const checkboxArray = control as FormArray;
            responses[field.id] = field.options.filter((_, i) =>
              checkboxArray.at(i).value
            );
          } else {
            responses[field.id] = control?.value || false;
          }
          break;

        case 'table':
          const tableArray = control as FormArray;
          responses[field.id] = tableArray.controls.map(row => {
            const rowGroup = row as FormGroup;
            return field.tableConfig!.headers.map(header =>
              rowGroup.get(header)?.value || ''
            );
          });
          break;

        default:
          responses[field.id] = control?.value;
      }
    });

    return responses;
  }

  /**
   * Helper methods for template
   */
  getFieldControl(fieldId: string): AbstractControl | null {
    return this.auditForm.get(fieldId);
  }

  getCheckboxArray(fieldId: string): FormArray<FormControl<boolean>> {
    const control = this.auditForm.get(fieldId);
    return control instanceof FormArray ?
      (control as FormArray<FormControl<boolean>>) :
      new FormArray<FormControl<boolean>>([]);
  }

  getTableFormArray(fieldId: string): FormArray<FormGroup> {
    const control = this.auditForm.get(fieldId);
    return control instanceof FormArray ?
      (control as FormArray<FormGroup>) :
      new FormArray<FormGroup>([]);
  }

  getTableRowGroup(fieldId: string, rowIndex: number): FormGroup {
    return this.getTableFormArray(fieldId).at(rowIndex) as FormGroup;
  }

  /**
   * Add/Remove table rows
   */
  addTableRow(field: AuditField): void {
    if (this.readonly) return;

    const tableArray = this.getTableFormArray(field.id);
    const rowConfig: any = {};
    field.tableConfig!.headers.forEach(header => {
      rowConfig[header] = [''];
    });
    tableArray.push(this.fb.group(rowConfig));
    this.tables.forEach(table => table.renderRows());
  }

  removeTableRow(field: AuditField, rowIndex: number): void {
    if (this.readonly) return;

    const tableArray = this.getTableFormArray(field.id);
    if (tableArray.length > 1) {
      tableArray.removeAt(rowIndex);
    }
    this.tables.forEach(table => table.renderRows());
  }

  /**
   * Get column type for table
   */
  getColumnType(field: AuditField, headerIndex: number): TableColumnType {
    if (!field.tableConfig?.colTypes || !field.tableConfig.colTypes[headerIndex]) {
      return 'text';
    }
    return field.tableConfig.colTypes[headerIndex];
  }

  getIconForType(type: TableColumnType): string {
    switch (type) {
      case 'checkbox': return 'check_box';
      case 'date': return 'calendar_today';
      case 'number': return 'numbers';
      case 'select': return 'list';
      default: return 'text_fields';
    }
  }

  /**
   * Get table columns
   */
  getTableColumns(field: AuditField): string[] {
    const headers = field.tableConfig?.headers || [];
    return this.readonly ? headers : [...headers, 'actions'];
  }

  getDataSource(fieldId: string): AbstractControl[] {
    return [...this.getTableFormArray(fieldId).controls];
  }

  /**
   * Submit handler
   */
  onSubmit(): void {
    if (!this.auditForm.valid) {
      this.auditForm.markAllAsTouched();
      this.emitValidationStatus();
      return;
    }

    const response: AuditResponse = {
      id: this.existingResponse?.id || this.generateId(),
      templateId: this.template.id,
      locationId: this.template.locationId,
      date: new Date().toISOString(),
      responses: this.getFormValues(),
      submittedAt: new Date().toISOString(),
      status: 'submitted'
    };
    this.exportToPdf();
    this.formSubmit.emit(response);
  }

  /**
   * Save draft
   */
  onSaveDraft(): void {
    const response: AuditResponse = {
      id: this.existingResponse?.id || this.generateId(),
      templateId: this.template.id,
      locationId: this.template.locationId,
      date: new Date().toISOString(),
      responses: this.getFormValues(),
      status: 'draft'
    };

    this.formSubmit.emit(response);
  }

  /**
   * Reset form
   */
  onReset(): void {
    if (confirm('Are you sure you want to reset the form? All unsaved changes will be lost.')) {
      this.auditForm.reset();
      this.buildForm();
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility: Check if field is invalid
   */

  isFieldInvalid(fieldId: string): boolean {
    if (!this.auditForm) return false;  // ← ADD
    const control = this.auditForm.get(fieldId);
    return !!(control?.invalid && (control?.dirty || control?.touched));
  }

  /**
   * Get field error message
   */
  getFieldErrorMessage(field: AuditField): string {
    const control = this.auditForm.get(field.id);
    if (control?.hasError('required')) {
      return `${field.label} is required`;
    }
    if (control?.hasError('min')) {
      return `Minimum value is ${control.getError('min').min}`;
    }
    if (control?.hasError('max')) {
      return `Maximum value is ${control.getError('max').max}`;
    }
    return '';
  }

  /**
   * Emit validation status
   */
  private emitValidationStatus(): void {
    const errors: string[] = [];

    this.template.fields.forEach(field => {
      if (field.type === 'section') return;

      const control = this.auditForm.get(field.id);
      if (control?.invalid && (control?.dirty || control?.touched)) {
        errors.push(this.getFieldErrorMessage(field));
      }
    });

    this.formValidationChange.emit({
      valid: this.auditForm.valid,
      errors
    });
  }

  /**
   * Check if section has any errors
   */
  sectionHasErrors(fields: AuditField[]): boolean {
    if (!this.auditForm) return false;  // ← ADD
    return fields.some(field => this.isFieldInvalid(field.id));
  }

  /**
   * Get section completion percentage
   */
  getSectionCompletion(fields: AuditField[]): number {
    if (!this.auditForm || fields.length === 0) return 0;  // ← ADD
    let completed = 0;
    fields.forEach(field => {
      const control = this.auditForm.get(field.id);
      if (!control) return;  // ← ADD
      if (control.value !== null && control.value !== '' && control.value !== undefined) {
        completed++;
      }
    });
    return Math.round((completed / fields.length) * 100);
  }

  getTableColOptions(tableConfig: TableConfiguration | undefined, colIdx: number): string[] {
    if (!tableConfig?.colOptions?.[colIdx]) return [];

    const colOpts = tableConfig.colOptions[colIdx];
    // Handle both: direct array ["Yes", "No"] OR {options: ["Yes", "No"]}
    return Array.isArray(colOpts) ? colOpts : colOpts.options || [];
  }
}
