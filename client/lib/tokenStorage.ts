/**
 * Secure token storage utility.
 * Stores access and refresh tokens in localStorage.
 */

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const tokenStorage = {
    /**
     * Store access token
     */
    setAccessToken(token: string): void {
        if (typeof window !== 'undefined') {
            localStorage.setItem(ACCESS_TOKEN_KEY, token);
        }
    },

    /**
     * Get access token
     */
    getAccessToken(): string | null {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(ACCESS_TOKEN_KEY);
        }
        return null;
    },

    /**
     * Store refresh token
     */
    setRefreshToken(token: string): void {
        if (typeof window !== 'undefined') {
            localStorage.setItem(REFRESH_TOKEN_KEY, token);
        }
    },

    /**
     * Get refresh token
     */
    getRefreshToken(): string | null {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(REFRESH_TOKEN_KEY);
        }
        return null;
    },

    /**
     * Store both tokens
     */
    setTokens(accessToken: string, refreshToken: string): void {
        this.setAccessToken(accessToken);
        this.setRefreshToken(refreshToken);
    },

    /**
     * Clear all tokens
     */
    clearTokens(): void {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(ACCESS_TOKEN_KEY);
            localStorage.removeItem(REFRESH_TOKEN_KEY);
        }
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return !!this.getAccessToken() && !!this.getRefreshToken();
    },
};

