import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  OnInit,
  OnChanges,
  SimpleChanges,
  NgZone,
  type WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  GanttTask,
  GanttDependency,
  GanttConfig,
  GanttViewConfig,
  GanttBarLayout,
  GanttDisplayRow,
  TimeScaleUnit,
  type GanttTaskStatus,
  type GanttTimeScalePreset,
} from './gantt.types';

const ROW_HEIGHT = 32;
const TASK_LIST_WIDTH = 260;
const DEFAULT_SCALE: TimeScaleUnit = 'week';

function parseDate(s: string): Date {
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function toDateKey(d: Date, unit: TimeScaleUnit): string {
  const y = d.getFullYear();
  const m = d.getMonth();
  const w = getWeek(d);
  const day = d.getDate();
  const h = d.getHours();
  if (unit === 'year') return `${y}`;
  if (unit === 'quarter') return `${y}-Q${Math.floor(m / 3) + 1}`;
  if (unit === 'month') return `${y}-${String(m + 1).padStart(2, '0')}`;
  if (unit === 'week') return `${y}-W${String(w).padStart(2, '0')}`;
  if (unit === 'day') return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return d.toISOString();
}

function getWeek(d: Date): number {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
}

function addUnit(d: Date, unit: TimeScaleUnit, n: number): Date {
  const out = new Date(d);
  if (unit === 'year') out.setFullYear(out.getFullYear() + n);
  else if (unit === 'quarter') out.setMonth(out.getMonth() + n * 3);
  else if (unit === 'month') out.setMonth(out.getMonth() + n);
  else if (unit === 'week') out.setDate(out.getDate() + n * 7);
  else if (unit === 'day') out.setDate(out.getDate() + n);
  else out.setTime(out.getTime() + n * 3600000);
  return out;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Serialize date for task start/end so sub-day durations (e.g. 1 hour) are preserved. */
function toISODateTime(d: Date): string {
  return d.toISOString();
}

const MIN_TASK_MS = 30 * 60 * 1000; // 30 minutes (allows 1-hour or half-hour tasks)
const MS_PER_DAY = 86400000;

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function startOfWeekMonday(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + diff);
  return out;
}

function startOfMonth(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  return out;
}

function endOfMonth(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return out;
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}

@Component({
  selector: 'app-universal-gantt',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './universal-gantt.component.html',
  styleUrl: './universal-gantt.component.css',
})
export class UniversalGanttComponent implements OnInit, OnChanges {
  constructor(private ngZone: NgZone) {}

  @Input() config: GanttConfig | null = null;
  @Input() tasks: GanttTask[] = [];
  /** When set, the Gantt updates this signal directly on move/resize/create so the UI updates reliably. */
  @Input() tasksSignal?: WritableSignal<GanttTask[]>;
  @Input() dependencies: GanttDependency[] = [];
  @Input() set view(v: GanttViewConfig | undefined) {
    this.viewConfig.set(v ?? null);
  }

  @Output() taskClick = new EventEmitter<GanttTask>();
  @Output() taskChange = new EventEmitter<Partial<GanttTask> & { id: string }>();
  @Output() taskDelete = new EventEmitter<GanttTask>();
  @Output() rangeChange = new EventEmitter<{ start: Date; end: Date }>();
  @Output() createTaskRequest = new EventEmitter<{ resourceId: string; start: string; end: string }>();

  readonly viewConfig = signal<GanttViewConfig | null>(null);
  readonly zoomLevel = signal<number>(1);
  /** When set, overrides scale unit and visible range (Day / Week / Month / Year). */
  readonly scalePreset = signal<GanttTimeScalePreset | null>(null);

  /** Drag/resize state (not signals to avoid re-render during drag) */
  private dragTaskId: string | null = null;
  private dragMode: 'move' | 'resize-left' | 'resize-right' | null = null;
  private dragInitialClientX = 0;
  private dragStartStartMs = 0;
  private dragStartEndMs = 0;
  private dragTimelineWidth = 0;
  /** Timeline inner element for drop-row hit-test (reassign on drop) */
  private dragTimelineInner: HTMLElement | null = null;
  /** Assignee at move start for reassign check */
  private dragStartAssignee: string | undefined = undefined;

  /** During move drag: row index under cursor so bar can be drawn there (visual reassign preview) */
  readonly dragPreviewRowIndex = signal<number | null>(null);

  readonly contextMenu = signal<
    | { type: 'create'; x: number; y: number; resourceId: string; start: string; end: string }
    | { type: 'task'; x: number; y: number; task: GanttTask }
    | null
  >(null);
  private justFinishedDrag = false;
  private moveHandler = (e: MouseEvent) => this.onDocumentMouseMove(e);
  private upHandler = (e: MouseEvent) => this.onDocumentMouseUp(e);

  private readonly effectiveTasks = computed(() => {
    const sig = this.tasksSignal;
    const cfg = this.config;
    const input = this.tasks;
    const raw = sig ? sig() : (cfg?.tasks ?? input);
    let list = Array.isArray(raw) ? raw.filter((t) => t.type !== 'summary' || t.expanded !== false) : [];
    const filter = cfg?.filterBy;
    if (filter) {
      if (filter.status) list = list.filter((t) => t.status === filter.status);
      if (filter.projectId) list = list.filter((t) => t.projectId === filter.projectId);
      if (filter.category) list = list.filter((t) => t.category === filter.category);
    }
    return list;
  });

  /** Ordered resource list (with hierarchy: parents first if parentId set) */
  private readonly orderedResources = computed(() => {
    const cfg = this.config;
    const tasks = this.effectiveTasks();
    const resourceList = cfg?.resources ?? [];
    const unassignedKey = '__unassigned__';
    const assigneeSet = new Set<string>(tasks.map((t) => (t.assignee ?? '').trim()).filter(Boolean));
    let ids: string[] = resourceList.length ? resourceList.map((r) => r.id) : Array.from(assigneeSet).sort();
    if (tasks.some((t) => !(t.assignee ?? '').trim()) && !ids.includes(unassignedKey)) ids = [...ids, unassignedKey];
    if (!resourceList.length) return ids.map((id) => ({ id, name: id, capacity: 1 }));
    const byId = new Map(resourceList.map((r) => [r.id, r]));
    const withNames = ids.map((id) => ({
      id,
      name: (byId.get(id)?.name ?? id) as string,
      capacity: byId.get(id)?.capacity ?? 1,
    }));
    return withNames;
  });

  /** When viewMode is resource: compact = one row per resource; expanded = header + task rows */
  readonly displayRows = computed((): GanttDisplayRow[] => {
    const cfg = this.config;
    const tasks = this.effectiveTasks();
    const viewMode = cfg?.viewMode ?? (cfg?.groupBy === 'assignee' ? 'resource' : 'task');
    const resourceRowMode = cfg?.resourceRowMode ?? 'compact';
    if (viewMode !== 'resource') {
      return tasks.map((t) => ({ type: 'task' as const, task: t }));
    }
    const resources = this.orderedResources();
    const idToName = new Map(resources.map((r) => [r.id, r.name]));
    const unassignedKey = '__unassigned__';
    idToName.set(unassignedKey, 'Unassigned');
    const rows: GanttDisplayRow[] = [];
    resources.forEach((res, resourceIndex) => {
      const groupTasks = res.id === unassignedKey
        ? tasks.filter((t) => !(t.assignee ?? '').trim())
        : tasks.filter((t) => (t.assignee ?? '').trim() === res.id);
      const hasOverload = this.computeResourceOverload(groupTasks, res.capacity ?? 1);
      rows.push({
        type: 'header',
        resourceId: res.id,
        resourceName: typeof res.name === 'string' ? res.name : res.id,
        resourceIndex,
        taskCount: groupTasks.length,
        hasOverload: cfg?.showWorkloadIndicator !== false && hasOverload,
      });
      if (resourceRowMode === 'expanded') {
        groupTasks.forEach((t) => rows.push({ type: 'task', task: t, resourceId: res.id, resourceIndex }));
      }
    });
    return rows;
  });

  /** True if at any time the resource has more concurrent tasks than capacity */
  private computeResourceOverload(tasks: GanttTask[], capacity: number): boolean {
    if (tasks.length <= capacity) return false;
    const events: { t: number; delta: number }[] = [];
    for (const task of tasks) {
      const s = new Date(task.start).getTime();
      const e = new Date(task.end).getTime();
      events.push({ t: s, delta: 1 });
      events.push({ t: e, delta: -1 });
    }
    events.sort((a, b) => a.t - b.t || a.delta - b.delta);
    let concurrent = 0;
    for (const ev of events) {
      concurrent += ev.delta;
      if (concurrent > capacity) return true;
    }
    return false;
  }

  /** For compact mode: which display row index is the resource header (only headers) */
  readonly resourceHeaderRowIndices = computed(() => {
    const rows = this.displayRows();
    return rows.map((r, i) => (r.type === 'header' ? i : -1)).filter((i) => i >= 0);
  });

  readonly isResourceView = computed(() => {
    const cfg = this.config;
    return (cfg?.viewMode ?? (cfg?.groupBy === 'assignee' ? 'resource' : 'task')) === 'resource';
  });

  private readonly effectiveDeps = computed(() => {
    const cfg = this.config;
    return cfg?.dependencies ?? this.dependencies;
  });

  readonly range = computed(() => {
    const tasks = this.effectiveTasks();
    if (!tasks.length) {
      const now = new Date();
      const start = addUnit(now, 'month', -1);
      const end = addUnit(now, 'month', 2);
      return { start, end };
    }
    let min = parseDate(tasks[0].start);
    let max = parseDate(tasks[0].end);
    for (const t of tasks) {
      const s = parseDate(t.start);
      const e = parseDate(t.end);
      if (s < min) min = s;
      if (e > max) max = e;
    }
    const pad = 7;
    return {
      start: addUnit(min, 'day', -pad),
      end: addUnit(max, 'day', pad),
    };
  });

  /** Base range from config or tasks (used when no preset, or as center for preset range). */
  private readonly baseRange = computed(() => {
    const cfg = this.config;
    if (cfg?.rangeStart && cfg?.rangeEnd) return { start: parseDate(cfg.rangeStart), end: parseDate(cfg.rangeEnd) };
    return this.range();
  });

  readonly scaleUnit = computed((): TimeScaleUnit => {
    const preset = this.scalePreset();
    if (preset === 'day') return 'hour';
    if (preset === 'week' || preset === 'month') return 'day';
    if (preset === 'year') return 'week';
    return this.viewConfig()?.scale ?? this.config?.view?.scale ?? DEFAULT_SCALE;
  });

  readonly rowHeight = computed(() => this.viewConfig()?.rowHeight ?? this.config?.view?.rowHeight ?? ROW_HEIGHT);
  readonly taskListWidth = computed(() => this.viewConfig()?.taskListWidth ?? this.config?.view?.taskListWidth ?? TASK_LIST_WIDTH);
  readonly showToday = computed(() => this.config?.showTodayLine !== false);
  readonly showProgress = computed(() => this.config?.showProgress !== false);
  readonly showDeps = computed(() => this.config?.showDependencies !== false);

  readonly rangeStart = computed(() => {
    const preset = this.scalePreset();
    const base = this.baseRange();
    const midMs = (base.start.getTime() + base.end.getTime()) / 2;
    const mid = new Date(midMs);
    if (preset === 'day') return startOfDay(mid);
    if (preset === 'week') return startOfWeekMonday(mid);
    if (preset === 'month') return startOfMonth(mid);
    if (preset === 'year') return startOfYear(mid);
    const cfg = this.config;
    if (cfg?.rangeStart) return parseDate(cfg.rangeStart);
    return base.start;
  });

  readonly rangeEnd = computed(() => {
    const preset = this.scalePreset();
    const base = this.baseRange();
    const midMs = (base.start.getTime() + base.end.getTime()) / 2;
    const mid = new Date(midMs);
    if (preset === 'day') return addUnit(startOfDay(mid), 'day', 1);
    if (preset === 'week') return addUnit(startOfWeekMonday(mid), 'day', 7);
    if (preset === 'month') return addUnit(startOfMonth(mid), 'month', 1);
    if (preset === 'year') return addUnit(startOfYear(mid), 'year', 1);
    const cfg = this.config;
    if (cfg?.rangeEnd) return parseDate(cfg.rangeEnd);
    return base.end;
  });

  readonly totalDays = computed(() => {
    const s = this.rangeStart().getTime();
    const e = this.rangeEnd().getTime();
    return Math.max(1, Math.ceil((e - s) / 86400000));
  });

  /** One scale unit before range start – gives a left margin so the first tick is readable (starts from “zero”). */
  readonly displayRangeStart = computed(() => addUnit(this.rangeStart(), this.scaleUnit(), -1));

  readonly timeTicks = computed(() => {
    const unit = this.scaleUnit();
    const start = this.displayRangeStart();
    const end = this.rangeEnd();
    const ticks: { date: Date; label: string; isPrimary?: boolean }[] = [];
    let d = new Date(start);
    if (unit === 'hour') d.setMinutes(0, 0, 0);
    else d.setHours(0, 0, 0, 0);
    const endTime = end.getTime();
    while (d.getTime() <= endTime) {
      const isFirst = ticks.length === 0;
      const label = isFirst
        ? ''
        : unit === 'hour'
          ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : unit === 'month'
            ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
            : unit === 'week'
              ? `W${getWeek(d)}`
              : unit === 'day'
                ? String(d.getDate())
                : d.toLocaleDateString();
      ticks.push({ date: new Date(d), label, isPrimary: unit === 'month' ? d.getDate() === 1 : !isFirst });
      d = addUnit(d, unit, 1);
    }
    return ticks;
  });

  readonly barLayouts = computed(() => {
    const cfg = this.config;
    const displayRows = this.displayRows();
    const start = this.displayRangeStart().getTime();
    const end = this.rangeEnd().getTime();
    const total = end - start;
    const today = new Date().setHours(0, 0, 0, 0);
    const categoryColors = cfg?.categoryColors ?? {};
    const resourceRowMode = cfg?.resourceRowMode ?? 'compact';
    const isResourceView = this.isResourceView();
    const previewRow = this.dragPreviewRowIndex();
    const layouts: GanttBarLayout[] = [];

    const statusLabel = (t: GanttTask): string => {
      const s = t.status ?? 'not-started';
      return s === 'complete' ? 'Completed' : s === 'in-progress' ? 'In progress' : s === 'on-hold' ? 'On hold' : s === 'at-risk' ? 'At risk' : 'Not started';
    };

    if (isResourceView && resourceRowMode === 'compact') {
      const resources = this.orderedResources();
      const unassignedKey = '__unassigned__';
      resources.forEach((res, resourceIndex) => {
        const groupTasks = this.effectiveTasks().filter(
          (t) => (res.id === unassignedKey ? !(t.assignee ?? '').trim() : (t.assignee ?? '').trim() === res.id)
        );
        // Sort by start and assign lanes so overlapping tasks stack and stay clickable
        const sorted = [...groupTasks].sort((a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime());
        const laneEndMs: number[] = [];
        const taskLaneIndex = new Map<string, number>();
        sorted.forEach((task) => {
          const ts = parseDate(task.start).getTime();
          const te = parseDate(task.end).getTime();
          let lane = 0;
          while (lane < laneEndMs.length && laneEndMs[lane] > ts) lane++;
          if (lane === laneEndMs.length) laneEndMs.push(0);
          laneEndMs[lane] = te;
          taskLaneIndex.set(task.id, lane);
        });
        const laneCount = Math.max(1, laneEndMs.length);
        groupTasks.forEach((task) => {
          const ts = parseDate(task.start).getTime();
          const te = parseDate(task.end).getTime();
          const xPercent = total > 0 ? ((ts - start) / total) * 100 : 0;
          const wPercent = total > 0 ? (Math.max(te - ts, 0) / total) * 100 : 1;
          const progress = task.progress ?? 0;
          const isMilestone = task.type === 'milestone' || (ts === te);
          const isLate = !isMilestone && te < today && progress < 100;
          const hasOverlap = groupTasks.some(
            (o) => o.id !== task.id && parseDate(o.start).getTime() < te && parseDate(o.end).getTime() > ts
          );
          const categoryColor = task.color ?? (task.category ? categoryColors[task.category] : undefined);
          const laneIndex = taskLaneIndex.get(task.id) ?? 0;
          const usePreviewRow = this.dragTaskId === task.id && previewRow != null;
          const rowIndex = usePreviewRow ? previewRow : resourceIndex;
          const outLaneIndex = usePreviewRow ? 0 : laneIndex;
          const outLaneCount = usePreviewRow ? 1 : laneCount;
          layouts.push({
            task,
            rowIndex,
            xPercent,
            widthPercent: Math.max(wPercent, isMilestone ? 0.5 : 2),
            progressPercent: progress,
            isMilestone,
            isLate,
            hasOverlap,
            categoryColor: categoryColor ?? undefined,
            statusLabel: statusLabel(task),
            laneIndex: outLaneIndex,
            laneCount: outLaneCount,
          });
        });
      });
      return layouts;
    }

    displayRows.forEach((row, rowIndex) => {
      if (row.type !== 'task') return;
      const task = row.task;
      const ts = parseDate(task.start).getTime();
      const te = parseDate(task.end).getTime();
      const xPercent = total > 0 ? ((ts - start) / total) * 100 : 0;
      const widthPercent = total > 0 ? (Math.max(te - ts, 0) / total) * 100 : 1;
      const progress = task.progress ?? 0;
      const isMilestone = task.type === 'milestone' || (ts === te);
      const isLate = !isMilestone && te < today && progress < 100;
      const categoryColor = task.color ?? (task.category ? categoryColors[task.category] : undefined);
      layouts.push({
        task,
        rowIndex,
        xPercent,
        widthPercent: Math.max(widthPercent, isMilestone ? 0.5 : 2),
        progressPercent: progress,
        isMilestone,
        isLate,
        categoryColor: categoryColor ?? undefined,
        statusLabel: statusLabel(task),
      });
    });
    return layouts;
  });

  readonly todayPercent = computed(() => {
    const start = this.displayRangeStart().getTime();
    const end = this.rangeEnd().getTime();
    const total = end - start;
    const now = Date.now();
    if (total <= 0) return 0;
    return ((now - start) / total) * 100;
  });

  readonly depPaths = computed(() => {
    const deps = this.effectiveDeps();
    const layouts = this.barLayouts();
    const map = new Map<string, GanttBarLayout>(layouts.map((l) => [l.task.id, l]));
    return deps.map((dep) => {
      const from = map.get(dep.fromTaskId);
      const to = map.get(dep.toTaskId);
      if (!from || !to) return null;
      const fromCenter = from.xPercent + (from.isMilestone ? 0.25 : from.widthPercent / 2);
      const toCenter = to.xPercent + (to.isMilestone ? 0.25 : to.widthPercent / 2);
      return {
        dep,
        fromCenter,
        toCenter,
        fromRow: from.rowIndex + 0.5,
        toRow: to.rowIndex + 0.5,
      };
    }).filter(Boolean) as Array<{ dep: GanttDependency; fromCenter: number; toCenter: number; fromRow: number; toRow: number }>;
  });

  readonly depSvgViewBox = computed(() => {
    const rows = this.displayRows().length;
    return `0 0 100 ${Math.max(rows, 1)}`;
  });

  ngOnInit(): void {
    this.rangeChange.emit({
      start: this.rangeStart(),
      end: this.rangeEnd(),
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] || changes['tasks']) {
      this.rangeChange.emit({
        start: this.rangeStart(),
        end: this.rangeEnd(),
      });
    }
  }

  zoomIn(): void {
    this.zoomLevel.update((z) => Math.min(3, z + 0.25));
  }

  zoomOut(): void {
    this.zoomLevel.update((z) => Math.max(0.25, z - 0.25));
  }

  fitToProject(): void {
    this.scalePreset.set(null);
    this.zoomLevel.set(1);
  }

  setScalePreset(preset: GanttTimeScalePreset): void {
    this.scalePreset.set(preset);
  }

  tickPercent(tick: { date: Date }): number {
    const start = this.displayRangeStart().getTime();
    const end = this.rangeEnd().getTime();
    const total = end - start;
    if (total <= 0) return 0;
    return ((tick.date.getTime() - start) / total) * 100;
  }

  getBarTitle(layout: GanttBarLayout): string {
    const t = layout.task;
    const parts = [t.name, `${t.start} – ${t.end}`, layout.statusLabel ?? (t.status ?? '')];
    if (t.description) parts.push(t.description.slice(0, 80) + (t.description.length > 80 ? '…' : ''));
    if (layout.hasOverlap) parts.push('(Overlap)');
    if (layout.isLate) parts.push('(Late)');
    return parts.filter(Boolean).join(' · ');
  }

  /** Bar wrap top in px: when using lanes, offset within row; otherwise full row. */
  getBarWrapTop(layout: GanttBarLayout): number {
    const rh = this.rowHeight();
    const lc = layout.laneCount ?? 1;
    const li = layout.laneIndex ?? 0;
    if (lc <= 1) return layout.rowIndex * rh;
    return layout.rowIndex * rh + li * (rh / lc);
  }

  /** Bar wrap height in px: when using lanes, one lane height; otherwise full row. */
  getBarWrapHeight(layout: GanttBarLayout): number {
    const rh = this.rowHeight();
    const lc = layout.laneCount ?? 1;
    return lc <= 1 ? rh : rh / lc;
  }

  onDocumentMouseMove(e: MouseEvent): void {
    if (!this.dragTaskId || !this.dragMode) return;
    const rangeEnd = this.rangeEnd().getTime();
    const displayStart = this.displayRangeStart().getTime();
    const totalMs = rangeEnd - displayStart;
    if (this.dragTimelineWidth <= 0 || totalMs <= 0) return;
    const deltaPx = e.clientX - this.dragInitialClientX;
    const deltaMs = (deltaPx / this.dragTimelineWidth) * totalMs;
    let newStartMs = this.dragStartStartMs;
    let newEndMs = this.dragStartEndMs;
    if (this.dragMode === 'move') {
      newStartMs = this.dragStartStartMs + deltaMs;
      newEndMs = this.dragStartEndMs + deltaMs;
    } else if (this.dragMode === 'resize-left') {
      newStartMs = Math.min(this.dragStartStartMs + deltaMs, this.dragStartEndMs - MIN_TASK_MS);
      newEndMs = this.dragStartEndMs;
    } else if (this.dragMode === 'resize-right') {
      newEndMs = Math.max(this.dragStartEndMs + deltaMs, this.dragStartStartMs + MIN_TASK_MS);
      newStartMs = this.dragStartStartMs;
    }
    const id = this.dragTaskId;
    const start = toISODateTime(new Date(newStartMs));
    const end = toISODateTime(new Date(newEndMs));
    const patch = { id, start, end };
    const sig = this.tasksSignal;
    if (sig) {
      this.ngZone.run(() => sig.update((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t))));
    }
    this.ngZone.run(() => this.taskChange.emit(patch));

    // Update drag preview row so bar visually moves to the row under cursor (reassign preview)
    if (this.dragMode === 'move' && this.dragTimelineInner && this.isResourceView()) {
      const rect = this.dragTimelineInner.getBoundingClientRect();
      const scrollParent = this.dragTimelineInner.parentElement;
      const scrollTop = scrollParent ? scrollParent.scrollTop : 0;
      const offsetY = e.clientY - rect.top + scrollTop;
      const rowIndex = Math.floor(offsetY / this.rowHeight());
      const resources = this.orderedResources();
      const clamped = Math.max(0, Math.min(rowIndex, resources.length - 1));
      this.ngZone.run(() => this.dragPreviewRowIndex.set(clamped));
    }
  }

  onDocumentMouseUp(e: MouseEvent): void {
    const wasMove = this.dragMode === 'move';
    const taskId = this.dragTaskId;
    const timelineEl = this.dragTimelineInner;
    document.removeEventListener('mousemove', this.moveHandler);
    document.removeEventListener('mouseup', this.upHandler);
    this.justFinishedDrag = !!this.dragTaskId;
    this.dragTaskId = null;
    this.dragMode = null;
    this.dragTimelineInner = null;
    this.ngZone.run(() => this.dragPreviewRowIndex.set(null));
    const startAssignee = this.dragStartAssignee;
    this.dragStartAssignee = undefined;

    // Reassign: if we dropped after a move in resource view, assign to the row under the cursor
    if (wasMove && taskId && this.isResourceView() && timelineEl) {
      const rect = timelineEl.getBoundingClientRect();
      const scrollParent = timelineEl.parentElement;
      const scrollTop = scrollParent ? scrollParent.scrollTop : 0;
      const offsetY = e.clientY - rect.top + scrollTop;
      const rowIndex = Math.floor(offsetY / this.rowHeight());
      const resources = this.orderedResources();
      if (rowIndex >= 0 && rowIndex < resources.length) {
        const res = resources[rowIndex];
        const newAssignee = res.id === '__unassigned__' ? '' : (res.id ?? '');
        const trimmedNew = (newAssignee ?? '').trim();
        const trimmedStart = (startAssignee ?? '').trim();
        if (trimmedNew !== trimmedStart) {
          const sig = this.tasksSignal;
          if (sig) {
            this.ngZone.run(() =>
              sig.update((list) =>
                list.map((t) => (t.id === taskId ? { ...t, assignee: trimmedNew || undefined } : t))
              )
            );
          }
          this.ngZone.run(() => this.taskChange.emit({ id: taskId, assignee: trimmedNew || undefined }));
        }
      }
    }
  }

  private getTimelineWidthPx(el: HTMLElement | null): number {
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) return rect.width;
    const sw = (el as HTMLElement & { scrollWidth?: number }).scrollWidth;
    if (sw > 0) return sw;
    const ow = el.offsetWidth;
    if (ow > 0) return ow;
    const parent = el.parentElement;
    if (parent) return (parent as HTMLElement & { scrollWidth?: number }).scrollWidth || parent.clientWidth || 0;
    return 0;
  }

  onBarMouseDown(e: MouseEvent, layout: GanttBarLayout): void {
    if (layout.task.type === 'milestone' || !this.isResourceView()) return;
    e.preventDefault();
    e.stopPropagation();
    const inner = (e.target as HTMLElement).closest('.gantt-timeline-inner') as HTMLElement | null;
    const w = this.getTimelineWidthPx(inner);
    if (w <= 0) return;
    this.dragTaskId = layout.task.id;
    this.dragMode = 'move';
    this.dragInitialClientX = e.clientX;
    this.dragStartStartMs = parseDate(layout.task.start).getTime();
    this.dragStartEndMs = parseDate(layout.task.end).getTime();
    this.dragTimelineWidth = w;
    this.dragTimelineInner = inner;
    this.dragStartAssignee = layout.task.assignee;
    document.addEventListener('mousemove', this.moveHandler);
    document.addEventListener('mouseup', this.upHandler);
  }

  onResizeMouseDown(e: MouseEvent, layout: GanttBarLayout, side: 'left' | 'right'): void {
    e.preventDefault();
    e.stopPropagation();
    const inner = (e.target as HTMLElement).closest('.gantt-timeline-inner') as HTMLElement | null;
    const w = this.getTimelineWidthPx(inner);
    if (w <= 0) return;
    this.dragTaskId = layout.task.id;
    this.dragMode = side === 'left' ? 'resize-left' : 'resize-right';
    this.dragInitialClientX = e.clientX;
    this.dragStartStartMs = parseDate(layout.task.start).getTime();
    this.dragStartEndMs = parseDate(layout.task.end).getTime();
    this.dragTimelineWidth = w;
    document.addEventListener('mousemove', this.moveHandler);
    document.addEventListener('mouseup', this.upHandler);
  }

  onTimelineContextMenu(e: MouseEvent): void {
    if (!this.isResourceView()) return;
    e.preventDefault();
    const inner = (e.currentTarget as HTMLElement);
    const rect = inner.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const rowIndex = Math.floor(offsetY / this.rowHeight());
    const resources = this.orderedResources();
    if (rowIndex < 0 || rowIndex >= resources.length) return;
    const res = resources[rowIndex];
    if (res.id === '__unassigned__') return;
    const displayStart = this.displayRangeStart().getTime();
    const rangeEnd = this.rangeEnd().getTime();
    const totalMs = rangeEnd - displayStart;
    const width = rect.width;
    const xPercent = width > 0 ? offsetX / width : 0;
    const startMs = displayStart + xPercent * totalMs;
    const startDate = new Date(startMs);
    const endDate = addUnit(startDate, 'day', 1);
    const resourceId = typeof res.id === 'string' ? res.id : (res as { id: string }).id;
    this.ngZone.run(() =>
      this.contextMenu.set({
        type: 'create',
        x: e.clientX,
        y: e.clientY,
        resourceId,
        start: toISODate(startDate),
        end: toISODate(endDate),
      })
    );
  }

  onBarContextMenu(e: MouseEvent, layout: GanttBarLayout): void {
    e.preventDefault();
    e.stopPropagation();
    this.contextMenu.set({
      type: 'task',
      x: e.clientX,
      y: e.clientY,
      task: layout.task,
    });
  }

  setTaskStatus(task: GanttTask, status: GanttTaskStatus): void {
    const progress = status === 'complete' ? 100 : status === 'not-started' ? 0 : (task.progress ?? 0);
    const patch = { id: task.id, status, progress };
    const sig = this.tasksSignal;
    if (sig) {
      sig.update((list) => list.map((t) => (t.id === task.id ? { ...t, ...patch } : t)));
    }
    this.taskChange.emit(patch);
    this.contextMenu.set(null);
  }

  deleteTask(task: GanttTask): void {
    const sig = this.tasksSignal;
    if (sig) {
      sig.update((list) => list.filter((t) => t.id !== task.id));
    }
    this.taskDelete.emit(task);
    this.contextMenu.set(null);
  }

  getResourceIdAtRow(rowIndex: number): string | null {
    const resources = this.orderedResources();
    const res = resources[rowIndex];
    if (!res || res.id === '__unassigned__') return null;
    return typeof res.id === 'string' ? res.id : (res as { id: string }).id;
  }

  onCreateTaskFromMenu(): void {
    const menu = this.contextMenu();
    if (!menu || menu.type !== 'create') return;
    const payload = { resourceId: menu.resourceId, start: menu.start, end: menu.end };
    const sig = this.tasksSignal;
    if (sig) {
      sig.update((list) => [
        ...list,
        {
          id: `task-${Date.now()}`,
          name: 'New task',
          start: menu.start,
          end: menu.end,
          assignee: menu.resourceId,
          progress: 0,
          category: 'General',
        },
      ]);
    }
    this.createTaskRequest.emit(payload);
    this.contextMenu.set(null);
  }

  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  onTaskClick(task: GanttTask): void {
    if (this.justFinishedDrag) {
      this.justFinishedDrag = false;
      return;
    }
    this.taskClick.emit(task);
  }

  trackByTaskId(_: number, t: GanttTask): string {
    return t.id;
  }

  trackDisplayRow(i: number, row: GanttDisplayRow): string {
    return row.type === 'header' ? `h-${row.resourceId}` : `t-${row.task.id}`;
  }

  trackByDepId(_: number, d: { dep: GanttDependency }): string {
    return d.dep.id;
  }
}
