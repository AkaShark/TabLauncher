import { defineStore } from 'pinia';
import { getTokens, isExpired, type TokenSet } from '@/core/tokenStore';

interface AuthState {
  tokens: TokenSet | null;
  loaded: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({ tokens: null, loaded: false }),
  getters: {
    connected: (s): boolean => !!s.tokens && !isExpired(s.tokens),
    expired: (s): boolean => !!s.tokens && isExpired(s.tokens),
    expiresAtIso: (s): string => (s.tokens ? new Date(s.tokens.expiresAt).toISOString() : ''),
  },
  actions: {
    async hydrate(): Promise<void> {
      this.tokens = await getTokens();
      this.loaded = true;
    },
    setTokens(t: TokenSet | null): void {
      this.tokens = t;
    },
  },
});
