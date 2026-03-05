import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  signal,
  computed,
  effect,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';


// Builder Mode Components
import { FieldPaletteComponent } from './modes/builder-mode/field-palette.component';
import { FieldCanvasComponent } from './modes/builder-mode/field-canvas.component';
import { FieldPropertiesPanelComponent } from './modes/builder-mode/field-properties-panel.component';

import {AuditField, AuditResponse, CustomAuditTemplate, TemplateType} from './shared/models/template.models';
import {FormRendererComponent} from './modes/form-mode/form-renderer.component';
import {MatFormField, MatHint, MatInput, MatLabel} from '@angular/material/input';
import {FormsModule} from '@angular/forms';

// Form Mode Component (your existing logic)


export type TemplateSystemMode = 'builder' | 'form' | 'preview';

@Component({
  selector: 'app-flexible-template-system',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatButtonToggleModule,
    MatToolbarModule,
    MatDividerModule,
    // Builder mode
    FieldPaletteComponent,
    FieldCanvasComponent,
    FieldPropertiesPanelComponent,
    FormRendererComponent,
    MatFormField,
    MatLabel,
    MatInput,
    MatHint,
    FormsModule,
    // Form mode

  ],
  templateUrl: './flexible-template-system.html',
  styleUrl: './flexible-template-system.css',
})
export class FlexibleTemplateSystem implements OnInit ,OnChanges{

  /**
   * Mode: 'builder' for creating templates, 'form' for filling them out
   */
  @Input() mode: TemplateSystemMode = 'builder';

  /**
   * Template to edit (builder mode) or fill out (form mode)
   */
  @Input() template?: CustomAuditTemplate;

  /**
   * Existing response for editing (form mode only)
   */
  @Input() existingResponse?: AuditResponse;

  /**
   * Builder mode: Auto-save on changes
   */
  @Input() autoSave: boolean = false;
  @Input() locationId: string | null = null;
  /**
   * Events
   */
  @Output() templateSaved = new EventEmitter<CustomAuditTemplate>();
  @Output() templateDeleted = new EventEmitter<CustomAuditTemplate>();
  @Output() formSubmit = new EventEmitter<AuditResponse>();
  @Output() modeChanged = new EventEmitter<TemplateSystemMode>();
  @Output() templateChanged = new EventEmitter<CustomAuditTemplate>();
  @Output() formChange = new EventEmitter<{ responses: Record<string, any> }>();
  private builderTemplateSignal = signal<CustomAuditTemplate | null>(null);
  /**
   * Builder state
   */
  builderFields = signal<AuditField[]>([]);
  selectedFieldId = signal<string | null>(null);
  selectedField = computed(() => {
    const id = this.selectedFieldId();
    if (!id) return null;
    return this.builderFields().find(f => f.id === id) || null;
  });

  /**
   * Template metadata (for builder mode)
   */
  templateName = signal<string>('Untitled Template');
  templateDescription = signal<string>('');
  templateType = signal<TemplateType>('custom');

  /**
   * UI state
   */
  showPreview = signal<boolean>(false);
  hasUnsavedChanges = signal<boolean>(false);
  selectedFieldForPanel = signal<AuditField | null>(null);
  constructor() {
    effect(() => {
      this.selectedFieldForPanel.set(this.selectedField());
    });
  }
  ngOnInit(): void {
    this.initializeMode();
  }
  ngOnChanges(changes: SimpleChanges): void {
    console.log('🔄 FLEX: ngOnChanges:', changes);

    if (changes['template']) {
      console.log('🔄 FLEX: template changed to:', this.template?.name);
      // 1. Update signals immediately (SYNC)


      // 2. Initialize modes IMMEDIATELY (SYNC) - No Promise/setTimeout
      if (this.mode === 'builder') {
        console.log('🔄 FLEX: Sync initBuilderMode');
        this.initBuilderMode();
      }
      if (this.mode === 'form') {
        this.initFormMode();
      }
    }

    if (changes['mode']) {
      console.log('🔄 FLEX: mode changed:', this.mode);
      // Handle mode switch if needed
    }
  }

