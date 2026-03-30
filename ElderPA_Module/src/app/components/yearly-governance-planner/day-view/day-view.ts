import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import moment from 'moment-timezone';
import {CommonModule, NgFor, NgIf} from '@angular/common';

@Component({
  selector: 'app-day-view',
  imports: [NgFor, NgIf,
    CommonModule,],
  templateUrl: './day-view.html',
  styleUrl: './day-view.css',
})
export class DayView implements OnChanges {
  @Input() events: any[] = [];
  @Input() viewDate!: moment.Moment;
  @Output() openAudit = new EventEmitter<string>();

  hours = Array.from({ length: 24 }, (_, i) => i);
  dayEvents: any[] = [];
  menuOpen = false;
  menuX = 0;
  menuY = 0;
  menuEvents: any[] = [];

  ngOnChanges(): void {
    this.dayEvents = this.events.filter((e) =>
      moment(e.start).isSame(this.viewDate, 'day')
    );
  }

  onEventContextMenu(ev: MouseEvent, event: any): void {
    if (ev.type === 'contextmenu') ev.preventDefault();
    ev.stopPropagation();
    const list = [event].filter((e) => !!e?.auditId);
    if (list.length === 1) {
      this.onOpenAudit(list[0]);
      return;
    }
    this.menuOpen = true;
    this.menuX = ev.clientX;
    this.menuY = ev.clientY;
    this.menuEvents = list;
  }

  closeMenu(): void {
    this.menuOpen = false;
    this.menuEvents = [];
  }

  onOpenAudit(e: any): void {
    const id = String(e?.auditId ?? '').trim();
    if (!id) return;
    this.openAudit.emit(id);
    this.closeMenu();
  }

  protected readonly moment = moment;
}
