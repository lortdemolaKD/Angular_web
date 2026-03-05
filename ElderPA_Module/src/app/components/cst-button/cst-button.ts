import {Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule, NgIf} from '@angular/common';

@Component({
  selector: 'app-cst-button',
  imports: [
    CommonModule
  ],
  templateUrl: './cst-button.html',
  styleUrl: './cst-button.css',
})
export class CSTButton {
  @Input() title?: string;

  /** Optional icon in the top strip */
  @Input() icon?: string;
  @Input() disabled?: boolean = false;

  /** Optional header background color */
  @Input() headerColor: string = 'var(--color-primary, #9a538e)';

  /** Event emitted when header button is clicked */
  @Output() clicked = new EventEmitter<void>();
  @Output() headerClick = new EventEmitter<void>();

  onClick() {
    console.log('CSTButton onClick fired!');
    this.headerClick.emit();
    this.clicked.emit();
  }

}
