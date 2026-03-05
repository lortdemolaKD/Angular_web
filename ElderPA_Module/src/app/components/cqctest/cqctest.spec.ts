import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CQCTest } from './cqctest';

describe('CQCTest', () => {
  let component: CQCTest;
  let fixture: ComponentFixture<CQCTest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CQCTest]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CQCTest);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
