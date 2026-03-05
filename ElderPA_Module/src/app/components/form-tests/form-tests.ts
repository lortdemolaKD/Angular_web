import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { NgFor, NgIf } from '@angular/common';
import { UserType } from '../Types';
import { AuthService } from '../../Services/Auth.service';
import { Panel } from '../panel/panel';
import { SetupService } from '../../Services/setup.service';

@Component({
  selector: 'app-form-tests',
  standalone: true,
  imports: [
    MatIconModule,
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    NgFor,
    NgIf,
    ReactiveFormsModule,
    Panel
  ],
  templateUrl: './form-tests.html',
  styleUrl: './form-tests.css'
})
export class FormTests implements OnInit {
  directorForm: FormGroup;
  user!: UserType | null;
  locationTypes = ['Care Home', 'Home Care'];
  roomTypes = ['Single', 'Double', 'Twin', 'Suite'];
  feeTypes = ['Care Band', 'Room Size', 'Dependency'];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private setupService: SetupService
  ) {
    this.directorForm = this.fb.group({
      name: this.authService.getCurrentUser()?.name || '',
      companies: this.fb.array([])
    });
  }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) return;
    this.user = user;
  }

  // CORE GETTERS
  get companies() {
    return this.directorForm.get('companies') as FormArray;
  }

  serviceTypes(companyIndex: number): FormArray {
    return this.companies.at(companyIndex).get('serviceTypes') as FormArray;
  }

  locations(companyIndex: number, serviceIndex: number): FormArray {
    return this.serviceTypes(companyIndex).at(serviceIndex).get('locations') as FormArray;
  }

  // AREAS/WINGS
  areas(companyIndex: number, serviceIndex: number, locationIndex: number): FormArray {
    return this.locations(companyIndex, serviceIndex).at(locationIndex).get('areas') as FormArray;
  }

  areaControl(ci: number, si: number, li: number, ai: number): FormControl {
    return this.areas(ci, si, li).at(ai) as FormControl;
  }

  addArea(companyIndex: number, serviceIndex: number, locationIndex: number) {
    this.areas(companyIndex, serviceIndex, locationIndex).push(this.fb.control(''));
  }

  removeArea(companyIndex: number, serviceIndex: number, locationIndex: number, index: number) {
    this.areas(companyIndex, serviceIndex, locationIndex).removeAt(index);
  }

  wings(companyIndex: number, serviceIndex: number, locationIndex: number): FormArray {
    return this.locations(companyIndex, serviceIndex).at(locationIndex).get('wings') as FormArray;
  }

  wingControl(ci: number, si: number, li: number, wi: number): FormControl {
    return this.wings(ci, si, li).at(wi) as FormControl;
  }

  addWing(companyIndex: number, serviceIndex: number, locationIndex: number) {
    this.wings(companyIndex, serviceIndex, locationIndex).push(this.fb.control(''));
  }

  removeWing(companyIndex: number, serviceIndex: number, locationIndex: number, index: number) {
    this.wings(companyIndex, serviceIndex, locationIndex).removeAt(index);
  }

  // ROOMS & FACILITIES
  rooms(companyIndex: number, serviceIndex: number, locationIndex: number): FormArray {
    return this.locations(companyIndex, serviceIndex).at(locationIndex).get('rooms') as FormArray;
  }

  addRoom(companyIndex: number, serviceIndex: number, locationIndex: number) {
    this.rooms(companyIndex, serviceIndex, locationIndex).push(this.fb.group({
      number: ['', Validators.required],
      type: ['', Validators.required],
      area: '',
      wing: '',
      facilities: this.fb.array([])
    }));
  }

  removeRoom(companyIndex: number, serviceIndex: number, locationIndex: number, index: number) {
    this.rooms(companyIndex, serviceIndex, locationIndex).removeAt(index);
  }

  facilities(companyIndex: number, serviceIndex: number, locationIndex: number, roomIndex: number): FormArray {
    return this.rooms(companyIndex, serviceIndex, locationIndex).at(roomIndex).get('facilities') as FormArray;
  }

  facilityControl(ci: number, si: number, li: number, ri: number, fi: number): FormControl {
    return this.facilities(ci, si, li, ri).at(fi) as FormControl;
  }

  addFacility(companyIndex: number, serviceIndex: number, locationIndex: number, roomIndex: number) {
    this.facilities(companyIndex, serviceIndex, locationIndex, roomIndex).push(this.fb.control(''));
  }

  removeFacility(companyIndex: number, serviceIndex: number, locationIndex: number, roomIndex: number, index: number) {
    this.facilities(companyIndex, serviceIndex, locationIndex, roomIndex).removeAt(index);
  }

  // ROOM GROUPS & FEE RULES
  roomGroups(companyIndex: number, serviceIndex: number, locationIndex: number): FormArray {
    return this.locations(companyIndex, serviceIndex).at(locationIndex).get('roomGroups') as FormArray;
  }

  addRoomGroup(companyIndex: number, serviceIndex: number, locationIndex: number) {
    this.roomGroups(companyIndex, serviceIndex, locationIndex).push(this.fb.group({
      name: ['', Validators.required],
      feeRules: this.fb.array([])
    }));
  }

  removeRoomGroup(companyIndex: number, serviceIndex: number, locationIndex: number, index: number) {
    this.roomGroups(companyIndex, serviceIndex, locationIndex).removeAt(index);
  }

  feeRules(companyIndex: number, serviceIndex: number, locationIndex: number, groupIndex: number): FormArray {
    return this.roomGroups(companyIndex, serviceIndex, locationIndex).at(groupIndex).get('feeRules') as FormArray;
  }

  addFeeRule(companyIndex: number, serviceIndex: number, locationIndex: number, groupIndex: number) {
    this.feeRules(companyIndex, serviceIndex, locationIndex, groupIndex).push(this.fb.group({
      careBand: '',
      dependency: '',
      rate: [0, Validators.required],
      enhancements: this.fb.array([])
    }));
  }

  removeFeeRule(companyIndex: number, serviceIndex: number, locationIndex: number, groupIndex: number, index: number) {
    this.feeRules(companyIndex, serviceIndex, locationIndex, groupIndex).removeAt(index);
  }

  // ENHANCEMENTS (room group fee rules)
  enhancements(companyIndex: number, serviceIndex: number, locationIndex: number,
               groupIndex: number, feeRuleIndex: number): FormArray {
    return this.feeRules(companyIndex, serviceIndex, locationIndex, groupIndex)
      .at(feeRuleIndex).get('enhancements') as FormArray;
  }

  addEnhancement(companyIndex: number, serviceIndex: number, locationIndex: number,
                 groupIndex: number, feeRuleIndex: number) {
    this.enhancements(companyIndex, serviceIndex, locationIndex, groupIndex, feeRuleIndex).push(
      this.fb.group({
        type: ['', Validators.required],
        value: [0, Validators.required]
      })
    );
  }

  removeEnhancement(companyIndex: number, serviceIndex: number, locationIndex: number,
                    groupIndex: number, feeRuleIndex: number, enhancementIndex: number) {
    this.enhancements(companyIndex, serviceIndex, locationIndex, groupIndex, feeRuleIndex).removeAt(enhancementIndex);
  }

  // CLIENT GROUPS
  clientGroups(companyIndex: number, serviceIndex: number, locationIndex: number): FormArray {
    return this.locations(companyIndex, serviceIndex).at(locationIndex).get('clientGroups') as FormArray;
  }

  addClientGroup(companyIndex: number, serviceIndex: number, locationIndex: number) {
    this.clientGroups(companyIndex, serviceIndex, locationIndex).push(this.fb.group({
      name: ['', Validators.required],
      enhancements: this.fb.array([])
    }));
  }

  removeClientGroup(companyIndex: number, serviceIndex: number, locationIndex: number, index: number) {
    this.clientGroups(companyIndex, serviceIndex, locationIndex).removeAt(index);
  }

  enhancementsClientGroup(companyIndex: number, serviceIndex: number, locationIndex: number, cgi: number): FormArray {
    return this.clientGroups(companyIndex, serviceIndex, locationIndex).at(cgi).get('enhancements') as FormArray;
  }

  addEnhancementClientGroup(companyIndex: number, serviceIndex: number, locationIndex: number, cgi: number) {
    this.enhancementsClientGroup(companyIndex, serviceIndex, locationIndex, cgi).push(
      this.fb.group({
        type: '',
        value: 0
      })
    );
  }

  removeEnhancementClientGroup(companyIndex: number, serviceIndex: number, locationIndex: number, cgi: number, ei: number) {
    this.enhancementsClientGroup(companyIndex, serviceIndex, locationIndex, cgi).removeAt(ei);
  }

  // BASIC OPERATIONS
  addCompany() {
    this.companies.push(this.fb.group({
      name: ['', Validators.required],
      serviceTypes: this.fb.array([])
    }));
  }

  removeCompany(index: number) {
    this.companies.removeAt(index);
  }

  addServiceType(companyIndex: number) {
    this.serviceTypes(companyIndex).push(this.fb.group({
      name: ['', Validators.required],
      locations: this.fb.array([])
    }));
  }

  removeServiceType(companyIndex: number, index: number) {
    this.serviceTypes(companyIndex).removeAt(index);
  }

  addLocation(companyIndex: number, serviceIndex: number) {
    this.locations(companyIndex, serviceIndex).push(this.fb.group({
      name: ['', Validators.required],
      type: ['', Validators.required],
      areas: this.fb.array([]),
      wings: this.fb.array([]),
      rooms: this.fb.array([]),
      roomGroups: this.fb.array([]),
      clientGroups: this.fb.array([])
    }));
  }

  removeLocation(companyIndex: number, serviceIndex: number, index: number) {
    this.locations(companyIndex, serviceIndex).removeAt(index);
  }

  // VALIDATION & SUBMIT
  validateCompanies(): boolean {
    if (this.companies.length === 0) this.addCompany();
    this.directorForm.markAllAsTouched();
    return this.directorForm.valid;
  }

  submitToDb() {
    if (this.directorForm.invalid) {
      this.directorForm.markAllAsTouched();
      return;
    }
    const payload = this.directorForm.value;
    console.log('FORM PAYLOAD', payload);
    this.setupService.createCompanyFull(payload).subscribe({
      next: (result) => console.log('Saved', result),
      error: (err) => {
        console.error('HTTP ERROR', err);
        console.error('BACKEND MESSAGE', err?.error?.message);
        console.error('BACKEND BODY', err?.error);
      }
    });
  }

  downloadJSON() {
    const data = JSON.stringify(this.directorForm.value, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'director-data.json';
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
