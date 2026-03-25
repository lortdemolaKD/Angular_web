import { Component, inject, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatStepperModule } from '@angular/material/stepper';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { NgFor, NgIf } from '@angular/common';
import { SetupService } from '../../Services/setup.service';
import { CqcService, CqcLocationSuggestion } from '../../Services/cqc.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { WalkthroughRegistryService } from '../../Services/walkthrough-registry.service';
import { catchError, forkJoin, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CompanyService } from '../../Services/Company.service';
import { LocationService } from '../../Services/location.service';
import { LocationInvitesDialogComponent, InviteEntry } from './location-invites-dialog/location-invites-dialog';
import { Role } from '../Types';

interface LoadedCompany {
  id: string;
  name: string;
  director?: string;
  address?: string;
  registrationNumber?: string;
  serviceTypes: { name: string; locations: { name: string; type: 'CareHome' | 'HomeCare'; _invites?: string[] }[] }[];
}
type ServiceType = 'CareHome' | 'HomeCare' | 'LiveInCare' | 'AssistedLiving';

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  CareHome: 'Care Home',
  HomeCare: 'Home Care',
  LiveInCare: 'Live-in Care',
  AssistedLiving: 'Assisted Living',
};

interface CompanyDto {
  id: string;
  name: string;
  director?: string;
  address?: string;
  registrationNumber?: string;
  cqcProviderId?: string;
  registeredIn?: 'England' | 'Wales' | 'Scotland';
  adminContact?: string;
  serviceTypes: ServiceType[];
}

interface LocationDto {
  name: string;
  type: ServiceType;
  townPostcode?: string;
  cqcLocationId?: string;
  address?: string;
  telephone?: string;
  serviceArea?: string;
  numberOfBedrooms?: number;
  managerInfo?: string;
  _invites?: string[];
  _inviteRoles?: Role[];
}

type InviteRow = FormGroup<{ email: FormControl<string>; role: FormControl<Role> }>;
type LocationForm = FormGroup<{
  name: FormControl<string>;
  townPostcode: FormControl<string>;
  cqcLocationId: FormControl<string>;
  address: FormControl<string>;
  telephone: FormControl<string>;
  serviceArea: FormControl<string>;
  numberOfBedrooms: FormControl<number | null>;
  managerInfo: FormControl<string>;
  inviteList: FormArray<InviteRow>;
}>;
@Component({
  selector: 'app-company-setup',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatStepperModule,
    MatIconModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    NgFor,
    NgIf
  ],
  templateUrl: './company-setup.html',
  styleUrl: './company-setup.css',
})
export class CompanySetup implements OnInit {
  private fb = inject(FormBuilder);
  private setupService = inject(SetupService);
  private companyService = inject(CompanyService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private cqcService = inject(CqcService);
  private dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);
  private walkthrough = inject(WalkthroughRegistryService);

  constructor(private locationService: LocationService) {}

  /** CQC Provider ID verification state */
  cqcVerifyStatus = signal<'idle' | 'verifying' | 'valid' | 'invalid'>('idle');
  cqcVerifyMessage = signal<string>('');

  /** CQC Location search: keyed by 'serviceIndex-locIndex' */
  cqcLocationSuggestions = signal<Record<string, CqcLocationSuggestion[]>>({});
  private cqcSearch$ = new Subject<{ key: string; query: string }>();
  setupForm = this.fb.group({
    company: this.fb.group({
      name: ['', Validators.required],
      director: [''],
      companyRegisteredNumber: [''],
      cqcProviderId: [''],
      registeredAddress: [''],
      registeredIn: ['England' as 'England' | 'Wales' | 'Scotland'],
      adminContact: ['']
    }),
    services: this.fb.array([])
  });

  isEditMode = false;
  companyId: string | null = null;
  isLoading = true;

  // ✅ Getters (unchanged)
  get servicesArr() {
    return this.setupForm.get('services') as FormArray;
  }

  get companyGroup() {
    return this.setupForm.get('company') as FormGroup;
  }

  get servicesPreview(): any[] {
    return this.setupForm.get('services')?.value || [];
  }

  get companyName(): string {
    return this.setupForm.get('company.name')?.value || '';
  }

  /** True if at least one service type is Care Home (show Step 4). */
  hasCareHomeService(): boolean {
    return this.servicesArr.controls.some(s => s.get('type')?.value === 'CareHome');
  }

