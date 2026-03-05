import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompanySetup } from './company-setup';

describe('CompanySetup', () => {
  let component: CompanySetup;
  let fixture: ComponentFixture<CompanySetup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanySetup]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompanySetup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
