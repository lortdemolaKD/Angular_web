import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { LocalStorageService } from './Services/LocalStorage.service';
import { JwtHelperService } from '@auth0/angular-jwt';

export const guestGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const ls = inject(LocalStorageService);

  const token = ls.getID('token');
  const userType = ls.getID('userType');

  if (token && userType) {
    const jwt = new JwtHelperService();
    // If the client has a stale/expired token, allow access to /login and clear auth state.
    if (jwt.isTokenExpired(token)) {
      ls.removeID('token');
      ls.removeID('userType');
      ls.removeID('userId');
      ls.removeID('companyID');
      ls.removeID('locationID');
      return true;
    }

    const returnUrl = route.queryParams['returnUrl'];
    if (returnUrl && typeof returnUrl === 'string' && returnUrl.startsWith('/') && !returnUrl.startsWith('/login')) {
      router.navigateByUrl(returnUrl);
    } else {
      router.navigate(['/']);
    }
    return false;
  }

  return true;
};
