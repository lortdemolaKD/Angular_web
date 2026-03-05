import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EvidenceLibrary } from './evidence-library';

describe('EvidenceLibrary', () => {
  let component: EvidenceLibrary;
  let fixture: ComponentFixture<EvidenceLibrary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvidenceLibrary]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EvidenceLibrary);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
