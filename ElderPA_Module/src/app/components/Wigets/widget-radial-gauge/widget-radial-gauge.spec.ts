import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetRadialGauge } from './widget-radial-gauge';

describe('WidgetRadialGauge', () => {
  let component: WidgetRadialGauge;
  let fixture: ComponentFixture<WidgetRadialGauge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetRadialGauge]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetRadialGauge);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
