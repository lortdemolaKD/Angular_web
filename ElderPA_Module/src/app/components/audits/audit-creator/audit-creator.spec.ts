import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuditCreator } from './audit-creator';

describe('AuditCreator', () => {
  let component: AuditCreator;
  let fixture: ComponentFixture<AuditCreator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditCreator]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuditCreator);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
