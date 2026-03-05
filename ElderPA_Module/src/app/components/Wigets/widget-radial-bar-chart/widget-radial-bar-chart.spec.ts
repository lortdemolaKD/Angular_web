import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetRadialBarChart } from './widget-radial-bar-chart';

describe('WidgetRadialBarChart', () => {
  let component: WidgetRadialBarChart;
  let fixture: ComponentFixture<WidgetRadialBarChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetRadialBarChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetRadialBarChart);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
