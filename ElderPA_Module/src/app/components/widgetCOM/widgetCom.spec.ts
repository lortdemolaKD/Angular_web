import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetCom } from './widgetCom';

describe('Widget', () => {
  let component: WidgetCom;
  let fixture: ComponentFixture<WidgetCom>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetCom]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetCom);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
