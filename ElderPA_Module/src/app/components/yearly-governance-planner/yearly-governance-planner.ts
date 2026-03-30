import {
  Component,
  effect,
  Injector,
  Input,
  OnInit,
  runInInjectionContext,
  Signal,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import moment from 'moment-timezone';
import { RRule } from 'rrule';

import { MonthView } from './month-view/month-view';
import { WeekView } from './week-view/week-view';
import { DayView } from './day-view/day-view';

import { AuditInstance, CalendarEvent, DayEvent, MonthDay } from '../Types';
import { AuditDataService } from '../../Services/audit-data.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AuditViewDialogComponent } from '../audits/audit-view-dialog/audit-view-dialog.component';

moment.tz.setDefault('UTC');
function mapTypeToColor(str: string){
  if(str === 'baseline') return '#4CAF50';
  if(str === 'registered_manager') return '#00BCD4';
  if (str === 'provider') return '#FF9800';
  return '#a50011';
}

/** Prefer `date`; if missing/invalid use created/updated so older audits still appear on the grid. */
function effectiveAuditDayUtc(audit: AuditInstance): moment.Moment {
  const tryParse = (raw: unknown): moment.Moment => {
    if (raw == null || raw === '') return moment.utc(NaN);
    return moment.utc(raw as string).startOf('day');
  };
  let m = tryParse(audit.date);
  if (m.isValid()) return m;
  m = tryParse((audit as any).createdAt);
  if (m.isValid()) return m;
  m = tryParse((audit as any).updatedAt);
  return m;
}

function mapAuditToEvent(audit: AuditInstance): DayEvent {
  const m = effectiveAuditDayUtc(audit);
  const startUtc = m.toDate();
  return {
    title: `${audit.title}  ${audit.auditType}`,
    color: { primary: mapTypeToColor(audit.auditType), secondary: '#FFEBEE' },
    start: startUtc,
    auditId: String((audit as any).id ?? (audit as any)._id ?? ''),
  };
}

@Component({
  selector: 'app-yearly-governance-planner',
  standalone: true,
  imports: [CommonModule, MonthView, WeekView, DayView],
  templateUrl: './yearly-governance-planner.html',
  styleUrls: ['./yearly-governance-planner.css'],
})
export class YearlyGovernancePlanner implements OnInit {
  // CalendarEvent[] for the current visible period (DB-backed via AuditDataService)
  readonly events = signal<CalendarEvent[]>([]);

  @Input() showControls = true;
  @Input() viewType: 'month' | 'week' | 'day' = 'month';
  @Input() allowRecurring = true;
  private readonly locationIdSig = signal<string | null>(null);
  private readonly companyIdSig = signal<string | null>(null);

  @Input()
  set locationID(value: string | null | undefined) {
    this.locationIdSig.set(value ?? null);
  }

  /** When set, loads audits for all locations of this company (dashboard scope). */
  @Input()
  set companyId(value: string | null | undefined) {
    this.companyIdSig.set(value ?? null);
  }

  viewDate: moment.Moment = moment.utc();

  // In-memory recurring pattern definitions (not DB yet)
  recurringEvents: CalendarEvent[] = [];

  weeks: MonthDay[][] = [];
  weekDays: MonthDay[] = [];
  dayEvents: DayEvent[] = [];

  hours: number[] = Array.from({ length: 24 }, (_, i) => i);

  // DB-backed audits signal from service
  readonly audits: Signal<AuditInstance[]>;

  constructor(
    private auditService: AuditDataService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private injector: Injector
  ) {
    // AuditDataService loads /api/audits and exposes a signal; this keeps YGP in sync with DB. [file:15][file:25]
    this.audits = this.auditService.audits;
  }

  openAuditById(auditId: unknown): void {
    const id =
      typeof auditId === 'string'
        ? auditId
        : String((auditId as any)?.auditId ?? (auditId as any)?.detail ?? '');
    const normalized = String(id ?? '').trim();
    if (!normalized) return;

    this.dialog.open(AuditViewDialogComponent, {
      data: { auditId: normalized },
      maxWidth: '96vw',
      width: '960px',
    });
  }

  ngOnInit() {
    this.loadAuditsForContext();
    runInInjectionContext(this.injector, () => {
      effect(() => {
        this.locationIdSig();
        this.companyIdSig();
        this.loadAuditsForContext();
      });
      effect(() => {
        this.updateView();
      });
    });
    this.updateView();
  }

  private loadAuditsForContext() {
    const locationId = this.locationIdSig();
    const companyId = this.companyIdSig();
    if (locationId != null && locationId !== '') {
      this.auditService.loadForContext(null, locationId, null);
    } else if (companyId != null && companyId !== '') {
      this.auditService.loadForContext(companyId, null, null);
    }
  }

  /* ------------ core view/update logic ------------ */

  updateView() {
   // console.log("test",this.audits().length );
    const start = this.viewDate
      .clone()
      .startOf(this.viewType === 'month' ? 'month' : 'week');
    const end = this.viewDate
      .clone()
      .endOf(this.viewType === 'month' ? 'month' : 'week');

    // Expand audits + recurring patterns into concrete CalendarEvent instances
    this.events.set(this.getEventsForPeriod(start, end));

    if (this.viewType === 'month') this.generateMonth();
    else if (this.viewType === 'week') this.generateWeek();
    else this.generateDay();
  }

  setView(view: 'month' | 'week' | 'day') {
    this.viewType = view;
    this.updateView();
  }

  goPrevious(): void {
    if (this.viewType === 'month') {
      this.viewDate = this.viewDate.clone().subtract(1, 'month');
    } else if (this.viewType === 'week') {
      this.viewDate = this.viewDate.clone().subtract(1, 'week');
    } else {
      this.viewDate = this.viewDate.clone().subtract(1, 'day');
    }

    this.updateView();
  }

  goNext(): void {
    if (this.viewType === 'month') {
      this.viewDate = this.viewDate.clone().add(1, 'month');
    } else if (this.viewType === 'week') {
      this.viewDate = this.viewDate.clone().add(1, 'week');
    } else {
      this.viewDate = this.viewDate.clone().add(1, 'day');
    }

    this.updateView();
  }

  /* ------------ per-day helpers ------------ */

  dayEventsForDate(date: moment.Moment): DayEvent[] {
    const dayStart = date.clone().startOf('day');

    return this.audits()
      .filter((audit) => {
        const m = effectiveAuditDayUtc(audit);
        return m.isValid() && m.isSame(dayStart, 'day');
      })
      .map(mapAuditToEvent);
  }

  /* ------------ event expansion (DB audits + local recurring) ------------ */

  getEventsForPeriod(
    start: moment.Moment,
    end: moment.Moment,
    audits: AuditInstance[] = this.audits(),
    recurring: CalendarEvent[] = this.recurringEvents
  ): CalendarEvent[] {
    // DB-backed audits
    const staticEvents: CalendarEvent[] = audits
      .filter((a) => effectiveAuditDayUtc(a).isValid())
      .map(mapAuditToEvent)
      .filter((e) => {
        const eDay = moment.utc(e.start).startOf('day');
        return (
          eDay.isSameOrAfter(start.clone().startOf('day')) &&
          eDay.isSameOrBefore(end.clone().startOf('day'))
        );
      });

    // Local recurring definitions
    const recurringInstances: CalendarEvent[] = recurring.flatMap((event) => {
      if (!event.rrule) return [];
      const dtstart = moment.utc(event.start).toDate();
      const rule = new RRule({ ...event.rrule, dtstart, until: end.toDate() });
      return rule
        .between(start.toDate(), end.toDate())
        .map((d) => ({ ...event, start: d }));
    });

    return [...staticEvents, ...recurringInstances];
  }

  // Optional: full-range expansion if some other widget needs it
  allEvents: CalendarEvent[] = [];

  generateAllEventsForPeriod(start: moment.Moment, end: moment.Moment) {
    const staticEvents = this.audits()
      .filter((a) => effectiveAuditDayUtc(a).isValid())
      .map(mapAuditToEvent)
      .filter((e) => moment(e.start).isBetween(start, end, 'day', '[]'));

    const recurringInstances = this.recurringEvents.flatMap((event) => {
      if (!event.rrule) return [];
      const rule = new RRule({
        ...event.rrule,
        dtstart: event.start,
        until: end.toDate(),
      });
      return rule
        .between(start.toDate(), end.toDate())
        .map((date) => ({ ...event, start: date }));
    });

    this.allEvents = [...staticEvents, ...recurringInstances];
  }

  /* ------------ generators for month/week/day views ------------ */

  generateMonth(): void {
    const startOfMonth = this.viewDate
      .clone()
      .startOf('month')
      .startOf('week');
    const endOfMonth = this.viewDate
      .clone()
      .endOf('month')
      .endOf('week');

    const eventsThisPeriod = this.getEventsForPeriod(startOfMonth, endOfMonth);
    const weeks: MonthDay[][] = [];

    let current = startOfMonth.clone();
    while (
      current.isBefore(endOfMonth) ||
      current.isSame(endOfMonth, 'day')
      ) {
      const week: MonthDay[] = [];

      for (let i = 0; i < 7; i++) {
        const events = eventsThisPeriod.filter((e) =>
          moment(e.start).isSame(current, 'day')
        );
        week.push({ date: current.clone(), events });
        current.add(1, 'day');
      }

      weeks.push(week);
    }

    this.weeks = weeks;
  }

  generateWeek(): void {
    const startOfWeek = this.viewDate.clone().startOf('week');
    const endOfWeek = startOfWeek.clone().add(6, 'day');

    const eventsThisPeriod = this.getEventsForPeriod(startOfWeek, endOfWeek);
    const weekDays: MonthDay[] = [];

    for (let i = 0; i < 7; i++) {
      const day = startOfWeek.clone().add(i, 'day');
      const events = eventsThisPeriod.filter((e) =>
        moment(e.start).isSame(day, 'day')
      );
      weekDays.push({ date: day, events });
    }

    this.weekDays = weekDays;
  }

  generateDay(): void {
    this.dayEvents = this.getEventsForPeriod(
      this.viewDate.clone().startOf('day'),
      this.viewDate.clone().endOf('day')
    );
  }

  /* ------------ recurring event helper (still local-only) ------------ */

  addRecurringEvent() {
    if (!this.allowRecurring) return;

    const startOfYear = moment
      .utc(this.viewDate)
      .startOf('year')
      .toDate();

    const newEvent: CalendarEvent = {
      title: 'Audit',
      color: { primary: '#4CAF50', secondary: '#E8F5E9' },
      recurring: true,
      rrule: { freq: RRule.WEEKLY, byweekday: [RRule.MO] },
      start: startOfYear,
    };

    this.recurringEvents.push(newEvent);
    this.updateView();
  }
}
