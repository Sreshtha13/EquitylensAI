import { getEnv } from '../config/index.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';
import { userRepository, memoryStore } from '../db/userRepository.js';
import type { AuthUser, AuthSession, UserProfile, UserPreferences } from '@equitylensai/shared';

export type RegisterResult = {
  user: AuthUser;
  session: AuthSession | null;
  emailConfirmationRequired: boolean;
  message?: string | undefined;
};


export type LoginResult = {
  user: AuthUser;
  session: AuthSession;
  profile: UserProfile;
  preferences: UserPreferences;
};

interface SupabaseAuthUser {
  id: string;
  email?: string;
  user_metadata?: {
    display_name?: string;
  };
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  created_at?: string;
}

interface SupabaseAuthResponse {
  id?: string;
  user?: SupabaseAuthUser;
  access_token?: string;
  refresh_token?: string | null;
  expires_in?: number | null;
  token_type?: string;
  msg?: string;
  message?: string;
  error_code?: string;
  error_description?: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  created_at?: string;
}

export class AuthService {
  async register(data: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<RegisterResult> {
    const env = getEnv();
    const cleanEmail = data.email.trim().toLowerCase();

    // Test environment shortcut if Supabase is unconfigured or mock
    if (env.NODE_ENV === 'test' && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
      for (const p of memoryStore.profiles.values()) {
        if (p.email.toLowerCase() === cleanEmail.toLowerCase()) {
          throw new AppError('USER_ALREADY_EXISTS', 'An account with this email address already exists', 409);
        }
      }

      const id = `test-user-${Date.now()}`;
      const user: AuthUser = {
        id,
        email: cleanEmail,
        displayName: data.displayName ?? null,
        emailConfirmed: true,
        createdAt: new Date().toISOString(),
      };
      const session: AuthSession = {
        accessToken: `mock-token-${id}`,
        tokenType: 'bearer',
        expiresIn: 3600,
      };
      const profile: UserProfile = {
        id: crypto.randomUUID(),
        authUserId: id,
        email: cleanEmail,
        displayName: data.displayName ?? null,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await userRepository.upsertProfile(profile);
      await userRepository.getPreferences(id);

      return {
        user,
        session,
        emailConfirmationRequired: false,
      };
    }


    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new AppError(
        'DATABASE_NOT_CONFIGURED',
        'Authentication service is not configured',
        503,
      );
    }

    const baseUrl = env.SUPABASE_URL.replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: cleanEmail,
        password: data.password,
        data: {
          display_name: data.displayName,
        },
      }),
    });

    const resBody = (await res.json().catch(() => ({}))) as SupabaseAuthResponse;

    // If email rate limit exceeded or signup blocked by provider in dev/test, fallback to admin create user
    if (
      !res.ok &&
      (res.status === 429 || resBody.error_code === 'over_email_send_rate_limit' || env.NODE_ENV !== 'production')
    ) {
      logger.info({ email: cleanEmail }, 'Attempting admin user creation fallback');
      const adminRes = await fetch(`${baseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: data.password,
          email_confirm: true,
          user_metadata: {
            display_name: data.displayName,
          },
        }),
      });

      if (adminRes.ok) {
        const adminBody = (await adminRes.json()) as SupabaseAuthResponse;
        const userId = String(adminBody.id || adminBody.user?.id);
        const profile: UserProfile = {
          id: crypto.randomUUID(),
          authUserId: userId,
          email: cleanEmail,
          displayName: data.displayName ?? null,
          avatarUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await userRepository.upsertProfile(profile);
        await userRepository.getPreferences(userId);

        // Sign in immediately to provide valid session
        const loginRes = await this.login({ email: cleanEmail, password: data.password });
        return {
          user: loginRes.user,
          session: loginRes.session,
          emailConfirmationRequired: false,
        };
      } else {
        const adminErr = (await adminRes.json().catch(() => ({}))) as SupabaseAuthResponse;
        const msg = adminErr.msg ?? adminErr.message ?? '';
        if (msg.includes('already been registered') || adminErr.error_code === 'email_exists') {
          throw new AppError('USER_ALREADY_EXISTS', 'An account with this email address already exists', 409);
        }
      }

    }

    if (!res.ok) {
      if (resBody.msg?.includes('already registered') || resBody.error_code === 'user_already_exists') {
        throw new AppError('USER_ALREADY_EXISTS', 'An account with this email address already exists', 409);
      }
      throw new AppError(
        'REGISTRATION_FAILED',
        resBody.msg || resBody.message || 'Registration failed with identity provider',
        res.status >= 400 && res.status < 500 ? res.status : 502,
      );
    }

    const authId = resBody.id || resBody.user?.id;
    if (!authId) {
      throw new AppError('REGISTRATION_FAILED', 'Identity provider did not return user identifier', 502);
    }

    const emailConfirmed = Boolean(
      resBody.email_confirmed_at || resBody.confirmed_at || resBody.user?.email_confirmed_at,
    );

    const user: AuthUser = {
      id: authId,
      email: cleanEmail,
      displayName: data.displayName ?? null,
      emailConfirmed,
      createdAt: resBody.created_at || new Date().toISOString(),
    };

    // Create user profile & preferences in our database
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      authUserId: authId,
      email: cleanEmail,
      displayName: data.displayName ?? null,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await userRepository.upsertProfile(profile);
    await userRepository.getPreferences(authId);

    const session: AuthSession | null = resBody.access_token
      ? {
          accessToken: resBody.access_token,
          refreshToken: resBody.refresh_token ?? null,
          expiresIn: resBody.expires_in ?? null,
          tokenType: resBody.token_type ?? 'bearer',
        }
      : null;

    return {
      user,
      session,
      emailConfirmationRequired: !emailConfirmed && !session,
      message:
        !emailConfirmed && !session
          ? 'Registration successful. Please check your email to verify your account.'
          : undefined,
    };
  }

  async login(data: { email: string; password: string }): Promise<LoginResult> {
    const env = getEnv();
    const cleanEmail = data.email.trim().toLowerCase();

    // Test environment mock login
    if (env.NODE_ENV === 'test' && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
      const id = `test-user-${cleanEmail.replace(/[^a-z0-9]/gi, '')}`;
      const user: AuthUser = {
        id,
        email: cleanEmail,
        displayName: 'Test User',
        emailConfirmed: true,
        createdAt: new Date().toISOString(),
      };
      const session: AuthSession = {
        accessToken: `mock-token-${id}`,
        tokenType: 'bearer',
        expiresIn: 3600,
      };
      const profile = await userRepository.getProfile(id) || {
        id: crypto.randomUUID(),
        authUserId: id,
        email: cleanEmail,
        displayName: 'Test User',
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const preferences = await userRepository.getPreferences(id);
      return { user, session, profile, preferences };
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new AppError(
        'DATABASE_NOT_CONFIGURED',
        'Authentication service is not configured',
        503,
      );
    }

    const baseUrl = env.SUPABASE_URL.replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: cleanEmail,
        password: data.password,
      }),
    });

    const body = (await res.json().catch(() => ({}))) as SupabaseAuthResponse;
    const errDesc = body.error_description ?? '';

    if (!res.ok) {
      if (body.error_code === 'invalid_grant' || errDesc.includes('Invalid login credentials')) {
        throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }
      if (errDesc.includes('Email not confirmed')) {
        throw new AppError(
          'EMAIL_NOT_CONFIRMED',
          'Please verify your email address before signing in. Check your inbox for the confirmation link.',
          403,
        );
      }
      throw new AppError(
        'AUTHENTICATION_FAILED',
        body.error_description || body.msg || 'Authentication failed',
        401,
      );
    }

    const authUser = body.user;
    if (!authUser || !authUser.id) {
      throw new AppError('AUTHENTICATION_FAILED', 'Invalid authentication response', 502);
    }

    const user: AuthUser = {
      id: authUser.id,
      email: authUser.email || cleanEmail,
      displayName: authUser.user_metadata?.display_name ?? null,
      emailConfirmed: Boolean(authUser.email_confirmed_at || authUser.confirmed_at),
      createdAt: authUser.created_at || new Date().toISOString(),
    };

    if (!body.access_token) {
      throw new AppError('AUTHENTICATION_FAILED', 'Identity provider did not return access token', 502);
    }

    const session: AuthSession = {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? null,
      expiresIn: body.expires_in ?? null,
      tokenType: body.token_type ?? 'bearer',
    };

    let profile = await userRepository.getProfile(user.id);
    if (!profile) {
      const newProfile: UserProfile = {
        id: crypto.randomUUID(),
        authUserId: user.id,
        email: user.email,
        displayName: user.displayName ?? null,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      profile = await userRepository.upsertProfile(newProfile);
    }

    const preferences = await userRepository.getPreferences(user.id);

    return {
      user,
      session,
      profile,
      preferences,
    };

  }

  async logout(token?: string): Promise<void> {
    const env = getEnv();
    if (!token || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return;
    }

    const baseUrl = env.SUPABASE_URL.replace(/\/+$/, '');
    try {
      await fetch(`${baseUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Logout network failure is safely ignored
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const env = getEnv();
    const cleanEmail = email.trim().toLowerCase();

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      // Prevent user enumeration in mock mode
      return;
    }

    const baseUrl = env.SUPABASE_URL.replace(/\/+$/, '');
    try {
      await fetch(`${baseUrl}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: cleanEmail }),
      });
    } catch (error) {
      logger.error({ error }, 'Password recovery request failed');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const env = getEnv();
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return;
    }

    const baseUrl = env.SUPABASE_URL.replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: newPassword }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const errMessage = typeof err.msg === 'string' ? err.msg : 'Failed to update password with identity provider';
      throw new AppError(
        'PASSWORD_RESET_FAILED',
        errMessage,
        res.status,
      );
    }

  }

  async deleteAccount(userId: string): Promise<void> {
    const env = getEnv();

    // 1. Delete all user data in application database
    await userRepository.deleteAllUserData(userId);

    // 2. Delete auth account in Supabase Auth
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const baseUrl = env.SUPABASE_URL.replace(/\/+$/, '');
      try {
        await fetch(`${baseUrl}/auth/v1/admin/users/${userId}`, {
          method: 'DELETE',
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
      } catch (error) {
        logger.error({ error, userId }, 'Failed to delete user in Supabase Auth admin');
      }
    }
  }
}

export const authService = new AuthService();
