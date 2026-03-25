import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIf, NgOptimizedImage } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../Services/Auth.service';
import { LocalStorageService } from '../../Services/LocalStorage.service';
import type { Role } from '../Types';
import { WalkthroughRegistryService } from '../../Services/walkthrough-registry.service';

type Mode = 'login' | 'register' | 'invite';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, NgOptimizedImage, MatIconModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  mode: Mode = 'login';

  inviteToken: string | null = null;
  inviteData: { companyName: string; role: Role } | null = null;

  form = new FormGroup({
    // Shared
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true }),
    rememberMe: new FormControl(false, { nonNullable: true }),

    // Register fields (always exist, just hidden)
    role: new FormControl<Role>('OrgAdmin', { nonNullable: true }),
    companyName: new FormControl('', { nonNullable: true }),
    director: new FormControl('', { nonNullable: true }),
    CQCnumber: new FormControl('', { nonNullable: true }),
    address: new FormControl('', { nonNullable: true }),
    registeredIn: new FormControl<'England' | 'Wales' | 'Scotland'>('England'),
    adminContact: new FormControl('', { nonNullable: true }),
    companyId: new FormControl('', { nonNullable: true }),
  });

  error = '';
  /** True when register-invite returned 409 (email already has an account) */
  showGoToLogin = false;
  /** Toggle password field visibility */
  passwordVisible = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private ls: LocalStorageService,
    private walkthrough: WalkthroughRegistryService,
  ) {}

  private hasCompany(): boolean {
    return !!this.ls.getID('companyID');
  }

  private isOrgAdminLike(role: Role): boolean {
    return ['SystemAdmin', 'OrgAdmin'].includes(role);
  }
  ngOnInit() {
    this.walkthrough.register('/login', [
      {
        targetId: 'login.tabSignIn',
        title: 'Sign in',
        description: 'Use “Sign In” to access your existing account.',
      },
      {
        targetId: 'login.welcome',
        title: 'Welcome message',
        description: 'This heading changes depending on your mode (login, register, invite).',
      },
      {
        targetId: 'login.passwordToggle',
        title: 'Password visibility',
        description: 'You can toggle password visibility to confirm what you typed.',
      },
      {
        targetId: 'login.submit',
        title: 'Continue',
        description: 'When the form is valid, this button submits your login/register/invite flow.',
      },
      {
        targetId: 'login.forgotPassword',
        title: 'Forgot password',
        description: 'Use this link if you need help regaining access.',
      },
    ]);

    this.route.queryParams.subscribe((params) => {
      const token = params['token'];
      if (token) this.handleInvite(token);
    });
  }

  get isInvite() {
    return this.mode === 'invite';
  }
  get isRegister() {
    return this.mode === 'register';
  }

  private handleInvite(token: string) {
    this.authService.validateInvite(token).subscribe({
      next: (data) => {
        this.mode = 'invite';
        this.inviteToken = token;
        this.inviteData = { companyName: data.companyName, role: data.role };

        this.form.patchValue({
          email: data.email,
          role: data.role,
        });

        this.form.controls.email.disable(); // invite email is locked
      },
      error: () => {
        this.error = 'Invalid or expired invitation link.';
        this.mode = 'login';
        this.inviteToken = null;
        this.inviteData = null;
        this.form.controls.email.enable();
      },
    });
  }

  private postAuthNavigate() {
    const companyId = this.ls.getID('companyID');
    const locationId = this.ls.getID('locationID');

    if (!companyId || !locationId) {
      this.router.navigate(['setup/company']);  // ✅ SINGLE wizard
      return;
    }

    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    if (returnUrl && typeof returnUrl === 'string' && returnUrl.startsWith('/') && !returnUrl.startsWith('/login')) {
      this.router.navigateByUrl(returnUrl);
      return;
    }

    this.router.navigate(['/']);  // ✅ default home
  }



  setMode(mode: Mode) {
    if (this.inviteToken) return; // lock invite flow
    this.mode = mode;
  }

  // Update submit()
  /** Switch from invite flow to login (e.g. when email already has an account) */
  goToLogin() {
    this.mode = 'login';
    this.inviteToken = null;
    this.inviteData = null;
    this.error = '';
    this.showGoToLogin = false;
    this.form.controls.email.enable();
    this.router.navigate([], { queryParams: {}, queryParamsHandling: '' });
  }

  onForgotPassword(event: Event) {
    event.preventDefault();
    // Wire to forgot-password flow when implemented
  }

  submit() {
    this.error = '';
    this.showGoToLogin = false;
    const raw = this.form.getRawValue();
   // console.log(raw);

    // 1) Invite (unchanged) ✅
    if (this.isInvite) {
      if (!this.inviteToken || !raw.name || !raw.password) {
        this.error = 'Please set your name and password.';
        return;
      }
      this.authService.registerWithInvite(this.inviteToken, raw.name, raw.password).subscribe({
        next: () => this.postAuthNavigate(),
        error: (err) => {
          this.error = err?.error?.message ?? 'Registration failed';
          this.showGoToLogin = err?.status === 409;
        },
      });
      return;
    }

    // 2) Manual Register (FIXED)
    if (this.isRegister) {
      if (!raw.name || !raw.email || !raw.password) {
        this.error = 'Please fill name, email, and password.';
        return;
      }

      if (raw.role === 'OrgAdmin') {  // ✅ Your role name
        // ✅ Validate company fields
        if (!raw.companyName || !raw.registeredIn) {
          this.error = 'Company name and registration country required.';
          return;
        }

        const input = {
          admin: {
            name: raw.name!,
            email: raw.email!,
            password: raw.password!,
          },
          company: {
            name: raw.companyName!,
            director: raw.director || undefined,
            companyNumber: raw.companyId || undefined,  // ✅ Renamed for clarity
            CQCnumber: raw.CQCnumber || undefined,
            address: raw.address || undefined,
            registeredIn: raw.registeredIn!,  // ✅ Required
            adminContact: raw.adminContact || undefined,

          },
        };

        this.authService.registerOrgAdmin(input).subscribe({
          next: () => {
            // ✅ Check if company was created, then go home
            setTimeout(() => this.postAuthNavigate(), 500);  // Give backend time
          },
          error: (err) => (this.error = err?.error?.message ?? 'OrgAdmin registration failed'),
        });
        return;
      }

      this.error = `Role "${raw.role}" not supported for manual registration.`;
      return;
    }

    // 3) Login (unchanged) ✅
    this.authService.loginWithPassword(raw.email, raw.password).subscribe({
      next: () => this.postAuthNavigate(),
      error: (err) => (this.error = err?.error?.message ?? 'Login failed'),
    });
  }


}
