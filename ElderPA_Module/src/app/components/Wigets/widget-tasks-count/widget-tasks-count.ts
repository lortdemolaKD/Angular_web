import { Component, computed, input } from '@angular/core';
import { LocationType } from '../../Types';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-widget-tasks-count',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './widget-tasks-count.html',
  styleUrl: './widget-tasks-count.css',
})
export class WidgetTasksCount {
  LocElements = input<LocationType[]>([]);

  readonly allTasks = computed(() =>
    (this.LocElements() ?? []).flatMap((loc) => loc.performance?.tasks ?? [])
  );
  readonly openCount = computed(() =>
    this.allTasks().filter((t) => t.status === 'Open' || !t.status).length
  );
  readonly totalCount = computed(() => this.allTasks().length);
}
