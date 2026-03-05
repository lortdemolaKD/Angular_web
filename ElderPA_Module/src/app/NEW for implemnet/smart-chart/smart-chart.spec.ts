import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SmartChart } from './smart-chart';

describe('SmartChart', () => {
  let component: SmartChart;
  let fixture: ComponentFixture<SmartChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SmartChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SmartChart);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
