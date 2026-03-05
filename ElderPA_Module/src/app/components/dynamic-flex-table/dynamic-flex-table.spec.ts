import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DynamicFlexTable } from './dynamic-flex-table';

describe('DynamicFlexTable', () => {
  let component: DynamicFlexTable;
  let fixture: ComponentFixture<DynamicFlexTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DynamicFlexTable]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DynamicFlexTable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
