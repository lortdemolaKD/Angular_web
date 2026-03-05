import {Component, computed, input, signal} from '@angular/core';
import {LocationType,ActionTask} from '../../Types';
import {TaskCreator} from '../../task-creator/task-creator';
import {CommonModule, NgFor, NgIf} from '@angular/common';
type TaskRow = ActionTask & { locationName: string };
@Component({
  selector: 'app-widget-tasks-board',
  imports: [CommonModule, NgIf, NgFor, TaskCreator],
  templateUrl: './widget-tasks-board.html',
  styleUrl: './widget-tasks-board.css',
})
export class WidgetTasksBoard {
  // IMPORTANT: keep the input name as LocElements so WidgetCom can pass it automatically
  LocElements = input<LocationType[]>([]);
  canCreateTask = input<boolean>(true);

  showCreator = signal(false);

  tasks = computed<TaskRow[]>(() => {
    const locs = this.LocElements() ?? [];
    return locs.flatMap(loc =>
      (loc.performance?.tasks ?? []).map(t => ({ ...t, locationName: loc.name }))
    );
  });

  handleTaskCreated(partial: Partial<ActionTask>) {
    // Minimal demo behavior: push into the first location that has a performance set.
    // You can swap this for a proper TasksService later.
    const locs = this.LocElements() ?? [];
    const targetLoc = locs.find(l => !!l.performance);

    if (!targetLoc?.performance) return;

    const newTask: ActionTask = {
      id: `task-${Date.now()}`,
      alertId: partial.alertId ?? '',
      assignedBy: partial.assignedBy ?? 'current-user',
      assignedTo: partial.assignedTo ?? '',
      category: partial.category ?? '',
      description: partial.description ?? '',
      dueDate: partial.dueDate ?? new Date().toISOString(),
      status: 'Open',
      comments: partial.comments ?? [],
    };

    targetLoc.performance.tasks.push(newTask);
    this.showCreator.set(false);
  }
}
