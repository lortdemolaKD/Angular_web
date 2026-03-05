import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RadialGauge } from './radial-gauge';

describe('RadialGauge', () => {
  let component: RadialGauge;
  let fixture: ComponentFixture<RadialGauge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RadialGauge]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RadialGauge);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
