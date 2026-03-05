import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import {MatIcon} from '@angular/material/icon';

@Component({
  selector: 'app-panel',
  imports: [CommonModule, MatIcon],
  templateUrl: './panel.html',
  styleUrl: './panel.css',
})
export class Panel {
  @Input() title?: string;

  /** Optional icon in the top strip */
  @Input() icon?: string;

  /** Optional header background color */
  @Input() headerColor: string = 'var(--color-primary, #9a538e)';

  /** Event emitted when header button is clicked */
  @Output() headerClick = new EventEmitter<void>();
  @Input() heightIN: string = 'auto';
  @Input() widthIN: string = 'auto';

}
