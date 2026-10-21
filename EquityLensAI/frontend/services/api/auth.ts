import { apiClient, setAuthToken } from './client';
import type {
  AuthUser,
  AuthSession,
  UserProfile,
  UserPreferences,
} from '@equitylensai/shared';

export type RegisterResponse = {
  user: AuthUser;
  session: AuthSession | null;
  emailConfirmationRequired: boolean;
  message?: string | undefined;
};

export type LoginResponse = {
  user: AuthUser;
  session: AuthSession;
  profile: UserProfile;
  preferences: UserPreferences;
};

export async function registerUser(body: {
  email: string;
  password: string;
  displayName?: string | undefined;
}): Promise<RegisterResponse> {
  const data = await apiClient.post<RegisterResponse>('/api/v1/auth/register', body);
  if (data.session?.accessToken) {
    setAuthToken(data.session.accessToken);
  }
  return data;
}

export async function loginUser(body: {
  email: string;
  password: string;
}): Promise<LoginResponse> {
  const data = await apiClient.post<LoginResponse>('/api/v1/auth/login', body);
  if (data.session?.accessToken) {
    setAuthToken(data.session.accessToken);
  }
  return data;
}

export async function logoutUser(): Promise<void> {
  try {
    await apiClient.post('/api/v1/auth/logout');
  } finally {
    setAuthToken(null);
  }
}

export async function getSession(): Promise<{ user: AuthUser }> {
  return apiClient.get<{ user: AuthUser }>('/api/v1/auth/session');
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/api/v1/auth/forgot-password', { email });
}

export async function resetPassword(password: string): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/api/v1/auth/reset-password', { password });
}

export async function getProfile(): Promise<UserProfile> {
  return apiClient.get<UserProfile>('/api/v1/users/me');
}

export async function updateProfile(body: {
  displayName?: string | null;
  avatarUrl?: string | null;
}): Promise<UserProfile> {
  return apiClient.patch<UserProfile>('/api/v1/users/me', body);
}

export async function getPreferences(): Promise<UserPreferences> {
  return apiClient.get<UserPreferences>('/api/v1/users/me/preferences');
}

export async function updatePreferences(
  body: Partial<Omit<UserPreferences, 'userId' | 'updatedAt'>>,
): Promise<UserPreferences> {
  return apiClient.patch<UserPreferences>('/api/v1/users/me/preferences', body);
}

export async function deleteAccount(_confirm?: string): Promise<{ message: string }> {
  const res = await apiClient.delete<{ message: string }>('/api/v1/users/me', {
    headers: { 'Content-Type': 'application/json' },
  });
  setAuthToken(null);
  return res;
}
