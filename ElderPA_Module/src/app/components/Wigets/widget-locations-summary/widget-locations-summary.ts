import { Component, computed, input } from '@angular/core';
import { LocationType } from '../../Types';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-widget-locations-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './widget-locations-summary.html',
  styleUrl: './widget-locations-summary.css',
})
export class WidgetLocationsSummary {
  LocElements = input<LocationType[]>([]);

  readonly total = computed(() => (this.LocElements() ?? []).length);
  readonly careHomeCount = computed(() =>
    (this.LocElements() ?? []).filter((l) => l.type === 'CareHome').length
  );
  readonly homeCareCount = computed(() =>
    (this.LocElements() ?? []).filter((l) => l.type === 'HomeCare').length
  );
}
