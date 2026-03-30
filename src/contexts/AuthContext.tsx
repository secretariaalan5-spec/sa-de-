import { createContext, useContext, ReactNode } from 'react';
import { useAuth, UserRoleInfo } from '@/hooks/useAuth';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  roleInfo: UserRoleInfo | null;
  loading: boolean;
  signOut: () => Promise<void>;
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
