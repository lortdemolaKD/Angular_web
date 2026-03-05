import { Component, Input, OnChanges } from '@angular/core';
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

  hours = Array.from({ length: 24 }, (_, i) => i);
  dayEvents: any[] = [];

  ngOnChanges(): void {
    this.dayEvents = this.events.filter((e) =>
      moment(e.start).isSame(this.viewDate, 'day')
    );
  }

  protected readonly moment = moment;
}
