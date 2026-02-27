/**
 * Centralized API client with JWT token handling and automatic refresh.
 * All API calls should go through this client.
 */

import { tokenStorage } from './tokenStorage';
import { authState } from './authState';
import { organizationContext } from './organizationContext';

// Environment variables - must be prefixed with NEXT_PUBLIC_ for client-side access
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const AUTH_LOGIN_ENDPOINT = process.env.NEXT_PUBLIC_AUTH_LOGIN_ENDPOINT || 'auth/login';
const AUTH_REFRESH_ENDPOINT = process.env.NEXT_PUBLIC_AUTH_REFRESH_ENDPOINT || 'auth/refresh';
const API_KEYS = process.env.NEXT_PUBLIC_API_KEYS || '';
const API_KEY_HEADER = process.env.NEXT_PUBLIC_API_KEY_HEADER || 'X-API-KEY';

/**
 * Get the API key from environment variables
 * Returns the first key if multiple keys are comma-separated
 */
function getApiKey(): string | null {
    if (!API_KEYS) {
        return null;
    }
    // Get the first key from comma-separated list
    const keys = API_KEYS.split(',').map(key => key.trim()).filter(key => key.length > 0);
    return keys.length > 0 ? keys[0] : null;
}

/**
 * Get current timestamp in Unix epoch seconds as string
 * Format: Math.floor(Date.now() / 1000).toString()
 * Ensures timestamp is always in seconds (10 digits), never milliseconds (13 digits)
 */
function getTimestamp(): string {
    const now = Date.now();
    // Always divide by 1000 to convert milliseconds to seconds
    const seconds = Math.floor(now / 1000);
    const timestamp = seconds.toString();
    
    // Safety check: if somehow we get a value > 11 digits, convert it
    if (timestamp.length > 11) {
        return Math.floor(parseInt(timestamp) / 1000).toString();
    }
    
    return timestamp;
}

// Refresh lock mechanism
let refreshPromise: Promise<string> | null = null;
let isRefreshing = false;

/**
 * Build full URL from endpoint
 */
