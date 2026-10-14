import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  clearSession,
  loginRequest,
  readSession,
  setUnauthorizedHandler,
  writeSession,
} from '../lib/api';
import type { PublicProfile, Role, Session } from '../lib/types';

interface AuthContextValue {
  user: PublicProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<PublicProfile>;
  logout: () => void;
  updateProfile: (updates: { name: string }) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const ADMIN_ROLES: Role[] = ['SUPER_ADMIN', 'DEPT_ADMIN', 'FACULTY'];
export const MANAGER_ROLES: Role[] = ['SUPER_ADMIN', 'DEPT_ADMIN'];

export function roleLabel(role: Role): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'DEPT_ADMIN':
      return 'Department Admin';
    case 'FACULTY':
      return 'Faculty';
    default:
      return 'Student';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readSession());

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const updateProfile = useCallback((updates: { name: string }) => {
    setSession((previous) => {
      if (!previous) return previous;
      const next: Session = { ...previous, user: { ...previous.user, ...updates } };
      writeSession(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      setSession(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<PublicProfile> => {
    const response = await loginRequest(email, password);
    const next: Session = {
      token: response.token,
      claims: response.claims,
      user: response.user,
    };
    writeSession(next);
    setSession(next);
    return response.user;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session),
      login,
      logout,
      updateProfile,
    }),
    [session, login, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
