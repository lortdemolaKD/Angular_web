import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CSTButton } from './cst-button';

describe('CSTButton', () => {
  let component: CSTButton;
  let fixture: ComponentFixture<CSTButton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CSTButton]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CSTButton);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
