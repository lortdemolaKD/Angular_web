import {Component, computed, input} from '@angular/core';
import {SmartChartComponent, type ChartDatum} from '../../../NEW for implemnet/smart-chart/smart-chart';
import {AuditDataService} from '../../../Services/audit-data.service';
import {CommonModule, NgIf} from '@angular/common';

@Component({
  selector: 'app-widget-audit-completion',
  imports: [
    CommonModule, NgIf, SmartChartComponent
  ],
  templateUrl: './widget-audit-completion.html',
  styleUrl: './widget-audit-completion.css',
})
export class WidgetAuditCompletion  {
  // Optional: if you want per-location donut (WidgetCom can pass widget.locationId)
  locationId = input<string | undefined>(undefined);
  constructor(private aS: AuditDataService) {}

  // Wrap it in a computed so it reads after construction
  readonly audits = computed(() => this.aS.audits());

  readonly filteredAudits = computed(() => {
    const all = this.audits() ?? [];
    const locId = this.locationId();
    return locId ? all.filter(a => a.locationId === locId) : all;
  });

  readonly completedCount = computed(() =>
    (this.filteredAudits() ?? []).filter(a =>
      (a.questions ?? []).every(q => (q.evidence?.length ?? 0) > 0)
    ).length
  );

  readonly totalCount = computed(() => (this.filteredAudits() ?? []).length);
  readonly outstandingCount = computed(() => this.totalCount() - this.completedCount());

  readonly series = computed(() => [this.completedCount(), this.outstandingCount()]);
  readonly labels = computed(() => ['Complete', 'Outstanding']);

  readonly pieData = computed((): ChartDatum[] => [
    { label: 'Complete', value: this.completedCount() },
    { label: 'Outstanding', value: this.outstandingCount() }
  ]);
}
