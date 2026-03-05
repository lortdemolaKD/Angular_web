import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RadialBarChart } from './radial-bar-chart';

describe('RadialBarChart', () => {
  let component: RadialBarChart;
  let fixture: ComponentFixture<RadialBarChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RadialBarChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RadialBarChart);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
