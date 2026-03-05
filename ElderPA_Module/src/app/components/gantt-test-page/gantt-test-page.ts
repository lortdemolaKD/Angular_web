import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UniversalGanttComponent } from '../gantt/universal-gantt.component';
import type { GanttTask, GanttDependency, GanttConfig, GanttViewConfig, GanttResource } from '../gantt/gantt.types';

function iso(y: number, m: number, d: number): string {
  return new Date(y, m - 1, d).toISOString().slice(0, 10);
}

@Component({
  selector: 'app-gantt-test-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, UniversalGanttComponent],
  templateUrl: './gantt-test-page.html',
  styleUrl: './gantt-test-page.css',
})
export class GanttTestPage {
  readonly selectedTask = signal<GanttTask | null>(null);

  readonly basicTasks: GanttTask[] = [
    { id: 't1', name: 'Discovery', start: iso(2025, 1, 6), end: iso(2025, 1, 17), progress: 100 },
    { id: 't2', name: 'Design', start: iso(2025, 1, 13), end: iso(2025, 1, 31), progress: 60 },
    { id: 't3', name: 'Development', start: iso(2025, 2, 1), end: iso(2025, 3, 15), progress: 20 },
    { id: 't4', name: 'QA', start: iso(2025, 3, 10), end: iso(2025, 3, 28), progress: 0 },
  ];

  readonly basicConfig: GanttConfig = {
    tasks: this.basicTasks,
    showTodayLine: true,
    showProgress: true,
  };

  readonly depTasks: GanttTask[] = [
    { id: 'd1', name: 'Requirements', start: iso(2025, 1, 1), end: iso(2025, 1, 10), progress: 100 },
    { id: 'd2', name: 'Architecture', start: iso(2025, 1, 8), end: iso(2025, 1, 20), progress: 80 },
    { id: 'd3', name: 'Backend', start: iso(2025, 1, 18), end: iso(2025, 2, 14), progress: 40 },
    { id: 'd4', name: 'Frontend', start: iso(2025, 1, 25), end: iso(2025, 2, 21), progress: 30 },
    { id: 'd5', name: 'Integration', start: iso(2025, 2, 15), end: iso(2025, 3, 7), progress: 0 },
  ];

  readonly depDeps: GanttDependency[] = [
    { id: 'dep1', fromTaskId: 'd1', toTaskId: 'd2', type: 'FS' },
    { id: 'dep2', fromTaskId: 'd2', toTaskId: 'd3', type: 'FS' },
    { id: 'dep3', fromTaskId: 'd2', toTaskId: 'd4', type: 'FS' },
    { id: 'dep4', fromTaskId: 'd3', toTaskId: 'd5', type: 'FS' },
    { id: 'dep5', fromTaskId: 'd4', toTaskId: 'd5', type: 'FS' },
  ];

  readonly depConfig: GanttConfig = {
    tasks: this.depTasks,
    dependencies: this.depDeps,
    showTodayLine: true,
    showProgress: true,
    showDependencies: true,
  };

  readonly milestoneTasks: GanttTask[] = [
    { id: 'm1', name: 'Kick-off', start: iso(2025, 1, 6), end: iso(2025, 1, 6), type: 'milestone' },
    { id: 'm2', name: 'Phase 1', start: iso(2025, 1, 6), end: iso(2025, 2, 7), progress: 70 },
    { id: 'm3', name: 'Phase 1 Complete', start: iso(2025, 2, 7), end: iso(2025, 2, 7), type: 'milestone' },
    { id: 'm4', name: 'Phase 2', start: iso(2025, 2, 10), end: iso(2025, 3, 14), progress: 25 },
    { id: 'm5', name: 'Release', start: iso(2025, 3, 14), end: iso(2025, 3, 14), type: 'milestone' },
  ];

  readonly milestoneConfig: GanttConfig = {
    tasks: this.milestoneTasks,
    showTodayLine: true,
    showProgress: true,
  };

