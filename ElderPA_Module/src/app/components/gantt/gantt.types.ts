/**
 * Universal Gantt – types and config.
 * Supports: task list, timeline, bars, milestones, dependencies (FS/SS/FF/SF),
 * baseline vs actual, grouping, view presets, working time, zoom.
 */

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface GanttDependency {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  type: DependencyType;
  lag?: number; // days (negative = lead)
}

export type GanttTaskType = 'task' | 'milestone' | 'summary';

export type GanttTaskStatus = 'not-started' | 'in-progress' | 'complete' | 'on-hold' | 'at-risk';

export interface GanttTask {
  id: string;
  name: string;
  start: string; // ISO date
  end: string;   // ISO date (for milestone same as start)
  progress?: number; // 0–100
  type?: GanttTaskType;
  parentId?: string;
  /** For grouping (project, phase, team) */
  projectId?: string;
  projectName?: string;
  assignee?: string;
  status?: GanttTaskStatus;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  baselineStart?: string;
  baselineEnd?: string;
  /** Custom color override */
  color?: string;
  tags?: string[];
  expanded?: boolean;
  /** Task-level metadata for resource timeline */
  description?: string;
  /** Category or project label for filtering and color coding */
  category?: string;
  /** Optional deadline (visual marker / conflict detection) */
  deadline?: string;
  /** Estimated duration in days (optional) */
  estimatedDays?: number;
}

export type TimeScaleUnit = 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour';

/** Preset that sets both scale unit and visible range (day=hours in 1 day, week=days in 1 week, etc.) */
export type GanttTimeScalePreset = 'day' | 'week' | 'month' | 'year';

export type GanttViewPreset = 'roadmap' | 'release' | 'sprint' | 'day' | 'custom';

export interface GanttViewConfig {
  preset?: GanttViewPreset;
  scale: TimeScaleUnit;
  /** Primary header step (e.g. month when scale is week) */
  secondaryScale?: TimeScaleUnit;
  /** Working days 0=Sun .. 6=Sat */
  workDays?: number[];
  /** Holiday dates (ISO) to shade */
  holidays?: string[];
  showNonWorkingTime?: boolean;
  rowHeight?: number;
  taskListWidth?: number;
}

/** Resource type for hierarchy and display */
export type GanttResourceType = 'person' | 'team' | 'department' | 'machine' | 'other';

/** Worker/resource for resource timeline: one row per resource */
export interface GanttResource {
  id: string;
  name: string;
  /** Parent for multi-level hierarchy (org → department → team → individual) */
  parentId?: string;
  type?: GanttResourceType;
  /** Max concurrent tasks (default 1 = sequential). Or hours per week for capacity. */
  capacity?: number;
  /** Working hours per day (e.g. 8) for capacity-based overload */
  workingHoursPerDay?: number;
}

export interface GanttConfig {
  tasks: GanttTask[];
  dependencies?: GanttDependency[];
  view?: GanttViewConfig;
  /** Group tasks by this field (projectId, projectName, assignee, etc.) */
  groupBy?: keyof GanttTask | null;
  /** When 'resource', rows are workers; task list shows worker name + tasks with start/end (deadline) */
  viewMode?: 'task' | 'resource';
  /** Workers for resource view; rows show these even if no tasks. Assignee on task = resource id or name. */
  resources?: GanttResource[];
  showTodayLine?: boolean;
  showBaseline?: boolean;
  showProgress?: boolean;
  showDependencies?: boolean;
  /** Fit timeline to project range on init */
  fitToProject?: boolean;
  /** Start of visible range (ISO); if not set, derived from tasks */
  rangeStart?: string;
  /** End of visible range (ISO) */
  rangeEnd?: string;
  /** Filter tasks by status, project, category */
  filterBy?: { status?: GanttTaskStatus; projectId?: string; category?: string };
  /** Color map for category/project (visual differentiation) */
  categoryColors?: Record<string, string>;
  /** In resource view: show overload/conflict indicators on resource rows */
  showWorkloadIndicator?: boolean;
  /** In resource view: one row per resource with blocks on same row (true), or expanded task rows (false) */
  resourceRowMode?: 'compact' | 'expanded';
}

/** One row in the task list / timeline when using resource view */
export type GanttDisplayRow =
  | { type: 'header'; resourceId: string; resourceName: string; resourceIndex: number; taskCount: number; hasOverload?: boolean }
  | { type: 'task'; task: GanttTask; resourceId?: string; resourceIndex?: number };

export interface GanttBarLayout {
  task: GanttTask;
  rowIndex: number;
  xPercent: number;
  widthPercent: number;
  progressPercent: number;
  isMilestone: boolean;
  isLate: boolean;
  baselineX?: number;
  baselineWidth?: number;
  /** Overlap with another task on same resource (workload conflict) */
  hasOverlap?: boolean;
  /** Color from category or task.color */
  categoryColor?: string;
  /** For tooltip / accessibility */
  statusLabel?: string;
  /** Lane index when multiple tasks share a row (compact resource view) so they stack and stay clickable */
  laneIndex?: number;
  /** Number of lanes in this row (for bar height) */
  laneCount?: number;
}
