import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetChartBar } from './widget-chart-bar';

describe('WidgetChartBar', () => {
  let component: WidgetChartBar;
  let fixture: ComponentFixture<WidgetChartBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetChartBar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetChartBar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
