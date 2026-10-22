'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  loginUser,
  registerUser,
  logoutUser,
  getSession,
  getProfile,
  getPreferences,
  updateProfile as updateProfileApi,
  updatePreferences as updatePreferencesApi,
  deleteAccount as deleteAccountApi,
  type RegisterResponse,
} from '@/services/api/auth';
import { getAuthToken, setAuthToken } from '@/services/api/client';
import type { AuthUser, UserProfile, UserPreferences } from '@equitylensai/shared';

type AuthContextType = {
  user: AuthUser | null;
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  updateProfile: (data: {
    displayName?: string | null;
    avatarUrl?: string | null;
  }) => Promise<void>;
  updatePreferences: (
    data: Partial<Omit<UserPreferences, 'userId' | 'updatedAt'>>,
  ) => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const queryClient = useQueryClient();
  const router = useRouter();

  const restoreSession = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setProfile(null);
      setPreferences(null);
      setIsLoading(false);
      return;
    }

    try {
      const sessionRes = await getSession();
      setUser(sessionRes.user);

      try {
        const [prof, prefs] = await Promise.all([getProfile(), getPreferences()]);
        setProfile(prof);
        setPreferences(prefs);
      } catch {
        // Non-fatal if profile or preferences fail
      }
    } catch {
      // Token expired or invalid
      setAuthToken(null);
      setUser(null);
      setProfile(null);
      setPreferences(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await loginUser({ email, password });
      setUser(res.user);
      setProfile(res.profile);
      setPreferences(res.preferences);
      queryClient.invalidateQueries();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    displayName?: string,
  ): Promise<RegisterResponse> => {
    setIsLoading(true);
    try {
      const res = await registerUser({ email, password, displayName });
      if (res.session) {
        setUser(res.user);
        try {
          const [prof, prefs] = await Promise.all([getProfile(), getPreferences()]);
          setProfile(prof);
          setPreferences(prefs);
        } catch {
          // ignore
        }
      }
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch {
      // Ignore network errors on logout
    } finally {
      setAuthToken(null);
      setUser(null);
      setProfile(null);
      setPreferences(null);
      queryClient.clear();
      router.push('/login');
    }
  };

  const updateProfile = async (data: {
    displayName?: string | null;
    avatarUrl?: string | null;
  }) => {
    const updated = await updateProfileApi(data);
    setProfile(updated);
  };

  const updatePreferences = async (
    data: Partial<Omit<UserPreferences, 'userId' | 'updatedAt'>>,
  ) => {
    const updated = await updatePreferencesApi(data);
    setPreferences(updated);
  };

  const deleteAccount = async () => {
    await deleteAccountApi('DELETE_ACCOUNT');
    setAuthToken(null);
    setUser(null);
    setProfile(null);
    setPreferences(null);
    queryClient.clear();
    router.push('/login');
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const [prof, prefs] = await Promise.all([getProfile(), getPreferences()]);
      setProfile(prof);
      setPreferences(prefs);
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        preferences,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        register,
        logout,
        updateProfile,
        updatePreferences,
        deleteAccount,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
