import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WigetOptions } from './wiget-options';

describe('WigetOptions', () => {
  let component: WigetOptions;
  let fixture: ComponentFixture<WigetOptions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WigetOptions]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WigetOptions);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