  readonly multiProjectTasks: GanttTask[] = [
    { id: 'p1a', name: 'Alpha – Design', start: iso(2025, 1, 1), end: iso(2025, 1, 24), projectId: 'P1', projectName: 'Alpha', progress: 100 },
    { id: 'p1b', name: 'Alpha – Build', start: iso(2025, 1, 20), end: iso(2025, 2, 21), projectId: 'P1', projectName: 'Alpha', progress: 50 },
    { id: 'p2a', name: 'Beta – Design', start: iso(2025, 1, 15), end: iso(2025, 2, 7), projectId: 'P2', projectName: 'Beta', progress: 80 },
    { id: 'p2b', name: 'Beta – Build', start: iso(2025, 2, 3), end: iso(2025, 3, 7), projectId: 'P2', projectName: 'Beta', progress: 20 },
    { id: 'p3a', name: 'Gamma – Discovery', start: iso(2025, 2, 1), end: iso(2025, 2, 28), projectId: 'P3', projectName: 'Gamma', progress: 40 },
  ];

  readonly multiProjectConfig: GanttConfig = {
    tasks: this.multiProjectTasks,
    groupBy: 'projectName',
    showTodayLine: true,
    showProgress: true,
  };

  readonly sprintTasks: GanttTask[] = [
    { id: 's1', name: 'Sprint 1 – Story A', start: iso(2025, 1, 6), end: iso(2025, 1, 17), progress: 100 },
    { id: 's2', name: 'Sprint 1 – Story B', start: iso(2025, 1, 8), end: iso(2025, 1, 20), progress: 100 },
    { id: 's3', name: 'Sprint 2 – Story C', start: iso(2025, 1, 21), end: iso(2025, 2, 3), progress: 60 },
    { id: 's4', name: 'Sprint 2 – Story D', start: iso(2025, 1, 27), end: iso(2025, 2, 7), progress: 30 },
    { id: 's5', name: 'Sprint 3 – Story E', start: iso(2025, 2, 4), end: iso(2025, 2, 17), progress: 0 },
  ];

  readonly sprintViewConfig: GanttViewConfig = {
    preset: 'sprint',
    scale: 'week',
    rowHeight: 36,
  };

  readonly sprintConfig: GanttConfig = {
    tasks: this.sprintTasks,
    view: this.sprintViewConfig,
    showTodayLine: true,
    showProgress: true,
  };

  readonly maxedTasks: GanttTask[] = [
    { id: 'x1', name: 'Epic: Launch', start: iso(2025, 1, 1), end: iso(2025, 3, 31), type: 'summary', expanded: true },
    { id: 'x2', name: 'Research', start: iso(2025, 1, 1), end: iso(2025, 1, 15), progress: 100, assignee: 'Alice', status: 'complete' },
    { id: 'x3', name: 'Spec', start: iso(2025, 1, 10), end: iso(2025, 1, 24), progress: 100, assignee: 'Bob', status: 'complete' },
    { id: 'x4', name: 'MVP Build', start: iso(2025, 1, 20), end: iso(2025, 2, 28), progress: 55, assignee: 'Carol', status: 'in-progress' },
    { id: 'x5', name: 'MVP Review', start: iso(2025, 2, 25), end: iso(2025, 2, 25), type: 'milestone' },
    { id: 'x6', name: 'UAT', start: iso(2025, 3, 1), end: iso(2025, 3, 21), progress: 0, assignee: 'Alice', status: 'not-started' },
    { id: 'x7', name: 'Go-Live', start: iso(2025, 3, 21), end: iso(2025, 3, 21), type: 'milestone' },
  ];

  readonly maxedDeps: GanttDependency[] = [
    { id: 'xd1', fromTaskId: 'x2', toTaskId: 'x3', type: 'FS' },
    { id: 'xd2', fromTaskId: 'x3', toTaskId: 'x4', type: 'FS' },
    { id: 'xd3', fromTaskId: 'x4', toTaskId: 'x5', type: 'FS' },
    { id: 'xd4', fromTaskId: 'x5', toTaskId: 'x6', type: 'FS' },
    { id: 'xd5', fromTaskId: 'x6', toTaskId: 'x7', type: 'FS' },
  ];

  readonly maxedConfig: GanttConfig = {
    tasks: this.maxedTasks,
    dependencies: this.maxedDeps,
    view: { scale: 'week', rowHeight: 34, taskListWidth: 280 },
    showTodayLine: true,
    showProgress: true,
    showDependencies: true,
  };

