export interface SavedComputerAccount {
  userId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken: string;
  updatedAt: number;
}

export const SAVED_ACCOUNTS_STORAGE_KEY = 'saude_computer_accounts_v1';

export function getSavedComputerAccounts(): SavedComputerAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const win = window as unknown as Record<string, unknown>;
    const fromBridge = Array.isArray(win.__SAUDE_SAVED_ACCOUNTS__)
      ? (win.__SAUDE_SAVED_ACCOUNTS__ as SavedComputerAccount[])
      : [];

    const rawLocal = localStorage.getItem(SAVED_ACCOUNTS_STORAGE_KEY);
    const fromLocal: SavedComputerAccount[] = rawLocal ? JSON.parse(rawLocal) : [];

    const map = new Map<string, SavedComputerAccount>();
    for (const acc of [...fromLocal, ...fromBridge]) {
      if (acc && acc.email && acc.refreshToken) {
        const existing = map.get(acc.email);
        if (!existing || (acc.updatedAt || 0) >= (existing.updatedAt || 0)) {
          map.set(acc.email, acc);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch {
    return [];
  }
}

export function saveCurrentSessionToComputerAccounts(): SavedComputerAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    let currentSession: {
      access_token?: string;
      refresh_token?: string;
      user?: {
        id?: string;
        email?: string;
        user_metadata?: { full_name?: string; name?: string; avatar_url?: string; picture?: string };
      };
    } | null = null;

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        currentSession = JSON.parse(localStorage.getItem(k) || 'null');
        break;
      }
    }

    const existing = getSavedComputerAccounts();
    if (
      currentSession &&
      currentSession.user?.id &&
      currentSession.user?.email &&
      currentSession.access_token &&
      currentSession.refresh_token
    ) {
      const meta = currentSession.user.user_metadata || {};
      const entry: SavedComputerAccount = {
        userId: currentSession.user.id,
        email: currentSession.user.email,
        name: meta.full_name || meta.name || currentSession.user.email.split('@')[0],
        avatarUrl: meta.avatar_url || meta.picture,
        accessToken: currentSession.access_token,
        refreshToken: currentSession.refresh_token,
        updatedAt: Date.now(),
      };

      const filtered = existing.filter((a) => a.email !== entry.email);
      const updated = [entry, ...filtered].slice(0, 8);
      localStorage.setItem(SAVED_ACCOUNTS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    }
    return existing;
  } catch {
    return [];
  }
}

export function removeSavedComputerAccount(email: string): SavedComputerAccount[] {
  try {
    const filtered = getSavedComputerAccounts().filter((a) => a.email !== email);
    localStorage.setItem(SAVED_ACCOUNTS_STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch {
    return [];
  }
}
