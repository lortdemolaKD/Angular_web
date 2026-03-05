import { Component, Input } from '@angular/core';
import { NgForOf, NgIf } from "@angular/common";

import { AddressAlertDialog } from '../../address-alert-dialog/address-alert-dialog';

import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { LocationType, UserType } from '../../Types';

import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-widget-alerts',
  standalone: true,
  imports: [
    NgForOf,
    NgIf,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './widget-alerts.html',
  styleUrl: './widget-alerts.css',
})
export class WidgetAlerts {
  @Input() isAdmin: boolean = false;
  @Input() user!: UserType | null;
  @Input() LocElements: LocationType[] = [];

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private http: HttpClient,
  ) {}

  // Alerts come from LocElements which should be DB-backed locations + their current performance set hydrated
  get allAlerts() {
    return this.LocElements.flatMap(loc =>
      (loc.performance?.alerts ?? []).map(a => ({
        ...a,
        location: loc.name,
        // company name should come from DB-backed company list elsewhere;
        // keep it optional here to avoid MOCK_COMPANY usage
        company: (loc as any).companyName ?? null,
        // keep a reference so we can patch the correct performance set
        _locationId: loc.locationID,
        _performanceSetId: (loc as any).currentPerformanceSetId ?? null,
      }))
    );
  }

  selectedAlert: any | null = null;

  openAddressDialog(alert: any) {
    this.selectedAlert = alert;

    const dialogRef = this.dialog.open(AddressAlertDialog, {
      width: '420px',
      data: {
        alert,
        currentUserId: this.user?.name,
        // You can replace this with a real DB lookup of the manager if/when you expose it
        locationManagerId: undefined,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result) return;

      const performanceSetId = alert?._performanceSetId;
      if (!performanceSetId) {
        console.warn('No performanceSetId on alert/location. Cannot save task to DB.');
        return;
      }

      const newTask = {
        id: `task-${Date.now()}`,
        alertId: result.alertId,
        assignedBy: result.assignedBy,
        assignedTo: result.assignedTo,
        category: result.category,
        description: result.description,
        dueDate: result.dueDate.toISOString(),
        status: 'Open' as const,
        comments: [],
      };

      // 1) Fetch the current set (so we can append task safely)
      const set: any = await this.http
        .get(`/api/performanceSets/${performanceSetId}`)
        .toPromise();

      const nextTasks = [...(set?.tasks ?? []), newTask];

      // 2) Patch tasks back to DB (your API supports PATCH /:id) [file:4]
      await this.http
        .patch(`/api/performanceSets/${performanceSetId}`, { tasks: nextTasks })
        .toPromise();

      console.log('Task created (DB):', newTask);
    });
  }

  async hasTask(alert: any): Promise<boolean> {
    const performanceSetId = alert?._performanceSetId;
    if (!performanceSetId) return false;

    const set: any = await this.http
      .get(`/api/performanceSets/${performanceSetId}`)
      .toPromise();

    return (set?.tasks ?? []).some((t: any) => t.alertId === alert.id);
  }

  async pingManager(alert: any) {
    // Placeholder: implement as DB notification endpoint later
    console.log(`Ping manager for alert ${alert.id}`);
  }
}
