import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BarChartMarkers } from './bar-chart-markers';

describe('BarChartMarkers', () => {
  let component: BarChartMarkers;
  let fixture: ComponentFixture<BarChartMarkers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BarChartMarkers]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BarChartMarkers);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
