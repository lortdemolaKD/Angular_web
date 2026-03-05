import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetGovernancePlanner } from './widget-governance-planner';

describe('WidgetGovernancePlanner', () => {
  let component: WidgetGovernancePlanner;
  let fixture: ComponentFixture<WidgetGovernancePlanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetGovernancePlanner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetGovernancePlanner);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
