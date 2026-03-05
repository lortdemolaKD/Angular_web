import {Component, Input, Output, EventEmitter, SimpleChanges} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-radial-selector',
  imports: [CommonModule],
  templateUrl: './radial-selector.html',
  styleUrl: './radial-selector.css',
})
export class RadialSelector<T = any> {
  @Input() items: T[] = [];
  @Input() selected?: T| null;
  @Input() labelFn: (item: T) => string = item => String(item);
  @Output() selectedChange = new EventEmitter<T>();
  ngOnInit() {
    this.selectFirstIfNone();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['items']) {
      this.selectFirstIfNone();
    }
  }
  selectItem(item: T) {
    this.selected = item;
    this.selectedChange.emit(item);
  }
  private selectFirstIfNone() {
    if (!this.selected && this.items.length > 0) {
      this.selectItem(this.items[0]);
    }
  }
}
