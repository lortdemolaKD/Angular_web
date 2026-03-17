
import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);


  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }


  // Include token for same-origin /api or for absolute API URLs (when using separate API service)
  const isApiRequest = req.url.startsWith('/api') || req.url.includes('/api');
  if (!isApiRequest) return next(req);

  const token = localStorage.getItem('token');
  if (!token) return next(req);

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    })
  );
};
