/**
 * Authentication service.
 * Handles login, logout, and token management.
 */

import { tokenStorage } from './tokenStorage';
import { apiPost } from './apiClient';
import { authState } from './authState';
import { organizationContext } from './organizationContext';

const AUTH_LOGIN_ENDPOINT = process.env.NEXT_PUBLIC_AUTH_LOGIN_ENDPOINT || 'auth/login';

export interface LoginCredentials {
    username: string;
    password: string;
}

export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

export class AuthService {
    /**
     * Login with username and password
     */
    static async login(credentials: LoginCredentials): Promise<TokenResponse> {
        try {
            // Make login request without authorization header
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
            
            // Validate environment variables
            if (!API_BASE_URL) {
                console.error('NEXT_PUBLIC_API_BASE_URL is not set in environment variables');
                throw new Error('API configuration error. Please check your environment variables.');
            }
            
            const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
            const endpoint = AUTH_LOGIN_ENDPOINT.startsWith('/') ? AUTH_LOGIN_ENDPOINT.slice(1) : AUTH_LOGIN_ENDPOINT;
            const url = `${baseUrl}/${endpoint}`;

            // Debug logging (remove in production)
            console.log('Login request:', { url, username: credentials.username, apiBaseUrl: API_BASE_URL });

            // Prepare headers with API key
            const API_KEYS = process.env.NEXT_PUBLIC_API_KEYS || '';
            const API_KEY_HEADER = process.env.NEXT_PUBLIC_API_KEY_HEADER || 'X-API-KEY';
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'X-TIMESTAMP': Math.floor(Date.now() / 1000).toString(),
            };
            
            // Add API key header if configured
            if (API_KEYS) {
                const keys = API_KEYS.split(',').map(key => key.trim()).filter(key => key.length > 0);
                if (keys.length > 0) {
                    headers[API_KEY_HEADER] = keys[0];
                }
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(credentials),
            });

            // Debug logging
            console.log('Login response status:', response.status);

            if (!response.ok) {
                // Try to get error details from response
                let errorDetail = 'Login failed';
                try {
                    const errorData = await response.json();
                    errorDetail = errorData.detail || errorData.message || errorDetail;
                    console.error('Login error response:', errorData);
                } catch (e) {
                    console.error('Failed to parse error response:', e);
                }

                // Surface backend message to the UI
                console.error('Authentication failed:', errorDetail);
                throw new Error(errorDetail);
            }

            const data: TokenResponse = await response.json();
            console.log('Login successful');

            // Store tokens
            tokenStorage.setTokens(data.access_token, data.refresh_token);
            organizationContext.clearSelectedOrganization();
            organizationContext.updateIsSuperAdminFromToken();
            
            // Reset auth state after successful login
            authState.reset();
            authState.setAuthStateReady(true);

            return data;
        } catch (error) {
            // Log the actual error for debugging
            console.error('Login error:', error);
            
            // Re-throw with user-friendly message
            if (error instanceof Error) {
                // Check if it's a network error
                if (error.message.includes('fetch') || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    console.error('Network error - check if backend is running and CORS is configured');
                    throw new Error('Unable to connect to server. Please check if the backend is running and CORS is configured.');
                }
                // Use server-provided message if available
                throw new Error(error.message || 'Login failed');
            }
            throw new Error('Login failed');
        }
    }

    /**
     * Logout - clear tokens and redirect to login page
     */
    static logout(): void {
        tokenStorage.clearTokens();
        organizationContext.clearSelectedOrganization();
        
        // Redirect to login page
        if (typeof window !== 'undefined') {
            window.location.href = '/auth/cover-login';
        }
    }

    /**
     * Check if user is authenticated
     */
    static isAuthenticated(): boolean {
        return tokenStorage.isAuthenticated();
    }

    /**
     * Get current access token
     */
    static getAccessToken(): string | null {
        return tokenStorage.getAccessToken();
    }

    /**
     * Get current refresh token
     */
    static getRefreshToken(): string | null {
        return tokenStorage.getRefreshToken();
    }
}

