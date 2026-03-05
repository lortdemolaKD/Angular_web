import { Component, Input } from '@angular/core';
import { LocationType, UserType } from '../../Types';
import { NgForOf, NgIf } from '@angular/common';
import { CompanyService } from '../../../Services/Company.service';
import { AuthService } from '../../../Services/Auth.service';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-widget-monitored-location',
  imports: [
    NgForOf,
    NgIf
  ],
  templateUrl: './widget-monitored-location.html',
  styleUrl: './widget-monitored-location.css',
})
export class WidgetMonitoredLocation {
  @Input() isAdmin: boolean = false;
  @Input() user!: UserType | null;
  @Input() LocElements: LocationType[] = [];
  /** IDs of locations currently monitored on the dashboard (from DashboardService). */
  @Input() monitoredLocationIds: string[] = [];

  @Input() setTest!: (value: string[], removedLocationId?: string) => void;
  selectedElementId?: string;

  constructor(
    private companyService: CompanyService,
    private authService: AuthService,
    private router: Router,
    private dialog: MatDialog
  ) {}

  private monitoredSet(): Set<string> {
    return new Set(this.monitoredLocationIds ?? []);
  }

  getSortedLocations(descending = true): LocationType[] {
    const mon = this.monitoredSet();
    return [...(this.LocElements ?? [])].sort((a, b) => {
      const aId = a.locationID ?? a.id ?? '';
      const bId = b.locationID ?? b.id ?? '';
      const aMonitored = mon.has(aId) ? 1 : 0;
      const bMonitored = mon.has(bId) ? 1 : 0;

      if (aMonitored !== bMonitored) return bMonitored - aMonitored;

      const scoreA = this.calculateComplianceScore(a);
      const scoreB = this.calculateComplianceScore(b);
      return descending ? scoreB - scoreA : scoreA - scoreB;
    });
  }

  // Req 6.3: Overall compliance score logic
  calculateComplianceScore(location: LocationType): number {
    const alerts = location.performance?.alerts?.length || 0;
    // Simple mock calculation: higher alerts = lower score
    return Math.max(0, 100 - (alerts * 5));
  }
  selectLocation(location: LocationType): void {
    const id = location.locationID ?? location.id ?? '';
    this.selectedElementId = id;
    this.companyService.setCurrentLocation(id, location);
  }

  isMonitored(locationId: string): boolean {
    return this.monitoredSet().has(locationId);
  }

  toggleMonitorLocation(locationId: string): void {
    const mon = this.monitoredSet();
    const wasMonitored = mon.has(locationId);
    const nextIds = wasMonitored
      ? (this.monitoredLocationIds ?? []).filter((id) => id !== locationId)
      : [...(this.monitoredLocationIds ?? []), locationId];
    const removedLocationId = wasMonitored ? locationId : undefined;
    this.setTest(nextIds, removedLocationId);
  }

}
