import { Component, Input, OnChanges } from '@angular/core';
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

  week: any[] = [];
  hours = Array.from({ length: 24 }, (_, i) => i);

  ngOnChanges(): void {
    this.generateWeek();
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
