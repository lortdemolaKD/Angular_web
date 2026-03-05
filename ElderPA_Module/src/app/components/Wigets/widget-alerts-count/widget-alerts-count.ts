import { Component, computed, input } from '@angular/core';
import { LocationType } from '../../Types';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-widget-alerts-count',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './widget-alerts-count.html',
  styleUrl: './widget-alerts-count.css',
})
export class WidgetAlertsCount {
  LocElements = input<LocationType[]>([]);

  readonly totalAlerts = computed(() =>
    (this.LocElements() ?? []).reduce(
      (sum, loc) => sum + (loc.performance?.alerts?.length ?? 0),
      0
    )
  );
}
