/**
 * Auth state — zustand store with localStorage persistence (token only).
 * User refetched via /auth/me on app load.
 */

import { create } from 'zustand';
import { api, ApiError, type AuthUser } from './api';

const TOKEN_KEY = 'shopio.admin.token';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Adopt a re-issued token (tenant switch) and refresh the user snapshot. */
  applySession: (token: string) => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  init: async () => {
    const cached = localStorage.getItem(TOKEN_KEY);
    if (cached) {
      api.setToken(cached);
      try {
        const { user } = await api.me();
        set({ user, loading: false, error: null });
        return;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          api.setToken(null);
        }
      }
    }
    set({ user: null, loading: false });
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const result = await api.login(email, password);
      api.setToken(result.access_token);
      localStorage.setItem(TOKEN_KEY, result.access_token);
      set({ user: result.user, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : 'Login failed',
      });
      throw e;
    }
  },

  logout: async () => {
    await api.logout().catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    set({ user: null });
  },

  applySession: async (token) => {
    api.setToken(token);
    localStorage.setItem(TOKEN_KEY, token);
    const { user } = await api.me();
    set({ user });
  },
}));
