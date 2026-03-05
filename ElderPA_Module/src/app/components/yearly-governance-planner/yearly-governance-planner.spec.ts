import { ComponentFixture, TestBed } from '@angular/core/testing';

import { YearlyGovernancePlanner } from './yearly-governance-planner';

describe('YearlyGovernancePlanner', () => {
  let component: YearlyGovernancePlanner;
  let fixture: ComponentFixture<YearlyGovernancePlanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [YearlyGovernancePlanner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(YearlyGovernancePlanner);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
