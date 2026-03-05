import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DualRadialGauge } from './dual-radial-gauge';

describe('DualRadialGauge', () => {
  let component: DualRadialGauge;
  let fixture: ComponentFixture<DualRadialGauge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DualRadialGauge]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DualRadialGauge);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
