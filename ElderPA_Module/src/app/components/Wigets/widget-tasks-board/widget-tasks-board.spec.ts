import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WidgetTasksBoard } from './widget-tasks-board';

describe('WidgetTasksBoard', () => {
  let component: WidgetTasksBoard;
  let fixture: ComponentFixture<WidgetTasksBoard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WidgetTasksBoard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WidgetTasksBoard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
