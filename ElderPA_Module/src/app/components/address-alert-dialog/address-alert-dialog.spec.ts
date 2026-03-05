import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddressAlertDialog } from './address-alert-dialog';

describe('AddressAlertDialog', () => {
  let component: AddressAlertDialog;
  let fixture: ComponentFixture<AddressAlertDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddressAlertDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddressAlertDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
