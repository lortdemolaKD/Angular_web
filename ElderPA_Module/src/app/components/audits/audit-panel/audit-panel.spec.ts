import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuditPanel } from './audit-panel';

describe('AuditPanel', () => {
  let component: AuditPanel;
  let fixture: ComponentFixture<AuditPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuditPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
