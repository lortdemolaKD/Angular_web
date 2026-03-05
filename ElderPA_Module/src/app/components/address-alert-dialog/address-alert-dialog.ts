import { Component, Inject } from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MAT_DATE_LOCALE, MatNativeDateModule, NativeDateAdapter} from '@angular/material/core';

import {FormsModule} from '@angular/forms';
import {BrowserModule} from '@angular/platform-browser';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-address-alert-dialog',
  imports:  [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    FormsModule
  ],
  templateUrl: './address-alert-dialog.html',
  styleUrls: ['./address-alert-dialog.css'],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'en-GB' }, // optional locale
  ]
})
export class AddressAlertDialog {

  form = {
    assignedTo: '',
    category: '',
    description: '',
    dueDate: null as Date | null
  };

  constructor(
    public dialogRef: MatDialogRef<AddressAlertDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { alert: any; currentUserId: string; locationManagerId: string }
  ) {}

  submit() {
    this.dialogRef.close({
      ...this.form,
      alertId: this.data.alert.id,
      assignedBy: this.data.currentUserId,
      assignedTo: this.data.locationManagerId,
      status: 'Open' as const
    });
  }

  cancel() {
    this.dialogRef.close();
  }
}
