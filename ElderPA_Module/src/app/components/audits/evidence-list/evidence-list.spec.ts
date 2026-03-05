import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EvidenceList } from './evidence-list';

describe('EvidenceList', () => {
  let component: EvidenceList;
  let fixture: ComponentFixture<EvidenceList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvidenceList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EvidenceList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
