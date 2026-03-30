import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import moment from 'moment-timezone';
import {CommonModule, NgFor, NgIf} from '@angular/common';
import {CalendarEvent, DayEvent, MonthDay} from '../../Types';

@Component({
  selector: 'app-month-view',
  imports: [NgFor,
    CommonModule,],
  templateUrl: './month-view.html',
  styleUrl: './month-view.css',
})
export class MonthView implements OnChanges {
  @Input() events: CalendarEvent[] = [];
  @Input() viewDate!: moment.Moment;
  @Output() openAudit = new EventEmitter<string>();

  weeks: MonthDay[][] = [];
  menuOpen = false;
  menuX = 0;
  menuY = 0;
  menuEvents: DayEvent[] = [];

  ngOnChanges(): void {
    this.generateMonth();
  }

  openDayMenu(ev: MouseEvent, day: MonthDay): void {
    if (!day?.events?.length) return;
    if (ev.type === 'contextmenu') ev.preventDefault();
    ev.stopPropagation();

    const audits = [...day.events].filter((e) => !!(e as any).auditId);
    if (audits.length === 1) {
      this.onOpenAuditByEvent(audits[0]);
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

  onOpenAuditByEvent(e: DayEvent): void {
    const id = String((e as any).auditId ?? '').trim();
    if (!id) return;
    this.openAudit.emit(id);
    this.closeMenu();
  }
  getColorCounts(day: MonthDay): Array<{color: string, count: number, titles: string[]}> {
    const colorMap = new Map<string, {count: number, titles: string[]}>();

    day.events.slice(0, 10).forEach(event => {  // Limit processing
      const color = event.color?.primary || '#1e90ff';
      const title = event.title || 'Untitled';

      if (!colorMap.has(color)) {
        colorMap.set(color, { count: 0, titles: [] });
      }
      const group = colorMap.get(color)!;
      group.count++;
      group.titles.push(title);
    });

    return Array.from(colorMap.entries())
      .map(([color, group]) => ({ ...group, color }))
      .slice(0, 3);
  }


  generateMonth() {
    const start = moment(this.viewDate).startOf('month').startOf('week');
    const end = moment(this.viewDate).endOf('month').endOf('week');

    const days: MonthDay[] = [];
    let date = start.clone();

    while (date.isSameOrBefore(end, 'day')) {
      const dayEvents = this.events.filter(e =>
        moment.utc(e.start).isSame(date, 'day')
      );

      days.push({ date: date.clone(), events: dayEvents });
      date.add(1, 'day');
    }

    this.weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      this.weeks.push(days.slice(i, i + 7));
    }
  }


  getDayTooltip(day: MonthDay): string {
    if (!day.events || day.events.length === 0) return '';
    return day.events.map(event => event.title).join('\n');
  }



}
