import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {FieldType} from '../../../Types';


export interface PaletteItem {
  type: FieldType | 'section'; // Added 'section' for structural elements
  label: string;
  icon: string;
  description: string;
  defaultConfig?: any; // Initial config when dropped
}

@Component({
  selector: 'app-field-palette',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="palette-container">
      <div class="palette-header">
        <h3>Toolbox</h3>
        <span class="subtitle">Drag fields to the canvas</span>
      </div>

      <!--
        cdkDropList: Defines this area as a source for draggable items
        cdkDropListConnectedTo: Allows dragging INTO the canvas (passed via Input)
        cdkDropListSortingDisabled: Prevents reordering inside the palette itself
      -->
      <div
        cdkDropList
        id="field-palette"
        [cdkDropListConnectedTo]="connectedTo"
        [cdkDropListData]="availableFields"
        [cdkDropListEnterPredicate]="noReturnPredicate"
        class="palette-list"
        orientation="vertical">

        <div
          *ngFor="let item of availableFields"
          cdkDrag
          [cdkDragData]="item"
          class="palette-item">

          <!-- Custom Drag Preview (what you see while dragging) -->
          <div *cdkDragPreview class="palette-item-preview">
            <mat-icon>{{ item.icon }}</mat-icon>
            <span>{{ item.label }}</span>
          </div>

          <!-- Custom Placeholder (what you see in the list while dragging) -->
          <div *cdkDragPlaceholder class="palette-item-placeholder"></div>

          <!-- Actual Item Content -->
          <mat-icon class="item-icon">{{ item.icon }}</mat-icon>
          <div class="item-info">
            <span class="item-label">{{ item.label }}</span>
            <span class="item-desc">{{ item.description }}</span>
          </div>
          <mat-icon class="drag-handle">drag_indicator</mat-icon>
        </div>

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      background: var(--color-surface);
      border-right: 1px solid var(--sidebar-hover);
    }

    .palette-container {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .palette-header h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 500;
      color: var(--color-text);
    }

    .subtitle {
      font-size: 0.8rem;
      color: var(--color-text);
      opacity: 0.85;
    }

    .palette-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 200px;
    }

    .palette-item {
      display: flex;
      align-items: center;
      padding: 12px;
      background: var(--color-surface);
      border: 1px solid var(--sidebar-hover);
      border-radius: 6px;
      cursor: grab;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      user-select: none;
    }

    .palette-item:hover {
      border-color: var(--color-primary);
      box-shadow: 0 2px 5px rgba(0,0,0,0.15);
      transform: translateY(-1px);
    }

    .palette-item:active {
      cursor: grabbing;
    }

    .item-icon {
      color: var(--color-text);
      margin-right: 12px;
    }

    .item-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .item-label {
      font-weight: 500;
      font-size: 0.9rem;
      color: var(--color-text);
    }

    .item-desc {
      font-size: 0.75rem;
      color: var(--color-text);
      opacity: 0.75;
    }

    .drag-handle {
      color: var(--color-text);
      opacity: 0.5;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* Drag Preview Styles */
    .palette-item-preview {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 20px;
      background: var(--color-surface);
      border-radius: 4px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
      font-weight: 500;
      color: var(--color-primary);
      opacity: 0.9;
    }

    /* Placeholder Styles */
    .palette-item-placeholder {
      opacity: 0;
      min-height: 50px;
    }
  `]
})
export class FieldPaletteComponent {
  /**
   * The ID(s) of the drop lists that this palette can drop items into.
   * This is crucial for the drag-and-drop connection.
   */
  @Input() connectedTo: string[] = [];

  // Define the tools available to drag
  availableFields: PaletteItem[] = [
    {
      type: 'text',
      label: 'Short Text',
      icon: 'short_text',
      description: 'Single line input',
      defaultConfig: { required: false }
    },
    {
      type: 'textarea',
      label: 'Long Text',
      icon: 'notes',
      description: 'Multi-line text area',
      defaultConfig: { required: false, rows: 3 }
    },
    {
      type: 'number',
      label: 'Number',
      icon: 'looks_one', // or '123' if available
      description: 'Numeric input',
      defaultConfig: { required: false }
    },
    {
      type: 'checkbox',
      label: 'Checkbox',
      icon: 'check_box',
      description: 'Single or multiple choices',
      defaultConfig: { options: ['Option 1'], required: false }
    },
    {
      type: 'radio',
      label: 'Radio Group',
      icon: 'radio_button_checked',
      description: 'Single choice from list',
      defaultConfig: { options: ['Option 1', 'Option 2'], required: false }
    },
    {
      type: 'select',
      label: 'Dropdown',
      icon: 'arrow_drop_down_circle',
      description: 'Select from a menu',
      defaultConfig: { options: ['Option 1', 'Option 2'], required: false }
    },
    {
      type: 'date',
      label: 'Date Picker',
      icon: 'calendar_today',
      description: 'Date selection',
      defaultConfig: { required: false }
    },
    {
      type: 'table',
      label: 'Data Table',
      icon: 'table_chart',
      description: 'Dynamic rows and columns',
      defaultConfig: {
        tableConfig: {
          headers: ['Column 1', 'Column 2'],
          rows: 1,
          colTypes: ['text', 'text']
        }
      }
    },
    {
      type: 'question',
      label: 'Audit Question',
      icon: 'help_outline',
      description: 'Score, Evidence, Action',
      defaultConfig: { label: 'New Section',Question: 'New Section', domain:'Welled', required: true }
    },
    {
      type: 'section', // Special type for layout
      label: 'Section Header',
      icon: 'title',
      description: 'Divide form into sections',
      defaultConfig: { label: 'New Section' }
    }
  ];

  /**
   * Predicate function that prevents items from being dropped back into the palette
   * once they are dragged out.
   */
  noReturnPredicate() {
    return false;
  }
}
