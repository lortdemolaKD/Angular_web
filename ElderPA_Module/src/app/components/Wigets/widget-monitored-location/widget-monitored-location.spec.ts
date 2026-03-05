import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetMonitoredLocation } from './widget-monitored-location';

describe('WidgetMonitoredLocation', () => {
  let component: WidgetMonitoredLocation;
  let fixture: ComponentFixture<WidgetMonitoredLocation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetMonitoredLocation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetMonitoredLocation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