function buildUrl(endpoint: string): string {
    const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${baseUrl}/${cleanEndpoint}`;
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(): Promise<string> {
    const refreshToken = tokenStorage.getRefreshToken();
    
    if (!refreshToken) {
        throw new Error('No refresh token available');
    }

    // CRITICAL SAFEGUARD: Don't attempt refresh if we just logged in
    // Tokens should be fresh and valid immediately after login
    if (!authState.shouldAttemptRefresh()) {
        const error = new Error('Token refresh attempted too soon after login');
        (error as any).isAuthError = false; // Not a real auth error
        throw error;
    }

    const refreshUrl = buildUrl(AUTH_REFRESH_ENDPOINT);

    // Prepare headers with API key
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-TIMESTAMP': getTimestamp(),
    };
    
    // Add API key header if configured
    const apiKey = getApiKey();
    if (apiKey) {
        headers[API_KEY_HEADER] = apiKey;
    }

    const response = await fetch(refreshUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ refresh_token: refreshToken }),
    });


    if (!response.ok) {
        // CRITICAL: Only clear tokens if we're absolutely certain the refresh token is invalid
        // For 401, check the error message VERY carefully before clearing
        if (response.status === 401) {
            // Try to get error details to confirm it's really an invalid refresh token
            let errorDetail = '';
            try {
                // Read error response (response can only be read once, but we're in error path)
                const errorData = await response.json();
                errorDetail = errorData.detail || errorData.message || '';
            } catch (e) {
                // Couldn't parse error response - don't clear tokens
                errorDetail = '';
            }
            
            // IMPORTANT: This is the REFRESH endpoint - any 401 here means refresh token is invalid
            // Even if error message is generic like "Invalid or expired token", it refers to refresh token
            // because this endpoint ONLY handles refresh tokens
            const errorLower = errorDetail.toLowerCase();
            const hasRefresh = errorLower.includes('refresh');
            const hasInvalid = errorLower.includes('invalid');
            const hasExpired = errorLower.includes('expired');
            const hasToken = errorLower.includes('token');
            
            // Since this is the refresh endpoint, any 401 with token-related error means refresh token is invalid
            // Clear tokens if:
            // 1. Error explicitly mentions refresh token, OR
            // 2. Error mentions token being invalid/expired (must be refresh token since this is refresh endpoint)
            const isRefreshTokenInvalid = 
                (hasRefresh && (hasInvalid || hasExpired)) ||
                (hasToken && (hasInvalid || hasExpired)) || // Generic "token invalid" from refresh endpoint = refresh token
                errorLower.includes('invalid refresh token') ||
                errorLower.includes('refresh token invalid') ||
                errorLower.includes('refresh token expired');
            
            // If error mentions token being invalid/expired, or is empty (401 from refresh endpoint = invalid refresh token)
            if (isRefreshTokenInvalid || errorDetail.trim() === '') {
                // Mark that refresh token has failed - AuthGuard will handle redirect
                authState.setRefreshTokenFailed(true);
                // Clear tokens - refresh token is invalid
                tokenStorage.clearTokens();
                
                // Trigger redirect immediately if we're not already on login page
                if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/cover-login')) {
                    // Use a small delay to ensure state is updated
                    setTimeout(() => {
                        window.location.href = '/auth/cover-login';
                    }, 100);
                }
            } else {
                // 401 but error doesn't mention token - might be unexpected, but still clear since it's refresh endpoint
                authState.setRefreshTokenFailed(true);
                tokenStorage.clearTokens();
            }
            
            // Throw a more specific error that can be caught and handled gracefully
            const error = new Error('Token refresh failed');
            (error as any).isAuthError = true;
            throw error;
        } else {
            // For non-401 errors (network issues, server errors, etc.), don't clear tokens
            // Just throw an error - the tokens might still be valid
            const errorText = await response.text().catch(() => '');
            const error = new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
            (error as any).isAuthError = false; // Not an auth error, might be temporary
            throw error;
        }
    }

    const data = await response.json();
    
    // Reset refresh token failure flag on successful refresh
    authState.setRefreshTokenFailed(false);
    
    // Update tokens
    tokenStorage.setTokens(data.access_token, data.refresh_token);
    
    return data.access_token;
}

/**
 * Handle 401 errors by attempting token refresh
 */
async function handleUnauthorized(url: string, originalRequest: RequestInit): Promise<Response> {
    // If already refreshing, wait for it to complete
    if (isRefreshing && refreshPromise) {
        try {
            const newAccessToken = await refreshPromise;
            // Retry original request with new token (body is preserved in originalRequest)
            return await retryRequest(url, originalRequest, newAccessToken);
        } catch (error: any) {
            // Refresh failed - tokens are handled in refreshAccessToken
            // Don't clear tokens here - refreshAccessToken handles that
            // Return a 401 response so the caller knows auth failed
            return new Response(JSON.stringify({ detail: 'Unauthorized' }), {
                status: 401,
                statusText: 'Unauthorized',
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }

    // Start refresh process
    isRefreshing = true;
    refreshPromise = refreshAccessToken();

    try {
        const newAccessToken = await refreshPromise;
        // Retry original request with new token (body is preserved in originalRequest)
        return await retryRequest(url, originalRequest, newAccessToken);
    } catch (error: any) {
        // Refresh failed - tokens are handled in refreshAccessToken
        // Don't clear tokens here - refreshAccessToken handles that based on error message
        // Return a 401 response so the caller knows auth failed
        return new Response(JSON.stringify({ detail: 'Unauthorized' }), {
            status: 401,
            statusText: 'Unauthorized',
            headers: { 'Content-Type': 'application/json' },
        });
    } finally {
        isRefreshing = false;
        refreshPromise = null;
    }
}

/**
 * Retry a request with a new access token
 * Note: This will only retry once. If it fails again with 401, we don't retry to prevent infinite loops.
 */
async function retryRequest(url: string, originalRequest: RequestInit, accessToken: string): Promise<Response> {
    // Create completely fresh headers - don't preserve old timestamp
    const headers = new Headers();
    const isFormDataBody = typeof FormData !== 'undefined' && originalRequest.body instanceof FormData;
    
    // Copy existing headers but explicitly exclude X-TIMESTAMP
    if (originalRequest.headers) {
        const originalHeaders = new Headers(originalRequest.headers);
        originalHeaders.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            // Explicitly skip X-TIMESTAMP to ensure fresh timestamp
            if (lowerKey !== 'x-timestamp') {
                headers.set(key, value);
            }
        });
    }
    
    // Set required headers with fresh timestamp (always regenerate)
    if (!isFormDataBody) {
        headers.set('Content-Type', 'application/json');
    }
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('X-TIMESTAMP', getTimestamp());
    const selectedOrgId = organizationContext.getSelectedOrganizationId();
    if (selectedOrgId) {
        headers.set('X-Organization-Id', String(selectedOrgId));
    }
    
    // Ensure API key header is included
    const apiKey = getApiKey();
    if (apiKey) {
        headers.set(API_KEY_HEADER, apiKey);
    }
    
    // Ensure headers object is used (not originalRequest.headers)
    const { headers: _, ...restOptions } = originalRequest;
    const response = await fetch(url, {
        ...restOptions,
        headers,
    });
    
    // If retry also fails with 401, don't try to refresh again (prevent infinite loop)
    // Just return the response and let the caller handle it
    return response;
}

/**
 * Make an API request with automatic token handling
 */
export async function apiRequest(
    endpoint: string,
    options: RequestInit = {}
): Promise<Response> {
    const url = buildUrl(endpoint);
    const accessToken = tokenStorage.getAccessToken();
    const refreshToken = tokenStorage.getRefreshToken();

    const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;
    // Prepare headers - ensure X-TIMESTAMP is always fresh
    const headers = new Headers();
    
    // Copy existing headers but exclude X-TIMESTAMP to ensure it's always fresh
    if (options.headers) {
        const existingHeaders = new Headers(options.headers);
        existingHeaders.forEach((value, key) => {
            if (key.toLowerCase() !== 'x-timestamp') {
                headers.set(key, value);
            }
        });
    }
    
    // Set required headers with fresh timestamp
    if (!isFormDataBody) {
        headers.set('Content-Type', 'application/json');
    }
    headers.set('X-TIMESTAMP', getTimestamp());
    const selectedOrgId = organizationContext.getSelectedOrganizationId();
    if (selectedOrgId) {
        headers.set('X-Organization-Id', String(selectedOrgId));
    }
    
    // Add API key header if configured
    const apiKey = getApiKey();
    if (apiKey) {
        headers.set(API_KEY_HEADER, apiKey);
    }
    
    // Add authorization header if token exists
    if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const selectedOrganizationId = organizationContext.getSelectedOrganizationId();
    if (selectedOrganizationId) {
        headers.set('X-Organization-Id', String(selectedOrganizationId));
    }

    // Make request - ensure headers object is used (not options.headers)
    const { headers: _, ...restOptions } = options;
    const response = await fetch(url, {
        ...restOptions,
        headers,
    });

    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401) {
        // Only try to refresh if we have BOTH tokens AND haven't already failed
        // AND enough time has passed since login (to avoid refreshing immediately after login)
        // Don't attempt refresh if we don't have tokens - that means user needs to log in
        if (accessToken && refreshToken && !authState.hasRefreshTokenFailed() && authState.shouldAttemptRefresh()) {
            // Before attempting refresh, check if we just got a 401
            // This might be because access token is expired, which is normal
            // Try to refresh token
            // Preserve the original request body and method
            const { headers: _, ...restOptions } = options;
            // Create clean headers object without X-TIMESTAMP for retry
            const cleanHeaders: Record<string, string> = {};
            headers.forEach((value, key) => {
                if (key.toLowerCase() !== 'x-timestamp') {
                    cleanHeaders[key] = value;
                }
            });
            // Ensure body is preserved in restOptions
            return handleUnauthorized(url, {
                ...restOptions,
                headers: cleanHeaders,
            });
        } else {
            // No tokens or refresh already failed or too soon after login
            // IMPORTANT: Don't clear tokens here - just return 401
            // Only mark failure if we truly have no tokens (user not logged in)
            if (!accessToken || !refreshToken) {
                // User doesn't have tokens - they need to log in
                // Don't clear tokens here - they might not exist
                authState.setRefreshTokenFailed(true);
            }
            // Return 401 response - AuthGuard will handle redirect if needed
            // CRITICAL: Don't clear tokens here - let the refresh endpoint handle that
            // If refresh hasn't been attempted, tokens might still be valid
            return response;
        }
    }

    return response;
}

/**
 * GET request
 */
export async function apiGet<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await apiRequest(endpoint, {
        ...options,
        method: 'GET',
    });

    if (!response.ok) {
        // If it's a 401 and we have tokens, refresh might have been attempted
        // Check if refresh failed
        if (response.status === 401) {
            if (authState.hasRefreshTokenFailed()) {
                // Refresh failed - this is an auth error
                const error = new Error('Authentication failed');
                (error as any).isAuthError = true;
                throw error;
            }
        }
        
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * POST request
 */
export async function apiPost<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    const response = await apiRequest(endpoint, {
        ...options,
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
        // If it's a 401 and we have tokens, refresh might have been attempted
        // Check if refresh failed
        if (response.status === 401) {
            if (authState.hasRefreshTokenFailed()) {
                // Refresh failed - this is an auth error
                const error = new Error('Authentication failed');
                (error as any).isAuthError = true;
                throw error;
            }
        }
        
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * PUT request
 */
export async function apiPut<T = any>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    const response = await apiRequest(endpoint, {
        ...options,
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
        // If it's a 401 and we have tokens, refresh might have been attempted
        // Check if refresh failed
        if (response.status === 401) {
            if (authState.hasRefreshTokenFailed()) {
                // Refresh failed - this is an auth error
                const error = new Error('Authentication failed');
                (error as any).isAuthError = true;
                throw error;
            }
        }
        
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * DELETE request
 */
export async function apiDelete<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await apiRequest(endpoint, {
        ...options,
        method: 'DELETE',
    });

    if (!response.ok) {
        // If it's a 401 and we have tokens, refresh might have been attempted
        // Check if refresh failed
        if (response.status === 401) {
            if (authState.hasRefreshTokenFailed()) {
                // Refresh failed - this is an auth error
                const error = new Error('Authentication failed');
                (error as any).isAuthError = true;
                throw error;
            }
        }
        
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
    }

    // Handle 204 No Content - no response body to parse
    if (response.status === 204) {
        return undefined as T;
    }

    // Check if response has content before trying to parse JSON
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    // If content-length is 0 or not set, and status is success, assume no content
    if (contentLength === '0' || (!contentType && !contentLength)) {
        return undefined as T;
    }
    
    // Try to read response as text first to check if it's empty
    const text = await response.text();
    
    // If text is empty, return undefined
    if (!text || text.trim() === '') {
        return undefined as T;
    }
    
    // Try to parse as JSON if there's content
    try {
        return JSON.parse(text) as T;
    } catch (e) {
        // If parsing fails, return undefined (non-JSON response)
        return undefined as T;
    }
}

