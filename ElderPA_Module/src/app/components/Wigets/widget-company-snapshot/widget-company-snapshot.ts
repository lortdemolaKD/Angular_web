import { Component, computed, input } from '@angular/core';
import { CompanyType, LocationType } from '../../Types';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-widget-company-snapshot',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './widget-company-snapshot.html',
  styleUrl: './widget-company-snapshot.css',
})
export class WidgetCompanySnapshot {
  ComElements = input<CompanyType[]>([]);
  LocElements = input<LocationType[]>([]);

  readonly company = computed(() => (this.ComElements() ?? [])[0] ?? null);
  readonly companyName = computed(() => this.company()?.name ?? '—');
  readonly locationCount = computed(() => (this.LocElements() ?? []).length);
}
