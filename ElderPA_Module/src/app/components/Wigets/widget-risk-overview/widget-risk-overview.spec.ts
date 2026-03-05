import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetRiskOverview } from './widget-risk-overview';

describe('WidgetRiskOverview', () => {
  let component: WidgetRiskOverview;
  let fixture: ComponentFixture<WidgetRiskOverview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetRiskOverview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetRiskOverview);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
