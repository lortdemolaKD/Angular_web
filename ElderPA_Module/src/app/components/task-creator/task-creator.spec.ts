import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskCreator } from './task-creator';

describe('TaskCreator', () => {
  let component: TaskCreator;
  let fixture: ComponentFixture<TaskCreator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskCreator]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskCreator);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