  onFormValueChange(responses: Record<string, any>): void {
    console.log('Form values changed:', responses);

    // Emit to parent component
    this.formChange.emit({ responses });

    // Optional: Auto-save if enabled
    if (this.autoSave && this.mode === 'form') {
      this.autoSaveDraft(responses);
    }
  }
  private autoSaveTimeout?: number;
  get templateNameInput(): string {
    return this.templateName();
  }

  set templateNameInput(value: string) {
    this.templateName.set(value);
    this.hasUnsavedChanges.set(true);
  }
  private autoSaveDraft(responses: Record<string, any>): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    this.autoSaveTimeout = window.setTimeout(() => {
      console.log('Auto-saving draft...', responses);
      // You could emit a special event or save internally
      // For now, just log
    }, 2000); // 2 second debounce
  }
  /**
   * Initialize component based on mode
   */
  private initializeMode(): void {
    if (this.mode === 'builder') {
      this.initBuilderMode();
    } else if (this.mode === 'form') {
      this.initFormMode();
    }
  }

  /**
   * Initialize builder mode
   */
  private initBuilderMode(): void {
    // 1. CLEAR CANVAS FIRST
    this.builderFields.set([]);
    this.selectedFieldId.set(null);

    const template = this.template || this.builderTemplateSignal();
    if (!template) return;

    // 2. LOAD NEW FIELDS (Next Tick)
    setTimeout(() => {
      // Deep clone to ensure fresh references
      const clonedFields = template.fields.map(f => ({ ...f }));

      this.builderFields.set(clonedFields);

      this.templateName.set(template.name || 'Untitled');
      this.templateDescription.set(template.description || '');
      this.templateType.set(template.type || 'custom');

      console.log('🔄 FLEX: Reset → Loaded', clonedFields.length, 'fields');
    }, 0);
  }

  /**
   * Initialize form mode (existing functionality)
   */
  private initFormMode(): void {
    console.log('🔄 FLEX: initFormMode() - template:', this.template?.name, 'fields:', this.template?.fields?.length);
  }

  /**
   * Switch between modes
   */
  switchMode(newMode: TemplateSystemMode): void {
    if (this.hasUnsavedChanges() && this.mode === 'builder') {
      if (!confirm('You have unsaved changes. Are you sure you want to switch modes?')) {
        return;
      }
    }

    this.mode = newMode;
    this.modeChanged.emit(newMode);
    this.initializeMode();
  }

  /**
   * Handle fields change from canvas
   */
  onFieldsChanged(fields: AuditField[]): void {
    this.builderFields.set(fields);
    this.hasUnsavedChanges.set(true);

    if (this.autoSave) {
      this.saveTemplate();
    }

    // Emit template change
    this.emitTemplateChange();
  }

  /**
   * Handle field selection from canvas
   */
  onFieldSelected(field: AuditField | null): void {
    this.selectedFieldId.set(field?.id || null);
  }

  /**
   * Handle field update from properties panel
   */
  onFieldUpdated(updatedField: AuditField): void {
    const fields = this.builderFields();
    const index = fields.findIndex(f => f.id === updatedField.id);

    if (index !== -1) {
      const updatedFields = [...fields];
      updatedFields[index] = updatedField;
      this.builderFields.set(updatedFields);
      this.hasUnsavedChanges.set(true);

      if (this.autoSave) {
        this.saveTemplate();
      }

      this.emitTemplateChange();
    }
  }

  /**
   * Clear field selection
   */
  onSelectionCleared(): void {
    this.selectedFieldId.set(null);
  }

  /**
   * Save template
   */
  saveTemplate(): void {
    const template: CustomAuditTemplate = {
      id: this.template?.id || this.generateTemplateId(),
      name: this.templateName(),
      description: this.templateDescription(),
      type: this.templateType(),
      fields: [...this.builderFields()],
      locationId: this.locationId ?? '',
      organizationId: this.template?.organizationId,
      metadata: {
        createdBy: this.template?.metadata?.createdBy || 'current-user', // Replace with actual user
        createdAt: this.template?.metadata?.createdAt || new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        version: (this.template?.metadata?.version || 0) + 1,
        category: this.template?.metadata?.category,
        tags: this.template?.metadata?.tags
      },
      status : "active"
    };


    this.templateSaved.emit(template);
    this.hasUnsavedChanges.set(false);
    console.log('Template saved:', template);
  }
  saveTemplateDraft(): void {
    const template: CustomAuditTemplate = {
      id: this.template?.id || this.generateTemplateId(),
      name: this.templateName(),
      description: this.templateDescription(),
      type: this.templateType(),
      fields: [...this.builderFields()],
      locationId: this.locationId ?? '',
      organizationId: this.template?.organizationId,
      metadata: {
        createdBy: this.template?.metadata?.createdBy || 'current-user', // Replace with actual user
        createdAt: this.template?.metadata?.createdAt || new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        version: (this.template?.metadata?.version || 0) + 1,
        category: this.template?.metadata?.category,
        tags: this.template?.metadata?.tags
      },
      status : "draft"
    };


    this.templateSaved.emit(template);
    this.hasUnsavedChanges.set(false);
    console.log('Template saved:', template);
  }
  deleteTemplate(template: CustomAuditTemplate): void {
    if (!confirm(`Delete "${template.name}"? This action cannot be undone.`)) {
      return;
    }

    // Emit to parent (handles API + list refresh)
    this.templateDeleted.emit(template);

    // Optional: Local optimistic remove (if templates[] used locally)
    // this.templates = this.templates.filter(t => t.id !== template.id);
    console.log('Delete emitted:', template.id);
  }

  /**
   * Discard changes
   */
  discardChanges(): void {
    if (!confirm('Are you sure you want to discard all changes?')) {
      return;
    }

    this.initBuilderMode();
    this.hasUnsavedChanges.set(false);
    this.selectedFieldId.set(null);
  }

  /**
   * Toggle preview mode
   */
  togglePreview(): void {
    this.showPreview.set(!this.showPreview());
  }

  /**
   * Generate preview template for testing
   */
  previewTemplate = computed(() => {
    console.log('Generating preview template...');  // Remove this log!
    return {
      id: 'preview-temp',
      name: this.templateName(),
      description: this.templateDescription(),
      type: this.templateType(),
      fields: structuredClone(this.builderFields())  // Deep clone once
    };
  });
  onPreviewFormChange(event: any) {
    // Ignore form changes in preview - breaks the loop!
    // Optional: Sample log
    if (Math.random() < 0.05) console.log('Preview form tick');
  }
  /**
   * Handle form submission (form mode)
   */
  onFormSubmit(response: AuditResponse): void {
    this.formSubmit.emit(response);
  }

  /**
   * Handle form changes (form mode)
   */
  onFormChange(data: any): void {
    // Optional: handle real-time form changes
    console.log('Form changed:', data);
  }

  /**
   * Emit template change event
   */
  private emitTemplateChange(): void {
    const template: CustomAuditTemplate = {
      id: this.template?.id || 'temp',
      name: this.templateName(),
      description: this.templateDescription(),
      type: this.templateType(),
      fields: [...this.builderFields()]
    };
    this.templateChanged.emit(template);
  }

  /**
   * Generate unique template ID
   */
  private generateTemplateId(): string {
    return `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export template as JSON
   */
  exportTemplate(): void {
    const template = this.previewTemplate();
    const dataStr = JSON.stringify(template, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = `${this.templateName()}-${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  /**
   * Import template from JSON
   */
  importTemplate(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const template = JSON.parse(e.target?.result as string) as CustomAuditTemplate;

        // Validate template structure
        if (!template.fields || !Array.isArray(template.fields)) {
          throw new Error('Invalid template structure');
        }

        // Load template
        this.template = template;
        this.initBuilderMode();
        this.hasUnsavedChanges.set(true);

        console.log('Template imported successfully');
      } catch (error) {
        console.error('Failed to import template:', error);
        alert('Failed to import template. Please check the file format.');
      }
    };

    reader.readAsText(file);
  }

  /**
   * Update template metadata
   */
  updateTemplateName(name: string): void {
    this.templateName.set(name);
    this.hasUnsavedChanges.set(true);

  }

  updateTemplateDescription(description: string): void {
    this.templateDescription.set(description);
    this.hasUnsavedChanges.set(true);
  }

  updateTemplateType(type: TemplateType): void {
    this.templateType.set(type);
    this.hasUnsavedChanges.set(true);
  }


  isFormMode(): boolean {
    return this.mode === 'form';
  }
}
