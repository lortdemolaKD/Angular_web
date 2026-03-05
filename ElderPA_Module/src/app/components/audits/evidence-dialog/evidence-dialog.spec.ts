import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EvidenceDialog } from './evidence-dialog';

describe('EvidenceDialog', () => {
  let component: EvidenceDialog;
  let fixture: ComponentFixture<EvidenceDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvidenceDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EvidenceDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
