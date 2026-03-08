/**
 * Application routes configuration.
 * Centralized route constants for environment-based routing.
 */

// Public routes (accessible without authentication)
export const PUBLIC_ROUTES = {
  LOGIN: '/auth/cover-login',
  REGISTER: '/auth/cover-register',
  FORGOT_PASSWORD: '/auth/cover-password-reset',
} as const;

// Protected routes (require authentication)
export const PROTECTED_ROUTES = {
  DASHBOARD: '/finance',
  ORG_SELECTION: '/apps/organization-select',
} as const;

// Default redirect routes
export const DEFAULT_ROUTES = {
  LOGIN: PUBLIC_ROUTES.LOGIN,
  AFTER_LOGIN: PROTECTED_ROUTES.DASHBOARD,
  AFTER_ORG_SELECT: PROTECTED_ROUTES.DASHBOARD,
} as const;

/**
 * Check if a route is public (doesn't require authentication)
 */
export function isPublicRoute(path: string): boolean {
  return Object.values(PUBLIC_ROUTES).includes(path as any);
}

/**
 * Check if a route is protected (requires authentication)
 */
export function isProtectedRoute(path: string): boolean {
  return Object.values(PROTECTED_ROUTES).includes(path as any);
}
