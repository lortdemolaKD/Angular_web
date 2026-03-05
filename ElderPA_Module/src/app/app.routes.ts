import { Routes } from '@angular/router';

import { Home } from './components/home/home';
import { Company } from './components/company/company';
import { BonusPanel } from './components/bonus-panel/bonus-panel';
import { Locations } from './components/locations/locations';
import { Ccga } from './components/ccga/ccga';
import { AuditPanel } from './components/audits/audit-panel/audit-panel';
import { AuditCreator } from './components/audits/audit-creator/audit-creator';
import { KeyMetricsPanel } from './components/key-metrics-panel/key-metrics-panel';
import { FormTests } from './components/form-tests/form-tests';
import {CompanySetup} from './components/company-setup/company-setup';
import { ChartTestPage } from './components/chart-test-page/chart-test-page';
import { TableTestPage } from './components/table-test-page/table-test-page';
import { GanttTestPage } from './components/gantt-test-page/gantt-test-page';

import { authGuard } from './auth-guard';
import { guestGuard } from './guest-Guard';

type Role =
  | 'SystemAdmin'
  | 'OrgAdmin'
  | 'RegisteredManager'
  | 'Supervisor'
  | 'CareWorker'
  | 'SeniorCareWorker'
  | 'Auditor';

const ADMIN_ROLES: Role[] = ['SystemAdmin', 'OrgAdmin'];
const DASHBOARD_ROLES: Role[] = ['SystemAdmin', 'OrgAdmin', 'RegisteredManager'];
const AUDIT_ROLES: Role[] = [
  'SystemAdmin',
  'OrgAdmin',
  'RegisteredManager',
  'Supervisor',
  'CareWorker',
  'SeniorCareWorker',
  'Auditor',
];

export const routes: Routes = [
  // Public
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./components/login/login').then((m) => m.Login),
  },

  // Protected
  { path: '', component: Home, canActivate: [authGuard], data: { roles: AUDIT_ROLES } },

  { path: 'organization', component: Company, canActivate: [authGuard], data: { roles: ADMIN_ROLES } },
  { path: 'companies', component: Locations, canActivate: [authGuard], data: { roles: AUDIT_ROLES } },
  { path: 'company', redirectTo: 'organization', pathMatch: 'full' },
  { path: 'locations', redirectTo: 'companies', pathMatch: 'full' },

  { path: 'CCGA', component: Ccga, canActivate: [authGuard], data: { roles: AUDIT_ROLES } },
  { path: 'CCGA/AuditLib', component: AuditPanel, canActivate: [authGuard], data: { roles: AUDIT_ROLES } },
  { path: 'CCGA/AuditCreator', component: AuditCreator, canActivate: [authGuard], data: { roles: AUDIT_ROLES } },
  { path: 'CCGAAuditLib', redirectTo: 'CCGA/AuditLib', pathMatch: 'full' },

  { path: 'KMP', component: KeyMetricsPanel, canActivate: [authGuard], data: { roles: DASHBOARD_ROLES } },
  {
    path: 'setup/company',
    component: CompanySetup,
    canActivate: [authGuard],
    data: {roles: ADMIN_ROLES}
  },
  // Keep setupcompany only if still used; with invite-only onboarding you may remove it later
  { path: 'setupcompany', component: FormTests, canActivate: [authGuard], data: { roles: ADMIN_ROLES } },



  { path: 'Bonus', component: BonusPanel, canActivate: [authGuard], data: { roles: AUDIT_ROLES } },

  { path: 'chart-test', component: ChartTestPage, canActivate: [authGuard], data: { roles: AUDIT_ROLES } },
  { path: 'table-test', component: TableTestPage, canActivate: [authGuard], data: { roles: AUDIT_ROLES } },
  { path: 'gantt-test', component: GanttTestPage, canActivate: [authGuard], data: { roles: AUDIT_ROLES } },

  { path: '**', redirectTo: 'login' },
];
