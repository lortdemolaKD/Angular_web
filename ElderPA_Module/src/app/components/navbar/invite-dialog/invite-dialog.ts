import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../Services/Auth.service';
import { Role } from '../../Types';

export interface InviteDialogLocation {
  id: string;
  name: string;
}

export interface InviteDialogData {
  companyId: string;
  companyName: string;
  locationId: string | null;
  locationName: string | null;
  /** Locations for the current company (so user can pick one when role requires it) */
  locations?: InviteDialogLocation[];
}

const INVITE_ROLE_OPTIONS: Role[] = [
  'RegisteredManager',
  'Supervisor',
  'CareWorker',
  'SeniorCareWorker',
  'Auditor',
];

/** Roles that require a location to be selected (backend returns 400 otherwise) */
const LOCATION_REQUIRED_FOR: Role[] = ['Supervisor', 'CareWorker', 'SeniorCareWorker', 'Auditor'];

@Component({
  selector: 'app-invite-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    ReactiveFormsModule,
  ],
  templateUrl: './invite-dialog.html',
  styleUrl: './invite-dialog.css',
})
export class InviteDialogComponent {
  inviteForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    role: new FormControl<Role>('CareWorker', { nonNullable: true }),
    locationId: new FormControl<string | null>(null),
  });

  inviteRoleOptions = INVITE_ROLE_OPTIONS;
  inviteError = '';
  inviteSuccessUrl = '';
  /** Message from API (e.g. "Invitation sent successfully!" or "Email not configured...") */
  inviteMessage = '';
  /** True if the API reports that the email was sent */
  inviteEmailSent: boolean | null = null;
  /** If email failed to send, the error from the server */
  inviteEmailError = '';


  get roleRequiresLocation(): boolean {
    const role = this.inviteForm.get('role')?.value;
    return !!(role && LOCATION_REQUIRED_FOR.includes(role));
  }

  get locationRequiredButMissing(): boolean {
    if (!this.roleRequiresLocation) return false;
    const locationId = this.effectiveLocationId;
    return !locationId;
  }

  /** Resolved location: from form dropdown if role requires it, else from navbar context */
  get effectiveLocationId(): string | null {
    if (this.roleRequiresLocation && this.data.locations?.length) {
      return this.inviteForm.get('locationId')?.value ?? null;
    }
    return this.data.locationId;
  }

  constructor(
    public dialogRef: MatDialogRef<InviteDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: InviteDialogData,
    private authService: AuthService
  ) {
    if (this.data.locations == null) this.data.locations = [];
    const preSelect = this.data.locationId && this.data.locations.some((l) => l.id === this.data.locationId)
      ? this.data.locationId
      : this.data.locations[0]?.id ?? null;
    this.inviteForm.patchValue({ locationId: preSelect });
  }

  submitInvite() {
    if (!this.inviteForm.valid) return;
    if (this.locationRequiredButMissing) {
      this.inviteError = 'Please select a location below (required for this role).';
      return;
    }
    this.inviteError = '';
    this.inviteMessage = '';
    this.inviteEmailSent = null;
    this.inviteEmailError = '';
    const { email, role } = this.inviteForm.getRawValue();
    this.authService
      .sendInvite(email, role, this.data.companyId, this.effectiveLocationId)
      .subscribe({
        next: (res: { link?: string; message?: string; emailSent?: boolean; emailError?: string }) => {
          this.inviteSuccessUrl = res?.link ?? '';
          this.inviteMessage = res?.message ?? '';
          this.inviteEmailSent = res?.emailSent ?? null;
          this.inviteEmailError = res?.emailError ?? '';
        },
        error: (err) => {
          this.inviteError = err?.error?.message || 'Failed to create invite';
        },
      });
  }

  copyLink() {
    if (this.inviteSuccessUrl) {
      navigator.clipboard.writeText(this.inviteSuccessUrl);
      this.dialogRef.close({ copied: true });
    }
  }

  close() {
    this.dialogRef.close();
  }
}
