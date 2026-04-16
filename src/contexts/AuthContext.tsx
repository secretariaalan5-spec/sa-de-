import { createContext, useContext, ReactNode } from 'react';
import { useAuth, UserRoleInfo, PendingStatus } from '@/hooks/useAuth';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  roleInfo: UserRoleInfo | null;
  pendingStatus: PendingStatus;
  loading: boolean;
  signOut: () => Promise<void>;
  /** Re-fetches the current user's role from the DB. Use after RPCs that assign roles. */
  refreshRole: () => Promise<void>;
  isAdmin: boolean;
  isRH: boolean;
  isChief: boolean;
  isManager: boolean;
  isProfessional: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
