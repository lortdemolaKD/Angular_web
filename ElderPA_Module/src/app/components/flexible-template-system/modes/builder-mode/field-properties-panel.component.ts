import { Component, Input, Output, EventEmitter, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { AuditField } from '../../../Types';
import { FieldConfigComponent } from './field-config.component';

@Component({
  selector: 'app-field-properties-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatTabsModule,
    MatExpansionModule,
    FieldConfigComponent
  ],
  template: `
    <div class="properties-panel">

      <!-- Panel Header -->
      <div class="panel-header">
        <h3>Properties</h3>
        <div class="header-actions">
          <button
            mat-icon-button
            *ngIf="selectedField()"
            (click)="clearSelection()"
            matTooltip="Deselect field">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Tabs: Properties | Advanced | Help -->
      <mat-tab-group *ngIf="selectedField()" class="properties-tabs" animationDuration="200ms">

        <!-- Properties Tab -->
        <mat-tab label="Properties">
          <div class="tab-content">
            <app-field-config
              [field]="selectedField()"
              (fieldUpdated)="onFieldUpdated($event)"
              (configClosed)="clearSelection()">
            </app-field-config>
          </div>
        </mat-tab>

        <!-- Advanced Tab -->
        <mat-tab label="Advanced">
          <div class="tab-content advanced-content">
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>code</mat-icon>
                  Field JSON
                </mat-panel-title>
              </mat-expansion-panel-header>
              <div class="json-viewer">
                <pre>{{ selectedField() | json }}</pre>
              </div>
              <div class="json-actions">
                <button mat-stroked-button (click)="copyJSON()">
                  <mat-icon>content_copy</mat-icon>
                  Copy JSON
                </button>
              </div>
            </mat-expansion-panel>

            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>info</mat-icon>
                  Metadata
                </mat-panel-title>
              </mat-expansion-panel-header>
              <div class="metadata-content">
                <div class="metadata-row">
                  <span class="label">Field ID:</span>
                  <code>{{ selectedField()?.id }}</code>
                </div>
                <div class="metadata-row">
                  <span class="label">Type:</span>
                  <code>{{ selectedField()?.type }}</code>
                </div>
                <div class="metadata-row">
                  <span class="label">Required:</span>
                  <code>{{ selectedField()?.required ? 'Yes' : 'No' }}</code>
                </div>
                <div class="metadata-row" *ngIf="selectedField()?.options">
                  <span class="label">Options Count:</span>
                  <code>{{ selectedField()?.options?.length }}</code>
                </div>
                <div class="metadata-row" *ngIf="selectedField()?.tableConfig">
                  <span class="label">Table Columns:</span>
                  <code>{{ selectedField()?.tableConfig?.headers?.length }}</code>
                </div>
                <div class="metadata-row" *ngIf="selectedField()?.tableConfig">
                  <span class="label">Table Rows:</span>
                  <code>{{ selectedField()?.tableConfig?.rows }}</code>
                </div>
              </div>
            </mat-expansion-panel>

            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>integration_instructions</mat-icon>
                  Validation Rules
                </mat-panel-title>
              </mat-expansion-panel-header>
              <div class="validation-content">
                <p class="help-text">
                  <mat-icon>info</mat-icon>
                  Validation rules can be configured here in future versions.
                </p>
                <div class="validation-list">
                  <div class="validation-item" *ngIf="selectedField()?.required">
                    <mat-icon color="primary">check_circle</mat-icon>
                    <span>Required field validation enabled</span>
                  </div>
                  <div class="validation-item placeholder" *ngIf="!selectedField()?.required">
                    <mat-icon>radio_button_unchecked</mat-icon>
                    <span>No validation rules configured</span>
                  </div>
                </div>
              </div>
            </mat-expansion-panel>
          </div>
        </mat-tab>

        <!-- Help Tab -->
        <mat-tab label="Help">
          <div class="tab-content help-content">
            <div class="help-section">
              <h4>
                <mat-icon>{{ getIconForFieldType(selectedField()?.type || '') }}</mat-icon>
                {{ getFieldTypeName(selectedField()?.type || '') }}
              </h4>
              <p>{{ getFieldDescription(selectedField()?.type || '') }}</p>
            </div>

            <div class="help-section">
              <h5>Common Properties</h5>
              <ul class="help-list">
                <li><strong>Label:</strong> The display name shown to users</li>
                <li><strong>Required:</strong> Mark field as mandatory</li>
                <li><strong>Placeholder:</strong> Hint text shown in empty fields</li>
              </ul>
            </div>

            <div class="help-section" *ngIf="showFieldSpecificHelp()">
              <h5>Field-Specific Options</h5>
              <div [ngSwitch]="selectedField()?.type">
                <div *ngSwitchCase="'checkbox'">
                  <ul class="help-list">
                    <li>Add multiple options for checkboxes</li>
                    <li>Users can select multiple choices</li>
                    <li>Use for "Select all that apply" questions</li>
                  </ul>
                </div>
                <div *ngSwitchCase="'radio'">
                  <ul class="help-list">
                    <li>Add options for radio buttons</li>
                    <li>Users can select only one choice</li>
                    <li>Use for mutually exclusive options</li>
                  </ul>
                </div>
                <div *ngSwitchCase="'select'">
                  <ul class="help-list">
                    <li>Add options for dropdown menu</li>
                    <li>Users select from a compact list</li>
                    <li>Good for many options to save space</li>
                  </ul>
                </div>
                <div *ngSwitchCase="'table'">
                  <ul class="help-list">
                    <li>Configure column headers and types</li>
                    <li>Set initial number of rows</li>
                    <li>Users can add/remove rows dynamically</li>
                    <li>Column types: text, number, date, checkbox, select</li>
                  </ul>
                </div>
                <div *ngSwitchCase="'question'">
                  <ul class="help-list">
                    <li>Audit-specific field type</li>
                    <li>Includes score (0-5), evidence, and action fields</li>
                    <li>Designed for compliance auditing</li>
                  </ul>
                </div>
              </div>
            </div>

            <div class="help-section tips">
              <h5>
                <mat-icon>lightbulb</mat-icon>
                Tips
              </h5>
              <ul class="help-list">
                <li>Use clear, descriptive labels</li>
                <li>Keep option text concise</li>
                <li>Group related fields with Section headers</li>
                <li>Test your form before deploying</li>
              </ul>
            </div>
          </div>
        </mat-tab>

      </mat-tab-group>

      <!-- Empty State when no field selected -->
      <div *ngIf="!selectedField()" class="empty-help">
        <mat-icon class="empty-icon">touch_app</mat-icon>
        <p class="empty-title">Select a field to configure</p>
        <p class="empty-subtitle">Click on any field in the canvas to edit its properties</p>

        <div class="quick-tips">
          <h5>Quick Tips:</h5>
          <ul>
            <li>Drag fields from the toolbox to add them</li>
            <li>Reorder fields by dragging</li>
            <li>Duplicate fields with the copy button</li>
            <li>Delete unwanted fields</li>
          </ul>
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

    .properties-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--color-surface);
    }

    /* Panel Header */
    .panel-header {
      padding: 16px 20px;
      background: var(--color-surface);
      border-bottom: 1px solid var(--sidebar-hover);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }

    .panel-header h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 500;
      color: var(--color-text);
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    /* Tabs: use min-height 0 so panel can shrink; content area scrolls, buttons stay visible */
    .properties-tabs {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      background: var(--color-surface);
    }

    ::ng-deep .properties-tabs .mat-mdc-tab-body-wrapper {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    ::ng-deep .properties-tabs .mat-mdc-tab-body-content {
      overflow-y: auto;
      height: 100%;
      min-height: 0;
    }

    .tab-content {
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    /* Advanced Tab */
    .advanced-content {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .json-viewer {
      background: var(--sidebar-bg);
      border: 1px solid var(--sidebar-hover);
      border-radius: 4px;
      padding: 12px;
      max-height: 300px;
      overflow: auto;
    }

    .json-viewer pre {
      margin: 0;
      font-family: 'Courier New', monospace;
      font-size: 0.8rem;
      color: var(--color-text);
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .json-actions {
      margin-top: 12px;
      display: flex;
      justify-content: flex-end;
    }

    .metadata-content {
      padding: 12px 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .metadata-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--sidebar-hover);
    }

    .metadata-row:last-child {
      border-bottom: none;
    }

    .metadata-row .label {
      font-weight: 500;
      color: var(--color-text);
      font-size: 0.85rem;
    }

    .metadata-row code {
      background: var(--sidebar-bg);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.8rem;
      color: var(--color-primary);
    }

    .validation-content {
      padding: 12px 0;
    }

    .help-text {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--color-text);
      font-size: 0.85rem;
      margin-bottom: 16px;
    }

    .help-text mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .validation-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .validation-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      background: var(--sidebar-bg);
      border-radius: 4px;
    }

    .validation-item.placeholder {
      opacity: 0.6;
    }

    .validation-item mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .validation-item span {
      font-size: 0.85rem;
    }

    /* Help Tab */
    .help-content {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .help-section {
      background: var(--color-surface);
      padding: 16px;
      border-radius: 8px;
      border: 1px solid var(--sidebar-hover);
    }

    .help-section h4 {
      margin: 0 0 12px 0;
      font-size: 1.1rem;
      font-weight: 500;
      color: var(--color-text);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .help-section h4 mat-icon {
      color: var(--color-primary);
    }

    .help-section h5 {
      margin: 0 0 12px 0;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--color-text);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .help-section p {
      margin: 0;
      color: var(--color-text);
      opacity: 0.9;
      line-height: 1.6;
      font-size: 0.9rem;
    }

    .help-list {
      margin: 0;
      padding-left: 20px;
      color: var(--color-text);
      opacity: 0.9;
      line-height: 1.8;
      font-size: 0.85rem;
    }

    .help-list li {
      margin-bottom: 8px;
    }

    .help-list strong {
      color: var(--color-text);
    }

    .help-section.tips {
      background: var(--color-primary-container);
      border-color: var(--color-primary);
    }

    .help-section.tips h5 {
      color: var(--color-on-primary-container);
    }

    .help-section.tips mat-icon {
      color: var(--color-add-accent);
    }

    /* Empty State */
    .empty-help {
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
      margin: 0 0 24px 0;
      color: var(--color-text);
      opacity: 0.8;
    }

    .quick-tips {
      background: var(--color-surface);
      padding: 20px;
      border-radius: 8px;
      border: 1px solid var(--sidebar-hover);
      text-align: left;
      max-width: 300px;
      width: 100%;
    }

    .quick-tips h5 {
      margin: 0 0 12px 0;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--color-text);
    }

    .quick-tips ul {
      margin: 0;
      padding-left: 20px;
      color: var(--color-text);
      opacity: 0.9;
      line-height: 1.8;
      font-size: 0.85rem;
    }

    .quick-tips li {
      margin-bottom: 8px;
    }

    /* Material Overrides */
    ::ng-deep .mat-mdc-tab-label {
      min-width: 80px !important;
    }

    ::ng-deep .mat-expansion-panel {
      margin-bottom: 8px !important;
    }
  `]
})
export class FieldPropertiesPanelComponent {
  @Input() selectedField = signal<AuditField | null>(null);
  @Output() fieldUpdated = new EventEmitter<AuditField>();
  @Output() selectionCleared = new EventEmitter<void>();

