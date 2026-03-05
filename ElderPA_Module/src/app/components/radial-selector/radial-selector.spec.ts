import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RadialSelector } from './radial-selector';

describe('RadialSelector', () => {
  let component: RadialSelector;
  let fixture: ComponentFixture<RadialSelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RadialSelector]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RadialSelector);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
