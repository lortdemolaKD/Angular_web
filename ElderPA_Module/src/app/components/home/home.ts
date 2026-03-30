import {
  Component,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import {CommonModule,} from '@angular/common';

import { FormsModule } from '@angular/forms';
import {Dashboard} from '../dashboard/dashboard';
import { WalkthroughRegistryService, type WalkthroughStep } from '../../Services/walkthrough-registry.service';
import { DashboardService } from '../../Services/dashboard-service';
import { type Widget } from '../Types';

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  imports: [
    CommonModule,


    FormsModule,

    Dashboard,


  ],
  styleUrl: './home.css'
})
export class Home implements OnInit {
  private readonly walkthrough = inject(WalkthroughRegistryService);
  private readonly dashboardStore = inject(DashboardService);

  private homeWidgetFingerprint = '';

  private readonly staticSteps: WalkthroughStep[] = [
    {
      targetId: 'home.dashboardTitle',
      title: 'Dashboard overview',
      description:
        'This is your main operational place for managing your data. It shows the widgets typically set up for you and all budgets. You can add, remove, or rearrange widgets to customize what appears in your view.',
    },
    {
      targetId: 'home.addWidgets',
      title: 'Add widgets',
      description:
        'Press this button to view the list of available widgets. Not everything is available right now—some widgets appear after you start monitoring locations. If you need more specific data for a company, first select it, then add the widgets you want to see.',
      panelPlacement: 'left',
    },
    {
      targetId: 'home.editModeToggle',
      title: 'Edit mode',
      description:
        'Edit mode is the precise way to configure your dashboard. When you enable it, you can move widgets around the grid. Widgets can have different sizes, and each widget may have its own settings—for example, options that expand its width/height or select specific data to display. Some choices may be unavailable depending on role and widget type.',
      panelPlacement: 'left',
    },
    {
      targetId: 'home.widgetsArea',
      title: 'Widgets area',
      description:
        'The widgets area holds everything you see on your dashboard. In edit mode you can drag and rearrange widgets. When you switch back to view mode, you still see everything in an organized layout, but without the ability to move it.',
    },
  ];

  ngOnInit(): void {
    // Initial registration (covers the static controls immediately).
    this.walkthrough.register('home', this.staticSteps);

    // Then register one step per visible widget (widget IDs + content types).
    effect(() => {
      const widgets = this.dashboardStore.addedWidgets();
      const fingerprint = widgets.map((w) => `${w.id}|${w.contentKey}|${w.metricType ?? ''}`).join(',');
      if (fingerprint === this.homeWidgetFingerprint) return;
      this.homeWidgetFingerprint = fingerprint;

      const widgetSteps = widgets.map((w) => ({
        targetId: `dashboard.widget.${w.id}`,
        title: w.label,
        description: this.describeWidget(w),
      }));

      this.walkthrough.register('home', [...this.staticSteps, ...widgetSteps]);
    });
  }

  private describeWidget(w: Widget): string {
    const metricType = w.metricType ? ` (${w.metricType})` : '';

    switch (w.contentKey) {
      case 'alerts':
        return `Active alerts at a glance. Use this widget to spot what needs action first, then assign tasks from the alerts list.`;
      case 'alertsCount':
        return `Summary of alerts. A quick way to see whether conditions are stable (green) or need intervention (amber/red).`;
      case 'tasksBoard':
        return `Tasks board. Pick a task to complete and keep the dashboard alerts under control.`;
      case 'tasksCount':
        return `Summary of open tasks so you can prioritize resolution work before alerts escalate.`;
      case 'governancePlanner':
        return `Yearly governance planning. Use month/week/day views, then click markers on the timeline to open audits (or pick from a list when several share the same slot). Right-click works too.`;
      case 'auditCompletion':
        return `Audit completion overview. Use it to understand progress and what remains outstanding.`;
      case 'riskOverview':
        return `Risk overview of monitored areas. Review top risks and focus on indicators that drive issues.`;
      case 'locationsSummary':
        return `Location summary. Review monitored sites and how they are performing at a high level.`;
      case 'companySnapshot':
        return `Company snapshot of health and key metrics to support quick decision-making.`;
      case 'indicatorSummary':
        return `Indicator summary across KPI/KFI/KCI to quickly see status distribution and trends.`;
      case 'bar':
        return `Chart widget for${metricType}. This shows current indicator values and highlights where values breach targets.`;
      case 'location':
        return `Location selector and overview. Pick the right context so the dashboard widgets display the correct data.`;
      default:
        return `Widget${metricType}. Review its key values and drill into details where needed.`;
    }
  }
}
