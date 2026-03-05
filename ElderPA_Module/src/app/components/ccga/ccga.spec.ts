import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Ccga } from './ccga';

describe('Ccga', () => {
  let component: Ccga;
  let fixture: ComponentFixture<Ccga>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ccga]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Ccga);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
