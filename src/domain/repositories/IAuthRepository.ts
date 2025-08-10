import { 
  UserAccount, 
  UserSession, 
  UserPassword, 
  AuthProvider,
  GoogleUserInfo,
  EmailLoginRequest,
  EmailRegisterRequest,
  AuthResult,
  SessionInfo
} from '@domain/entities/Auth';
import { UserProfile } from '@domain/entities/User';

export interface IAuthRepository {
  // OAuth Account Management
  createUserAccount(account: Omit<UserAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserAccount>;
  findUserAccountByProvider(provider: AuthProvider, providerAccountId: string): Promise<UserAccount | null>;
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
  createUserPassword(password: Omit<UserPassword, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserPassword>;
  findUserPasswordByUserId(userId: string): Promise<UserPassword | null>;
  updateUserPassword(userId: string, data: Partial<UserPassword>): Promise<UserPassword>;
  deleteUserPassword(userId: string): Promise<void>;

  // Authentication Methods
  authenticateWithEmail(credentials: EmailLoginRequest): Promise<AuthResult>;
  authenticateWithGoogle(googleUser: GoogleUserInfo): Promise<AuthResult>;
  registerWithEmail(data: EmailRegisterRequest): Promise<AuthResult>;

  // User Utilities
  findOrCreateUserFromGoogle(googleUser: GoogleUserInfo): Promise<UserProfile>;
  updateUserLastLogin(userId: string): Promise<void>;
  
  // Session Validation
  validateSession(sessionToken: string): Promise<SessionInfo | null>;
  refreshUserSession(refreshToken: string): Promise<AuthResult>;
}