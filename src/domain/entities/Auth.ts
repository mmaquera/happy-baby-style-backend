import { UserProfile } from './User';

export enum AuthProvider {
  EMAIL = 'email',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  APPLE = 'apple'
}

// OAuth Account Information
export interface UserAccount {
  id: string;
  userId: string;
  provider: AuthProvider;
  providerAccountId: string;
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  idToken?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// User Session Management
export interface UserSession {
  id: string;
  userId: string;
  sessionToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Password Management (separate for security)
export interface UserPassword {
  id: string;
  userId: string;
  passwordHash: string;
  salt?: string;
  resetToken?: string;
  resetExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// OAuth Authentication Requests
export interface GoogleAuthRequest {
  code: string;
  state?: string;
  redirectUri: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

// Authentication Responses
export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthResult {
  user: UserProfile;
  tokens: AuthTokens;
  isNewUser: boolean;
  provider: AuthProvider;
}

// Login/Register Requests
export interface EmailLoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface EmailRegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

// Session Information
export interface SessionInfo {
  userId: string;
  email: string;
  role: string;
  provider: AuthProvider;
  isActive: boolean;
  expiresAt: Date;
  lastLoginAt?: Date;
}

// JWT Payload
export interface JWTPayload {
  sub: string; // userId
  email: string;
  role: string;
  provider: AuthProvider;
  sessionId: string;
  iat: number;
  exp: number;
}

// Entity Classes
export class UserAccountEntity implements UserAccount {
  constructor(
    public id: string,
    public userId: string,
    public provider: AuthProvider,
    public providerAccountId: string,
    public accessToken: string | undefined,
    public refreshToken: string | undefined,
    public tokenType: string | undefined,
    public scope: string | undefined,
    public idToken: string | undefined,
    public expiresAt: Date | undefined,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  static create(data: Omit<UserAccount, 'id' | 'createdAt' | 'updatedAt'>): UserAccountEntity {
    return new UserAccountEntity(
      crypto.randomUUID(),
      data.userId,
      data.provider,
      data.providerAccountId,
      data.accessToken,
      data.refreshToken,
      data.tokenType,
      data.scope,
      data.idToken,
      data.expiresAt,
      new Date(),
      new Date()
    );
  }

  isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }
}

export class UserSessionEntity implements UserSession {
  constructor(
    public id: string,
    public userId: string,
    public sessionToken: string,
    public accessToken: string,
    public refreshToken: string | undefined,
    public expiresAt: Date,
    public userAgent: string | undefined,
    public ipAddress: string | undefined,
    public isActive: boolean,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  static create(data: Omit<UserSession, 'id' | 'createdAt' | 'updatedAt'>): UserSessionEntity {
    return new UserSessionEntity(
      crypto.randomUUID(),
      data.userId,
      data.sessionToken,
      data.accessToken,
      data.refreshToken,
      data.expiresAt,
      data.userAgent,
      data.ipAddress,
      data.isActive,
      new Date(),
      new Date()
    );
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isValid(): boolean {
    return this.isActive && !this.isExpired();
  }
}

export class UserPasswordEntity implements UserPassword {
  constructor(
    public id: string,
    public userId: string,
    public passwordHash: string,
    public salt: string | undefined,
    public resetToken: string | undefined,
    public resetExpiresAt: Date | undefined,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  static create(data: Omit<UserPassword, 'id' | 'createdAt' | 'updatedAt'>): UserPasswordEntity {
    return new UserPasswordEntity(
      crypto.randomUUID(),
      data.userId,
      data.passwordHash,
      data.salt,
      data.resetToken,
      data.resetExpiresAt,
      new Date(),
      new Date()
    );
  }

  isResetTokenValid(): boolean {
    return this.resetToken && this.resetExpiresAt 
      ? new Date() < this.resetExpiresAt 
      : false;
  }
}