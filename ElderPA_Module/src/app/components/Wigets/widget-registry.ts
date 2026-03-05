import { Type } from '@angular/core';
import { WidgetContentKey } from '../Types';

import { WidgetAlerts } from './widget-alerts/widget-alerts';
import { WidgetChartBar } from './widget-chart-bar/widget-chart-bar';
import { WidgetMonitoredLocation } from './widget-monitored-location/widget-monitored-location';
import { WidgetRadialGauge } from './widget-radial-gauge/widget-radial-gauge';
import { WidgetRadialBarChart } from './widget-radial-bar-chart/widget-radial-bar-chart';
import { WidgetTasksBoard } from './widget-tasks-board/widget-tasks-board';
import { WidgetAuditCompletion } from './widget-audit-completion/widget-audit-completion';
import { WidgetRiskOverview } from './widget-risk-overview/widget-risk-overview';
import { WidgetGovernancePlanner } from './widget-governance-planner/widget-governance-planner';
import { WidgetLocationsSummary } from './widget-locations-summary/widget-locations-summary';
import { WidgetAlertsCount } from './widget-alerts-count/widget-alerts-count';
import { WidgetTasksCount } from './widget-tasks-count/widget-tasks-count';
import { WidgetCompanySnapshot } from './widget-company-snapshot/widget-company-snapshot';
import { WidgetIndicatorSummary } from './widget-indicator-summary/widget-indicator-summary';

export const WIDGET_COMPONENTS: Record<WidgetContentKey, Type<unknown>> = {
  alerts: WidgetAlerts,
  bar: WidgetChartBar,
  location: WidgetMonitoredLocation,
  radialGauge: WidgetRadialGauge,
  radialBarChart: WidgetRadialBarChart,
  tasksBoard: WidgetTasksBoard,
  governancePlanner: WidgetGovernancePlanner,
  auditCompletion: WidgetAuditCompletion,
  riskOverview: WidgetRiskOverview,
  locationsSummary: WidgetLocationsSummary,
  alertsCount: WidgetAlertsCount,
  tasksCount: WidgetTasksCount,
  companySnapshot: WidgetCompanySnapshot,
  indicatorSummary: WidgetIndicatorSummary,
};
