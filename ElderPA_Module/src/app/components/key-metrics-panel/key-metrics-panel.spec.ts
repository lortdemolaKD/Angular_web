import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KeyMetricsPanel } from './key-metrics-panel';

describe('KeyMetricsPanel', () => {
  let component: KeyMetricsPanel;
  let fixture: ComponentFixture<KeyMetricsPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeyMetricsPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KeyMetricsPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
