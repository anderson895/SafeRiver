'use client';

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
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';

interface AdminAuthValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOutAdmin: () => Promise<void>;
  /** Fetch wrapper that attaches a fresh ID token. */
  authedFetch: (input: string, init?: RequestInit) => Promise<Response>;
}

const Ctx = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth(), (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(firebaseAuth(), email, password);
  }, []);

  const signOutAdmin = useCallback(async () => {
    await signOut(firebaseAuth());
  }, []);

  /**
   * Always requests a current token rather than caching one.
   *
   * Firebase ID tokens expire after an hour. During a flood an officer may
   * have had the console open far longer than that, and getIdToken() refreshes
   * transparently — a stale token would fail exactly when it matters.
   */
  const authedFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const current = firebaseAuth().currentUser;
      if (!current) throw new Error('Not signed in');
      const token = await current.getIdToken();
      return fetch(input, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          Authorization: `Bearer ${token}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
    },
    [],
  );

  const value = useMemo<AdminAuthValue>(
    () => ({ user, loading, signIn, signOutAdmin, authedFetch }),
    [user, loading, signIn, signOutAdmin, authedFetch],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminAuth(): AdminAuthValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>');
  return ctx;
}
