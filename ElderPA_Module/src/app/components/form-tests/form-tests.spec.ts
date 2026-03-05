import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormTests } from './form-tests';

describe('FormTests', () => {
  let component: FormTests;
  let fixture: ComponentFixture<FormTests>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormTests]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FormTests);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
