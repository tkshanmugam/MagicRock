'use client';

import { AuthService } from '@/lib/authService';
import { apiGet } from '@/lib/apiClient';
import { DEFAULT_ROUTES, PROTECTED_ROUTES } from '@/lib/routes';
import { organizationContext, ModulePermission } from '@/lib/organizationContext';
import { authState } from '@/lib/authState';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  redirectTo = DEFAULT_ROUTES.LOGIN,
}) => {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // Don't check auth if we're already on the login page
    if (window.location.pathname === redirectTo) {
      setIsAuthorized(false);
      setIsChecking(false);
      authState.setAuthStateReady(true);
      return;
    }

    const autoSelectOrganization = async (): Promise<void> => {
      if (organizationContext.getSelectedOrganizationId()) {
        return;
      }
      organizationContext.updateIsSuperAdminFromToken();
      if (organizationContext.getIsSuperAdmin()) {
        return;
      }
      try {
        const response = await apiGet<any>('organisations/me');
        const organizations = Array.isArray(response) ? response : response.data || response.results || [];
        if (!organizations.length) {
          return;
        }
        const orgId = Number(organizations[0]?.id);
        if (!orgId || Number.isNaN(orgId)) {
          return;
        }
        const permissionsResponse = await apiGet<any>(`organisations/${orgId}/permissions/me`);
        const permissionsPayload =
          permissionsResponse?.modules ||
          permissionsResponse?.data?.modules ||
          permissionsResponse?.results?.modules ||
          (Array.isArray(permissionsResponse) ? permissionsResponse : []);
        const permissions = (permissionsPayload || []) as ModulePermission[];
        organizationContext.setSelectedOrganizationId(orgId);
        organizationContext.setPermissions(permissions);
      } catch (error) {
        // Ignore auto-selection errors; allow user to continue without blocking.
      }
    };

    const checkAuth = (): void => {
      // Small delay to ensure localStorage is ready
      setTimeout(() => {
        const authenticated = AuthService.isAuthenticated();
        const refreshFailed = authState.hasRefreshTokenFailed();
        
        // Mark auth state as ready
        authState.setAuthStateReady(true);

        // Only redirect if:
        // 1. User is not authenticated (no tokens), OR
        // 2. Refresh token has explicitly failed (refresh attempt returned 401)
        // Do NOT redirect just because access token is expired - let API client handle refresh
        if (!authenticated || refreshFailed) {
          setIsAuthorized(false);
          setIsChecking(false);
          
          // Only redirect if we're not already on the login page
          if (window.location.pathname !== redirectTo) {
            router.replace(redirectTo);
          }
        } else {
          void (async () => {
            // User is authenticated and refresh hasn't failed
            await autoSelectOrganization();

            if (window.location.pathname === PROTECTED_ROUTES.ORG_SELECTION) {
              router.replace(DEFAULT_ROUTES.AFTER_LOGIN);
              return;
            }

            setIsAuthorized(true);
            setIsChecking(false);
          })();
        }
      }, 100); // Small delay to ensure localStorage is accessible
    };

    checkAuth();
  }, [router, redirectTo]);

  // Show loading state while checking auth
  if (isChecking || isAuthorized === null) {
    return null;
  }

  // Don't render children if not authorized
  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
};

export default AuthGuard;
