import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { 
  IAuthRepository 
} from '@domain/repositories/IAuthRepository';
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
  UserAccountEntity,
  UserSessionEntity,
  UserPasswordEntity,
  AuthTokens
} from '@domain/entities/Auth';
import { UserProfile, UserRole } from '@domain/entities/User';

export class PrismaAuthRepository implements IAuthRepository {
  constructor(private prisma: PrismaClient) {}

  // OAuth Account Management
  async createUserAccount(account: Omit<UserAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserAccount> {
    const created = await this.prisma.userAccount.create({
      data: {
        userId: account.userId,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        tokenType: account.tokenType,
        scope: account.scope,
        idToken: account.idToken,
        expiresAt: account.expiresAt,
      }
    });

    return this.mapToUserAccount(created);
  }

  async findUserAccountByProvider(provider: AuthProvider, providerAccountId: string): Promise<UserAccount | null> {
    const account = await this.prisma.userAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: provider,
          providerAccountId: providerAccountId
        }
      }
    });

    return account ? this.mapToUserAccount(account) : null;
  }

  async findUserAccountsByUserId(userId: string): Promise<UserAccount[]> {
    const accounts = await this.prisma.userAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return accounts.map(account => this.mapToUserAccount(account));
  }

  async updateUserAccount(id: string, data: Partial<UserAccount>): Promise<UserAccount> {
    const updated = await this.prisma.userAccount.update({
      where: { id },
      data: {
        ...(data.accessToken !== undefined && { accessToken: data.accessToken }),
        ...(data.refreshToken !== undefined && { refreshToken: data.refreshToken }),
        ...(data.tokenType !== undefined && { tokenType: data.tokenType }),
        ...(data.scope !== undefined && { scope: data.scope }),
        ...(data.idToken !== undefined && { idToken: data.idToken }),
        ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt }),
      }
    });

    return this.mapToUserAccount(updated);
  }

  async deleteUserAccount(id: string): Promise<void> {
    await this.prisma.userAccount.delete({
      where: { id }
    });
  }

  // Session Management
  async createSession(session: Omit<UserSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserSession> {
    const created = await this.prisma.userSession.create({
      data: {
        userId: session.userId,
        sessionToken: session.sessionToken,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        isActive: session.isActive,
      }
    });

    return this.mapToUserSession(created);
  }

  async findSessionByToken(token: string): Promise<UserSession | null> {
    const session = await this.prisma.userSession.findUnique({
      where: { sessionToken: token }
    });

    return session ? this.mapToUserSession(session) : null;
  }

  async findSessionsByUserId(userId: string): Promise<UserSession[]> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return sessions.map(session => this.mapToUserSession(session));
  }

  async updateSession(id: string, data: Partial<UserSession>): Promise<UserSession> {
    const updated = await this.prisma.userSession.update({
      where: { id },
      data: {
        ...(data.accessToken !== undefined && { accessToken: data.accessToken }),
        ...(data.refreshToken !== undefined && { refreshToken: data.refreshToken }),
        ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt }),
        ...(data.userAgent !== undefined && { userAgent: data.userAgent }),
        ...(data.ipAddress !== undefined && { ipAddress: data.ipAddress }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      }
    });

    return this.mapToUserSession(updated);
  }

  async deleteSession(id: string): Promise<void> {
    await this.prisma.userSession.delete({
      where: { id }
    });
  }

  async deleteExpiredSessions(): Promise<number> {
    const result = await this.prisma.userSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: new Date() } },
          { isActive: false }
        ]
      }
    });

    return result.count;
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId },
      data: { isActive: false }
    });
  }

  // Password Management
  async createUserPassword(password: Omit<UserPassword, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserPassword> {
    const created = await this.prisma.userPassword.create({
      data: {
        userId: password.userId,
        passwordHash: password.passwordHash,
        salt: password.salt,
        resetToken: password.resetToken,
        resetExpiresAt: password.resetExpiresAt,
      }
    });

    return this.mapToUserPassword(created);
  }

  async findUserPasswordByUserId(userId: string): Promise<UserPassword | null> {
    const password = await this.prisma.userPassword.findUnique({
      where: { userId }
    });

    return password ? this.mapToUserPassword(password) : null;
  }

  async updateUserPassword(userId: string, data: Partial<UserPassword>): Promise<UserPassword> {
    const updated = await this.prisma.userPassword.update({
      where: { userId },
      data: {
        ...(data.passwordHash !== undefined && { passwordHash: data.passwordHash }),
        ...(data.salt !== undefined && { salt: data.salt }),
        ...(data.resetToken !== undefined && { resetToken: data.resetToken }),
        ...(data.resetExpiresAt !== undefined && { resetExpiresAt: data.resetExpiresAt }),
      }
    });

    return this.mapToUserPassword(updated);
  }

  async deleteUserPassword(userId: string): Promise<void> {
    await this.prisma.userPassword.delete({
      where: { userId }
    });
  }

  // Authentication Methods
  async authenticateWithEmail(credentials: EmailLoginRequest): Promise<AuthResult> {
    // Find user by email
    const user = await this.prisma.userProfile.findUnique({
      where: { email: credentials.email },
      include: {
        password: true,
        accounts: true
      }
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Check password
    if (!user.password) {
      throw new Error('Account does not have password authentication enabled');
    }

    const isValidPassword = await bcrypt.compare(credentials.password, user.password.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    await this.updateUserLastLogin(user.id);

    const userProfile = this.mapToUserProfile(user);
    const tokens = await this.generateTokens(user.id);

    return {
      user: userProfile,
      tokens,
      isNewUser: false,
      provider: AuthProvider.EMAIL
    };
  }

  async authenticateWithGoogle(googleUser: GoogleUserInfo): Promise<AuthResult> {
    // Check if account already exists
    let existingAccount = await this.findUserAccountByProvider(
      AuthProvider.GOOGLE, 
      googleUser.id
    );

    let user: UserProfile;
    let isNewUser = false;

    if (existingAccount) {
      // Existing Google account
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { id: existingAccount.userId }
      });

      if (!userProfile) {
        throw new Error('User profile not found');
      }

      user = this.mapToUserProfile(userProfile);
    } else {
      // Check if user exists by email
      let existingUser = await this.prisma.userProfile.findUnique({
        where: { email: googleUser.email }
      });

      if (existingUser) {
        // Link Google account to existing user
        await this.createUserAccount({
          userId: existingUser.id,
          provider: AuthProvider.GOOGLE,
          providerAccountId: googleUser.id,
          accessToken: undefined,
          refreshToken: undefined,
          tokenType: 'bearer',
          scope: 'openid email profile',
          idToken: undefined,
          expiresAt: undefined,
        });

        user = this.mapToUserProfile(existingUser);
      } else {
        // Create new user
        const newUser = await this.prisma.userProfile.create({
          data: {
            email: googleUser.email,
            firstName: googleUser.given_name,
            lastName: googleUser.family_name,
            avatar: googleUser.picture,
            emailVerified: googleUser.verified_email,
            role: 'customer',
            isActive: true,
          }
        });

        // Create Google account link
        await this.createUserAccount({
          userId: newUser.id,
          provider: AuthProvider.GOOGLE,
          providerAccountId: googleUser.id,
          accessToken: undefined,
          refreshToken: undefined,
          tokenType: 'bearer',
          scope: 'openid email profile',
          idToken: undefined,
          expiresAt: undefined,
        });

        user = this.mapToUserProfile(newUser);
        isNewUser = true;
      }
    }

    // Update last login
    await this.updateUserLastLogin(user.id);

    const tokens = await this.generateTokens(user.id);

    return {
      user,
      tokens,
      isNewUser,
      provider: AuthProvider.GOOGLE
    };
  }

  async registerWithEmail(data: EmailRegisterRequest): Promise<AuthResult> {
    // Check if user already exists
    const existingUser = await this.prisma.userProfile.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(data.password, saltRounds);

    // Create user and password in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.userProfile.create({
        data: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          role: 'customer',
          emailVerified: false,
          isActive: true,
        }
      });

      await tx.userPassword.create({
        data: {
          userId: user.id,
          passwordHash,
        }
      });

      return user;
    });

    const userProfile = this.mapToUserProfile(result);
    const tokens = await this.generateTokens(result.id);

    return {
      user: userProfile,
      tokens,
      isNewUser: true,
      provider: AuthProvider.EMAIL
    };
  }

  async findOrCreateUserFromGoogle(googleUser: GoogleUserInfo): Promise<UserProfile> {
    const authResult = await this.authenticateWithGoogle(googleUser);
    return authResult.user;
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    await this.prisma.userProfile.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() }
    });
  }

  async validateSession(sessionToken: string): Promise<SessionInfo | null> {
    const session = await this.prisma.userSession.findUnique({
      where: { sessionToken },
      include: {
        user: {
          include: {
            accounts: true
          }
        }
      }
    });

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return null;
    }

    const primaryProvider = session.user.accounts.length > 0 
      ? session.user.accounts[0].provider as AuthProvider
      : AuthProvider.EMAIL;

    return {
      userId: session.userId,
      email: session.user.email,
      role: session.user.role,
      provider: primaryProvider,
      isActive: session.user.isActive,
      expiresAt: session.expiresAt,
      lastLoginAt: session.user.lastLoginAt || undefined,
    };
  }

  async refreshUserSession(refreshToken: string): Promise<AuthResult> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken },
      include: {
        user: {
          include: {
            accounts: true
          }
        }
      }
    });

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      throw new Error('Invalid or expired refresh token');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(session.userId);

    // Update session
    await this.updateSession(session.id, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    const user = this.mapToUserProfile(session.user);
    const primaryProvider = session.user.accounts.length > 0 
      ? session.user.accounts[0].provider as AuthProvider
      : AuthProvider.EMAIL;

    return {
      user,
      tokens,
      isNewUser: false,
      provider: primaryProvider
    };
  }

  // Helper methods
  private async generateTokens(userId: string): Promise<AuthTokens> {
    // This is a simplified implementation
    // In a real app, you'd use proper JWT generation
    const accessToken = `access_${userId}_${Date.now()}`;
    const refreshToken = `refresh_${userId}_${Date.now()}`;

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour
      tokenType: 'Bearer'
    };
  }

  // Mapping methods
  private mapToUserAccount(data: any): UserAccount {
    return {
      id: data.id,
      userId: data.userId,
      provider: data.provider as AuthProvider,
      providerAccountId: data.providerAccountId,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      tokenType: data.tokenType,
      scope: data.scope,
      idToken: data.idToken,
      expiresAt: data.expiresAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  private mapToUserSession(data: any): UserSession {
    return {
      id: data.id,
      userId: data.userId,
      sessionToken: data.sessionToken,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      userAgent: data.userAgent,
      ipAddress: data.ipAddress,
      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  private mapToUserPassword(data: any): UserPassword {
    return {
      id: data.id,
      userId: data.userId,
      passwordHash: data.passwordHash,
      salt: data.salt,
      resetToken: data.resetToken,
      resetExpiresAt: data.resetExpiresAt,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  private mapToUserProfile(data: any): UserProfile {
    return {
      id: data.id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      dateOfBirth: data.dateOfBirth,
      avatar: data.avatar,
      role: data.role as UserRole,
      emailVerified: data.emailVerified,
      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      addresses: [],
      favoriteProductIds: []
    };
  }
}