import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ReactiveFormsModule, FormArray, FormGroup, FormControl, Validators, FormBuilder } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Role } from '../../Types';

export interface InviteEntry {
  email: string;
  role: Role;
}

export interface LocationInvitesDialogData {
  locationName: string;
  invites: InviteEntry[];
}

const INVITE_ROLE_OPTIONS: Role[] = [
  'RegisteredManager',
  'Supervisor',
  'CareWorker',
  'SeniorCareWorker',
  'Auditor',
];

@Component({
  selector: 'app-location-invites-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    ReactiveFormsModule,
  ],
  templateUrl: './location-invites-dialog.html',
  styleUrl: './location-invites-dialog.css',
})
export class LocationInvitesDialogComponent {
  form: FormGroup<{ rows: FormArray<FormGroup<{ email: FormControl<string>; role: FormControl<Role> }>> }>;
  roleOptions = INVITE_ROLE_OPTIONS;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<LocationInvitesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: LocationInvitesDialogData
  ) {
    const rows = this.fb.array(
      (data.invites?.length ? data.invites : [{ email: '', role: 'CareWorker' }]).map((e) =>
        this.fb.group({
          email: this.fb.control(e.email || '', { nonNullable: true, validators: [Validators.email] }),
          role: this.fb.control<Role>((e.role || 'CareWorker') as Role, { nonNullable: true }),
        })
      )
    );
    this.form = this.fb.group({ rows });
  }

  get rows(): FormArray<FormGroup<{ email: FormControl<string>; role: FormControl<Role> }>> {
    return this.form.get('rows') as FormArray;
  }

  addRow(): void {
    this.rows.push(
      this.fb.group({
        email: this.fb.control('', { nonNullable: true, validators: [Validators.email] }),
        role: this.fb.control<Role>('CareWorker', { nonNullable: true }),
      })
    );
  }

  removeRow(index: number): void {
    if (this.rows.length > 1) {
      this.rows.removeAt(index);
    }
  }

  done(): void {
    const entries: InviteEntry[] = this.rows.controls
      .map((g) => ({ email: (g.get('email')?.value ?? '').trim(), role: g.get('role')?.value ?? 'CareWorker' }))
      .filter((e) => e.email.length > 0);
    this.dialogRef.close(entries);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
