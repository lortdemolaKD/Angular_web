import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetAuditCompletion } from './widget-audit-completion';

describe('WidgetAuditCompletion', () => {
  let component: WidgetAuditCompletion;
  let fixture: ComponentFixture<WidgetAuditCompletion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetAuditCompletion]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetAuditCompletion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
