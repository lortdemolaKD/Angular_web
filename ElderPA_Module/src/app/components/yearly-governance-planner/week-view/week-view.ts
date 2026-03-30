import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import {CommonModule, NgFor, NgIf} from '@angular/common';
import moment from 'moment-timezone';
@Component({
  selector: 'app-week-view',
  imports: [NgFor, NgIf,
    CommonModule,],
  templateUrl: './week-view.html',
  styleUrl: './week-view.css',
})
export class WeekView  implements OnChanges {
  @Input() events: any[] = [];
  @Input() viewDate!: moment.Moment;
  @Output() openAudit = new EventEmitter<string>();

  week: any[] = [];
  hours = Array.from({ length: 24 }, (_, i) => i);
  menuOpen = false;
  menuX = 0;
  menuY = 0;
  menuEvents: any[] = [];

  ngOnChanges(): void {
    this.generateWeek();
  }

  onEventContextMenu(ev: MouseEvent, dayEvents: any[]): void {
    if (!dayEvents?.length) return;
    if (ev.type === 'contextmenu') ev.preventDefault();
    ev.stopPropagation();
    const audits = [...dayEvents].filter((e) => !!e?.auditId);
    if (audits.length === 1) {
      this.onOpenAudit(audits[0]);
      return;
    }
    this.menuOpen = true;
    this.menuX = ev.clientX;
    this.menuY = ev.clientY;
    this.menuEvents = audits;
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

  generateWeek() {
    const startOfWeek = moment(this.viewDate).startOf('week');
    this.week = [];
    for (let i = 0; i < 7; i++) {
      const date = startOfWeek.clone().add(i, 'day');
      const dayEvents = this.events.filter((e) =>
        moment(e.start).isSame(date, 'day')
      );
      this.week.push({ date, events: dayEvents });
    }
  }

  protected readonly moment = moment;
}
