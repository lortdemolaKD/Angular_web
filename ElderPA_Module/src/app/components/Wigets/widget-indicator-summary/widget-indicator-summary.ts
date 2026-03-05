import { Component, computed, input } from '@angular/core';
import { LocationType } from '../../Types';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-widget-indicator-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './widget-indicator-summary.html',
  styleUrl: './widget-indicator-summary.css',
})
export class WidgetIndicatorSummary {
  LocElements = input<LocationType[]>([]);

  readonly counts = computed(() => {
    const locs = this.LocElements() ?? [];
    let green = 0,
      amber = 0,
      red = 0;
    for (const loc of locs) {
      for (const cat of loc.performance?.categories ?? []) {
        for (const ind of cat.indicators ?? []) {
          if (ind.status === 'Green') green++;
          else if (ind.status === 'Amber') amber++;
          else if (ind.status === 'Red') red++;
        }
      }
    }
    return { green, amber, red };
  });
}