  readonly workerResources: GanttResource[] = [
    { id: 'alice', name: 'Alice', capacity: 1 },
    { id: 'bob', name: 'Bob', capacity: 1 },
    { id: 'carol', name: 'Carol', capacity: 1 },
  ];

  readonly workerTasks = signal<GanttTask[]>([
    { id: 'w1', name: 'Audit Q1', start: iso(2025, 1, 6), end: iso(2025, 1, 24), assignee: 'alice', progress: 100, category: 'Audit', status: 'complete' },
    { id: 'w2', name: 'Training prep', start: iso(2025, 1, 13), end: iso(2025, 1, 31), assignee: 'alice', progress: 60, category: 'Training', status: 'in-progress' },
    { id: 'w3', name: 'Backend API', start: iso(2025, 1, 20), end: iso(2025, 2, 14), assignee: 'bob', progress: 40, category: 'Dev', status: 'in-progress' },
    { id: 'w4', name: 'Frontend UI', start: iso(2025, 1, 27), end: iso(2025, 2, 21), assignee: 'bob', progress: 20, category: 'Dev', status: 'in-progress' },
    { id: 'w5', name: 'Documentation', start: iso(2025, 2, 1), end: iso(2025, 2, 28), assignee: 'carol', progress: 10, category: 'Docs', status: 'not-started' },
    { id: 'u1', name: 'Review policy', start: iso(2025, 2, 10), end: iso(2025, 2, 21), progress: 0, category: 'General' },
    { id: 'u2', name: 'Data migration', start: iso(2025, 2, 15), end: iso(2025, 3, 7), progress: 0, category: 'Dev' },
  ]);

  readonly unassignedTasks = computed(() => this.workerTasks().filter((t) => !(t.assignee ?? '').trim()));

  readonly workerCategoryColors: Record<string, string> = {
    Audit: '#059669',
    Training: '#7c3aed',
    Dev: '#2563eb',
    Docs: '#64748b',
    General: '#6b7280',
  };

  readonly resourceRowMode = signal<'compact' | 'expanded'>('compact');

  readonly workerConfig = computed<GanttConfig>(() => ({
    tasks: this.workerTasks(),
    viewMode: 'resource',
    resources: this.workerResources,
    resourceRowMode: this.resourceRowMode(),
    showWorkloadIndicator: true,
    categoryColors: this.workerCategoryColors,
    view: { scale: 'week', rowHeight: 32, taskListWidth: 280 },
    showTodayLine: true,
    showProgress: true,
  }));

  newTaskAssignee = signal<string>('alice');
  newTaskName = signal('');
  newTaskStart = signal(iso(2025, 2, 10));
  newTaskEnd = signal(iso(2025, 2, 28));

  addTask(): void {
    const name = this.newTaskName().trim();
    if (!name) return;
    const start = this.newTaskStart();
    const end = this.newTaskEnd();
    const id = `w-${Date.now()}`;
    this.workerTasks.update((list) => [
      ...list,
      { id, name, start, end, assignee: this.newTaskAssignee(), progress: 0, category: 'General' },
    ]);
    this.newTaskName.set('');
    this.newTaskStart.set(end);
    this.newTaskEnd.set(iso(2025, 3, 15));
  }

  onCreateTaskRequest(req: { resourceId: string; start: string; end: string }): void {
    const id = `w-${Date.now()}`;
    this.workerTasks.update((list) => [
      ...list,
      { id, name: 'New task', start: req.start, end: req.end, assignee: req.resourceId, progress: 0, category: 'General' },
    ]);
  }

  onTaskChange(patch: Partial<GanttTask> & { id: string }): void {
    this.workerTasks.update((list) =>
      list.map((t) => (t.id === patch.id ? { ...t, ...patch } : t))
    );
  }

  assignTask(taskId: string, assignee: string): void {
    this.workerTasks.update((list) =>
      list.map((t) => (t.id === taskId ? { ...t, assignee: assignee || undefined } : t))
    );
  }

  onTaskClick(task: GanttTask): void {
    this.selectedTask.set(task);
  }

  onTaskDelete(task: GanttTask): void {
    if (this.selectedTask()?.id === task.id) this.selectedTask.set(null);
  }
}
