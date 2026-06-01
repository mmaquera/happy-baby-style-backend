import {
  UserAccount,
  UserSession,
  UserPassword,
  AuthProvider,
  GoogleUserInfo,
  EmailLoginRequest,
  EmailRegisterRequest,
  AuthResult,
  SessionInfo,
  UserSessionAnalytics,
  CreateUserSessionAnalyticsRequest,
  UpdateUserSessionAnalyticsRequest,
} from '@domain/entities/Auth';
import { UserProfile } from '@domain/entities/User';
import { EffectiveAuthz } from '@domain/interfaces/IEffectiveAuthz';

export interface IAuthRepository {
  // OAuth Account Management
  createUserAccount(
    account: Omit<UserAccount, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UserAccount>;
  findUserAccountByProvider(
    provider: AuthProvider,
    providerAccountId: string,
  ): Promise<UserAccount | null>;
  findUserAccountsByUserId(userId: string): Promise<UserAccount[]>;
  updateUserAccount(id: string, data: Partial<UserAccount>): Promise<UserAccount>;
  deleteUserAccount(id: string): Promise<void>;

  // Session Management
  createSession(session: Omit<UserSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserSession>;
  findSessionByToken(token: string): Promise<UserSession | null>;
  findSessionsByUserId(userId: string): Promise<UserSession[]>;
  updateSession(id: string, data: Partial<UserSession>): Promise<UserSession>;
  deleteSession(id: string): Promise<void>;
  deleteExpiredSessions(): Promise<number>;
  invalidateUserSessions(userId: string): Promise<void>;

  // Password Management
  createUserPassword(
    password: Omit<UserPassword, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UserPassword>;
  findUserPasswordByUserId(userId: string): Promise<UserPassword | null>;
  updateUserPassword(userId: string, data: Partial<UserPassword>): Promise<UserPassword>;
  deleteUserPassword(userId: string): Promise<void>;

  // Additional methods for UpdateUserPasswordUseCase
  verifyPassword(userId: string, password: string): Promise<boolean>;
  updatePassword(userId: string, newPassword: string): Promise<void>;
  getUserById(userId: string): Promise<{ id: string; email: string; isActive: boolean } | null>;
  getUserByEmail(email: string): Promise<{ id: string; email: string; isActive: boolean } | null>;

  // Authentication Methods
  authenticateWithEmail(credentials: EmailLoginRequest): Promise<AuthResult>;
  authenticateWithGoogle(googleUser: GoogleUserInfo): Promise<AuthResult>;
  registerWithEmail(data: EmailRegisterRequest): Promise<AuthResult>;

  // User Utilities
  findOrCreateUserFromGoogle(googleUser: GoogleUserInfo): Promise<UserProfile>;
  updateUserLastLogin(userId: string): Promise<void>;

  // Session Validation
  validateSession(sessionToken: string): Promise<SessionInfo | null>;
  refreshUserSession(refreshToken: string, effective?: EffectiveAuthz): Promise<AuthResult>;

  // Logout Management
  logoutUser(userId: string, sessionId?: string): Promise<void>;

  // Session Analytics Management
  createSessionAnalytics(data: CreateUserSessionAnalyticsRequest): Promise<UserSessionAnalytics>;
  findSessionAnalyticsById(id: string): Promise<UserSessionAnalytics | null>;
  findSessionAnalyticsBySessionId(sessionId: string): Promise<UserSessionAnalytics | null>;
  findSessionAnalyticsByUserId(userId: string): Promise<UserSessionAnalytics[]>;
  updateSessionAnalytics(
    id: string,
    data: UpdateUserSessionAnalyticsRequest,
  ): Promise<UserSessionAnalytics>;
  deleteSessionAnalytics(id: string): Promise<void>;
  deleteSessionAnalyticsBySessionId(sessionId: string): Promise<void>;
  deleteSessionAnalyticsByUserId(userId: string): Promise<void>;
}
