import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetAlerts } from './widget-alerts';

describe('WidgetAlerts', () => {
  let component: WidgetAlerts;
  let fixture: ComponentFixture<WidgetAlerts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetAlerts]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetAlerts);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
