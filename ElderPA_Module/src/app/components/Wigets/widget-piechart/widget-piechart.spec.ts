import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetPiechart } from './widget-piechart';

describe('WidgetPiechart', () => {
  let component: WidgetPiechart;
  let fixture: ComponentFixture<WidgetPiechart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetPiechart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetPiechart);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
