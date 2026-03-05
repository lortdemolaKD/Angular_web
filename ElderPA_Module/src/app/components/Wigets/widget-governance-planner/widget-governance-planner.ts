import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { YearlyGovernancePlanner } from '../../yearly-governance-planner/yearly-governance-planner';

@Component({
  selector: 'app-widget-governance-planner',
  imports: [YearlyGovernancePlanner],
  templateUrl: './widget-governance-planner.html',
  styleUrl: './widget-governance-planner.css',
})
export class WidgetGovernancePlanner implements OnChanges {
  @Input() viewType: 'month' | 'week' | 'day' = 'month';
  @Input() companyId: string | null = null;
  @Input() locationID: string | null = null;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['viewType'] || changes['companyId'] || changes['locationID']) {
      this.updatePlanner();
    }
  }

  private updatePlanner() {}
}
