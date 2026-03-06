import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiConfigService } from './api-config.service';

/**
 * Rewrites /api and /uploads requests to the configured API service URL when set.
 * Run before the auth interceptor so the final URL is used for the request.
 */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const apiBaseUrl = inject(ApiConfigService).getApiBaseUrl();
  if (!apiBaseUrl || (!req.url.startsWith('/api') && !req.url.startsWith('/uploads'))) {
    return next(req);
  }
  const url = req.url.startsWith('http') ? req.url : `${apiBaseUrl}${req.url}`;
  return next(req.clone({ url }));
};