  getCqcLocationSuggestions(serviceIndex: number, locIndex: number): CqcLocationSuggestion[] {
    return this.cqcLocationSuggestions()[`${serviceIndex}-${locIndex}`] ?? [];
  }

  onCqcLocationSearch(serviceIndex: number, locIndex: number, query: string): void {
    const key = `${serviceIndex}-${locIndex}`;
    this.cqcSearch$.next({ key, query });
  }

  selectCqcLocation(serviceIndex: number, locIndex: number, opt: CqcLocationSuggestion): void {
    const locGroup = this.getLocations(serviceIndex).at(locIndex);
    locGroup.patchValue({
      cqcLocationId: opt.id,
      ...(opt.name && { name: opt.name }),
      ...(opt.address && { address: opt.address })
    });
    this.cdr.markForCheck();
  }

  verifyCqcProvider(): void {
    const id = this.companyGroup.get('cqcProviderId')?.value?.trim();
    if (!id) {
      this.cqcVerifyMessage.set('Enter a CQC Provider ID first');
      this.cqcVerifyStatus.set('invalid');
      return;
    }
    this.cqcVerifyStatus.set('verifying');
    this.cqcVerifyMessage.set('');
    this.cqcService.verifyProviderId(id).subscribe((res) => {
      if (res.valid) {
        this.cqcVerifyStatus.set('valid');
        this.cqcVerifyMessage.set(res.name ? `Verified: ${res.name}` : 'Provider ID found in CQC');
      } else {
        this.cqcVerifyStatus.set('invalid');
        this.cqcVerifyMessage.set(res.message ?? 'Not found in CQC');
      }
      this.cdr.markForCheck();
    });
  }

  openInvitesDialog(serviceIndex: number, locIndex: number): void {
    const locGroup = this.getLocations(serviceIndex).at(locIndex) as FormGroup & { get: (path: string) => any };
    const inviteList = locGroup.get('inviteList') as FormArray;
    const invites: InviteEntry[] = inviteList.controls.map((row) => ({
      email: row.get('email')?.value ?? '',
      role: (row.get('role')?.value ?? 'CareWorker') as Role
    }));
    const locationName = locGroup.get('name')?.value || `Location ${locIndex + 1}`;
    this.dialog.open(LocationInvitesDialogComponent, {
      width: '520px',
      data: { locationName, invites }
    }).afterClosed().subscribe((result: InviteEntry[] | null) => {
      if (result) {
        inviteList.clear();
        result.forEach((e) => {
          inviteList.push(this.fb.group({
            email: this.fb.control(e.email, { nonNullable: true }),
            role: this.fb.control<Role>(e.role, { nonNullable: true })
          }));
        });
        this.cdr.markForCheck();
      }
    });
  }

  getInviteList(serviceIndex: number, locIndex: number): FormArray<InviteRow> {
    return this.getLocations(serviceIndex).at(locIndex).get('inviteList') as FormArray<InviteRow>;
  }

  getInviteCount(serviceIndex: number, locIndex: number): number {
    return this.getInviteList(serviceIndex, locIndex)?.length ?? 0;
  }

