import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlexibleTemplateSystem } from './flexible-template-system';

describe('FlexibleTemplateSystem', () => {
  let component: FlexibleTemplateSystem;
  let fixture: ComponentFixture<FlexibleTemplateSystem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlexibleTemplateSystem]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FlexibleTemplateSystem);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