  constructor() {
    // React to field selection changes
    effect(() => {
      const field = this.selectedField();
      if (field) {
        console.log('Field selected for editing:', field.id);
      }
    });
  }

  /**
   * Handle field update from config component
   */
  onFieldUpdated(updatedField: AuditField): void {
    this.fieldUpdated.emit(updatedField);
  }

  /**
   * Clear field selection
   */
  clearSelection(): void {
    this.selectionCleared.emit();
  }

  /**
   * Copy field JSON to clipboard
   */
  async copyJSON(): Promise<void> {
    const field = this.selectedField();
    if (!field) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(field, null, 2));
      // Optional: Show success toast/snackbar
      console.log('Field JSON copied to clipboard');
    } catch (err) {
      console.error('Failed to copy JSON:', err);
    }
  }

  /**
   * Check if field-specific help should be shown
   */
  showFieldSpecificHelp(): boolean {
    const field = this.selectedField();
    if (!field) return false;

    const typesWithSpecificHelp = ['checkbox', 'radio', 'select', 'table', 'question'];
    return typesWithSpecificHelp.includes(field.type);
  }

  /**
   * Utility methods
   */
  getIconForFieldType(type: string): string {
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

  getFieldTypeName(type: string): string {
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

  getFieldDescription(type: string): string {
    const descriptionMap: Record<string, string> = {
      'text': 'Single-line text input field for short answers.',
      'textarea': 'Multi-line text area for longer responses and detailed information.',
      'number': 'Numeric input field with optional min/max validation.',
      'checkbox': 'Allow users to select one or multiple options from a list.',
      'radio': 'Radio buttons for selecting a single option from multiple choices.',
      'select': 'Dropdown menu for selecting from a list of options, saving space.',
      'date': 'Date picker for selecting dates from a calendar interface.',
      'table': 'Dynamic table with configurable columns and types for structured data entry.',
      'question': 'Audit-specific field combining score, evidence, and action tracking.',
      'section': 'Visual divider to organize form into logical sections.'
    };
    return descriptionMap[type] || 'Custom field type.';
  }
}