  ngOnInit() {
    this.walkthrough.register('/setup/company', [
      {
        targetId: 'setupCompany.step1Title',
        title: 'Step 1',
        description: 'Set up the organisation details (name, address, and CQC provider).',
      },
      {
        targetId: 'setupCompany.nextStep1Button',
        title: 'Next',
        description: 'Continue to service type setup.',
      },
      {
        targetId: 'setupCompany.step2Title',
        title: 'Step 2',
        description: 'Choose service types and add company locations for each service.',
      },
      {
        targetId: 'setupCompany.serviceButtons',
        title: 'Service buttons',
        description: 'Click to add Care Home, Home Care, Live-in Care, or Assisted Living.',
      },
      {
        targetId: 'setupCompany.step4Title',
        title: 'Step 4',
        description: 'Configure the Care Home setup pack if you added Care Home service.',
      },
      {
        targetId: 'setupCompany.readyToLaunchTitle',
        title: 'Ready to launch',
        description: 'Review what you configured and create the organisation.',
      },
      {
        targetId: 'setupCompany.createOrganisationButton',
        title: 'Create Organisation',
        description: 'Submit the wizard and create the organisation in the system.',
      },
    ]);

    this.loadCurrentCompany();
    this.cqcSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged((a, b) => a.key === b.key && a.query === b.query),
      switchMap(({ key, query }) =>
        this.cqcService.searchLocations(query).pipe(
          catchError(() => of([])),
          map((list) => ({ key, list }))
        )
      )
    ).subscribe(({ key, list }) => {
      this.cqcLocationSuggestions.update((m) => ({ ...m, [key]: list }));
      this.cdr.markForCheck();
    });
  }

  // ✅ NEW: Load existing company
  private loadCurrentCompany() {
    // Force CompanyService init by accessing observables
    this.companyService.currentCompany$;  // Triggers constructor if not run
    this.companyService.currentLocation$;

    let companyId: string | null = this.companyService.getCurrentCompany()!._id;

    // Fallback: Check LS directly + refetch user if needed
    if (!companyId) {
      companyId = localStorage.getItem('companyID');
    }
    if (!companyId) {
      console.warn('No company ID in service/LS. Fetching from /api/auth/me...');
      this.http.get<any>('/api/auth/me').subscribe({
        next: (user) => {
          if (user.companyId) {
            this.companyService.setCurrentCompany(user.companyId);
            this.loadCompanyDetails(user.companyId);
          } else {
            this.handleNoCompany();
          }
        },
        error: () => this.handleNoCompany()
      });
      return;
    }

    this.companyId = companyId;
    this.isEditMode = true;
    this.loadCompanyDetails(companyId);
  }

  private loadCompanyDetails(companyId: string) {
    this.isLoading = true;

    forkJoin({
      company: this.http.get<CompanyDto>(`/api/companies/${companyId}`),
      locations: this.locationService.list(companyId)
    }).subscribe({
      next: ({ company, locations }) => {

        /* -------------------------------
         * COMPANY
         * ------------------------------- */
        this.companyGroup.patchValue({
          name: company.name,
          director: company.director ?? '',
          companyRegisteredNumber: (company as any).companyRegisteredNumber ?? company.registrationNumber ?? '',
          cqcProviderId: (company as any).cqcProviderId ?? '',
          registeredAddress: company.address ?? '',
          registeredIn: (company as any).registeredIn ?? 'England',
          adminContact: (company as any).adminContact ?? ''
        });

        /* -------------------------------
         * SERVICES (DERIVED)
         * ------------------------------- */
        this.buildServices(company.serviceTypes, locations);

        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }
  private buildServices(
    serviceTypes: ServiceType[],
    locations: LocationDto[]
  ): void {

    this.servicesArr.clear();

    serviceTypes.forEach(type => {

      const locationsFormArray = this.fb.array<LocationForm>([]);

      const relevantLocations = locations.filter(l => l.type === type);

      if (relevantLocations.length) {
        relevantLocations.forEach(loc => {
          locationsFormArray.push(this.createLocationGroup(loc));
        });
      } else {
        locationsFormArray.push(this.createLocationGroup(null));
      }

      this.servicesArr.push(
        this.fb.group({
          name: this.fb.control(SERVICE_TYPE_LABELS[type] ?? type, { nonNullable: true }),
          type: this.fb.control(type, { nonNullable: true }),
          locations: locationsFormArray
        })
      );
    });
  }

  private createLocationGroup(loc: LocationDto | null): FormGroup {
    const invites = loc?._invites ?? [];
    const roles = (loc as any)?._inviteRoles as Role[] | undefined;
    const inviteList = this.fb.array(
      invites.length
        ? invites.map((email, idx) =>
            this.fb.group({
              email: this.fb.control(email, { nonNullable: true }),
              role: this.fb.control<Role>(roles?.[idx] ?? 'CareWorker', { nonNullable: true })
            })
          )
        : []
    );
    return this.fb.group({
      name: this.fb.control(loc?.name ?? '', { nonNullable: true }),
      townPostcode: this.fb.control((loc as any)?.townPostcode ?? '', { nonNullable: true }),
      cqcLocationId: this.fb.control((loc as any)?.cqcLocationId ?? '', { nonNullable: true }),
      address: this.fb.control(loc?.address ?? '', { nonNullable: true }),
      telephone: this.fb.control((loc as any)?.telephone ?? '', { nonNullable: true }),
      serviceArea: this.fb.control((loc as any)?.serviceArea ?? '', { nonNullable: true }),
      numberOfBedrooms: this.fb.control<number | null>((loc as any)?.numberOfBedrooms ?? null),
      managerInfo: this.fb.control((loc as any)?.managerInfo ?? '', { nonNullable: true }),
      inviteList
    });
  }

  addService(type: ServiceType) {
    if (this.servicesArr.controls.some(s => s.get('type')?.value === type)) {
      return;
    }
    this.servicesArr.push(
      this.fb.group({
        name: this.fb.control(SERVICE_TYPE_LABELS[type] ?? type, { nonNullable: true }),
        type: this.fb.control(type, { nonNullable: true }),
        locations: this.fb.array<LocationForm>([this.createLocationGroup(null)])
      })
    );
  }

  private handleNoCompany() {
    console.log('Create mode: No existing company for this user.');
    this.isEditMode = false;
    this.isLoading = false;
    // Optionally redirect: this.router.navigate(['/register-org-admin']);
  }

  // Actions (unchanged except submit)
  addLocation(serviceIndex: number) {
    this.getLocations(serviceIndex).push(this.createLocationGroup(null));
  }


  removeService(index: number) {
    this.servicesArr.removeAt(index);
  }

  getLocations(serviceIndex: number) {
    return this.servicesArr.at(serviceIndex).get('locations') as FormArray;
  }



  removeLocation(serviceIndex: number, locIndex: number) {
    this.getLocations(serviceIndex).removeAt(locIndex);
  }

  // ✅ UPDATED: Now updates instead of creates
  submit() {
    if (this.setupForm.invalid || this.isLoading) return;

    const formVal = this.setupForm.value;
    const locationsWithInvites: { location: any; inviteList: InviteEntry[] }[] = [];
    const updateData = {
      name: formVal.company?.name,
      director: formVal.company?.director,
      address: formVal.company?.registeredAddress,
      registrationNumber: formVal.company?.companyRegisteredNumber,
      cqcProviderId: formVal.company?.cqcProviderId,
      registeredIn: formVal.company?.registeredIn,
      adminContact: formVal.company?.adminContact,
      serviceTypes: formVal.services?.map((s: any) => ({
        name: s.type,
        locations: (s.locations || []).map((l: any) => {
          const inviteList = (l.inviteList || []).map((row: any) => ({
            email: row.email?.trim() || '',
            role: row.role || 'CareWorker'
          })).filter((e: InviteEntry) => e.email);
          if (inviteList.length) locationsWithInvites.push({ location: l, inviteList });
          return {
            name: l.name,
            type: s.type,
            townPostcode: l.townPostcode,
            cqcLocationId: l.cqcLocationId,
            address: l.address,
            telephone: l.telephone,
            serviceArea: l.serviceArea,
            numberOfBedrooms: l.numberOfBedrooms != null && l.numberOfBedrooms !== '' ? Number(l.numberOfBedrooms) : undefined,
            managerInfo: l.managerInfo,
            _invites: inviteList.map((e: InviteEntry) => e.email),
            _inviteRoles: inviteList.map((e: InviteEntry) => e.role)
          };
        })
      }))
    };

    const doSendInvites = (companyId: string, locationIds?: string[]) => {
      if (locationsWithInvites.length === 0) return;
      const payload = locationIds
        ? locationsWithInvites.map((item, idx) => ({ locationId: locationIds[idx], invites: item.inviteList }))
        : locationsWithInvites.map((item) => ({ invites: item.inviteList }));
      this.setupService.sendInvitesAfterSetup(companyId, payload).subscribe({
        next: () => {},
        error: (err) => console.warn('Some invites could not be sent', err)
      });
    };

    if (!this.companyId) {
      this.setupService.createCompanyFull({ companies: [updateData] }).subscribe({
        next: (res: any) => {
          const companyId = res?.company?.id ?? res?.id ?? res?.companies?.[0]?.id;
          const locationIds = res?.locationIds ?? res?.locations?.map((l: any) => l.id);
          if (companyId) doSendInvites(companyId, locationIds);
          this.router.navigate(['/']);
        },
        error: (err) => console.error('Create failed', err)
      });
      return;
    }

    this.setupService.updateCompany(this.companyId, updateData).subscribe({
      next: () => {
        doSendInvites(this.companyId!);
        this.router.navigate(['/']);
      },
      error: (err) => console.error('Update failed', err)
    });
  }
}
