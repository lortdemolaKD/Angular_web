import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BonusPanel } from './bonus-panel';

describe('CompanySummary', () => {
  let component: BonusPanel;
  let fixture: ComponentFixture<BonusPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BonusPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BonusPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
