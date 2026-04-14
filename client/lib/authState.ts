/**
 * Authentication state management.
 * Tracks authentication status and refresh token failure to coordinate
 * between AuthGuard and API client.
 */

// Global state to track if refresh token has failed
let refreshTokenFailed = false;
let authStateReady = false;
let lastLoginTime: number | null = null;
const REFRESH_COOLDOWN_MS = 30000; // Don't attempt refresh within 30 seconds of login (tokens should be fresh)
const authReadyListeners = new Set<() => void>();

export const authState = {
  /**
   * Mark that refresh token has failed
   */
  setRefreshTokenFailed(failed: boolean): void {
    refreshTokenFailed = failed;
  },

  /**
   * Check if refresh token has failed
   */
  hasRefreshTokenFailed(): boolean {
    return refreshTokenFailed;
  },

  /**
   * Mark auth state as ready (tokens loaded and checked)
   */
  setAuthStateReady(ready: boolean): void {
    const wasReady = authStateReady;
    authStateReady = ready;
    if (ready && !wasReady) {
      authReadyListeners.forEach((listener) => {
        try {
          listener();
        } catch (_error) {
          // Ignore subscriber failures to keep auth state flow resilient.
        }
      });
    }
  },

  /**
   * Check if auth state is ready
   */
  isAuthStateReady(): boolean {
    return authStateReady;
  },

  /**
   * Mark that user just logged in (to prevent immediate refresh attempts)
   */
  setLastLoginTime(): void {
    lastLoginTime = Date.now();
  },

  /**
   * Check if we should attempt refresh (avoid refreshing too soon after login)
   */
  shouldAttemptRefresh(): boolean {
    if (lastLoginTime === null) {
      return true; // No login time recorded, allow refresh
    }
    const timeSinceLogin = Date.now() - lastLoginTime;
    return timeSinceLogin > REFRESH_COOLDOWN_MS;
  },

  /**
   * Reset auth state (e.g., after login)
   */
  reset(): void {
    refreshTokenFailed = false;
    authStateReady = false;
    lastLoginTime = Date.now(); // Record login time
  },

  /**
   * Subscribe to auth-ready transition events.
   * Callback is fired immediately if auth state is already ready.
   */
  onAuthStateReady(callback: () => void): () => void {
    authReadyListeners.add(callback);
    if (authStateReady) {
      try {
        callback();
      } catch (_error) {
        // Ignore subscriber failures to keep auth state flow resilient.
      }
    }
    return () => {
      authReadyListeners.delete(callback);
    };
  },
};
