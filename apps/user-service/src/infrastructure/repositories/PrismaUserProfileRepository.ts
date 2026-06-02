import { IUserRepository } from '@domain/repositories/IUserRepository';
import {
  User,
  UserProfile,
  UserAddress,
  UserStats,
  CreateUserRequest,
  UpdateUserRequest,
  CreateUserAddressRequest,
  UpdateUserAddressRequest,
} from '@domain/entities/User';
import { PrismaClient } from '../../prisma';
import bcrypt from 'bcryptjs';
import { BusinessLogicError } from '@domain/errors/DomainError';

export class PrismaUserProfileRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  // Helper method to transform Prisma UserProfile to Domain User
  private mapToUser(prismaUserProfile: any): User {
    return {
      id: prismaUserProfile.id,
      email: prismaUserProfile.email,
      isActive: prismaUserProfile.isActive,
      emailVerified: prismaUserProfile.emailVerified,
      failedLoginAttempts: prismaUserProfile.failedLoginAttempts ?? 0,
      lockedUntil: prismaUserProfile.lockedUntil ?? null,
      createdAt: prismaUserProfile.createdAt,
      updatedAt: prismaUserProfile.updatedAt,
      profile: {
        id: prismaUserProfile.id,
        email: prismaUserProfile.email,
        firstName: prismaUserProfile.firstName,
        lastName: prismaUserProfile.lastName,
        phone: prismaUserProfile.phone,
        dateOfBirth: prismaUserProfile.dateOfBirth,
        avatar: prismaUserProfile.avatar,
        emailVerified: prismaUserProfile.emailVerified,
        isActive: prismaUserProfile.isActive,
        lastLoginAt: prismaUserProfile.lastLoginAt,
        createdAt: prismaUserProfile.createdAt,
        updatedAt: prismaUserProfile.updatedAt,
        addresses: prismaUserProfile.addresses
          ? prismaUserProfile.addresses.map(this.mapToUserAddress)
          : [],
        favoriteProductIds: [],
      },
      addresses: prismaUserProfile.addresses
        ? prismaUserProfile.addresses.map(this.mapToUserAddress)
        : [],
    };
  }

  private mapToUserAddress(prismaAddress: any): UserAddress {
    return {
      id: prismaAddress.id,
      userId: prismaAddress.userId,
      title: prismaAddress.type || 'shipping', // Usar 'type' de Prisma, mapear a 'title' del dominio
      firstName: prismaAddress.firstName,
      lastName: prismaAddress.lastName,
      addressLine1: prismaAddress.address1,
      addressLine2: prismaAddress.address2,
      city: prismaAddress.city,
      state: prismaAddress.state,
      postalCode: prismaAddress.postalCode,
      country: prismaAddress.country,
      isDefault: prismaAddress.isDefault,
      createdAt: prismaAddress.createdAt,
      updatedAt: prismaAddress.updatedAt,
    };
  }

  private mapToUserProfile(prismaUserProfile: any): UserProfile {
    return {
      id: prismaUserProfile.id,
      email: prismaUserProfile.email,
      firstName: prismaUserProfile.firstName,
      lastName: prismaUserProfile.lastName,
      phone: prismaUserProfile.phone,
      dateOfBirth: prismaUserProfile.dateOfBirth,
      avatar: prismaUserProfile.avatar,
      emailVerified: prismaUserProfile.emailVerified,
      isActive: prismaUserProfile.isActive,
      lastLoginAt: prismaUserProfile.lastLoginAt,
      createdAt: prismaUserProfile.createdAt,
      updatedAt: prismaUserProfile.updatedAt,
      addresses: prismaUserProfile.addresses
        ? prismaUserProfile.addresses.map(this.mapToUserAddress)
        : [],
      favoriteProductIds: [],
    };
  }

  // User operations
  async createUser(data: CreateUserRequest): Promise<User> {
    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Resolve the 'customer' group id once — fail-fast if seed hasn't been applied
    const customerGroup = await this.prisma.authGroup.findUnique({
      where: { code: 'customer' },
      select: { id: true },
    });
    if (!customerGroup) {
      throw new BusinessLogicError(
        "RBAC seed not applied: 'customer' group missing. Run prisma db seed.",
      );
    }

    // Create user profile, password, and group assignment in a single transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the user profile
      const userProfile = await tx.userProfile.create({
        data: {
          email: data.email,
          firstName: data.profile?.firstName || '',
          lastName: data.profile?.lastName || '',
          phone: data.profile?.phone,
          dateOfBirth: data.profile?.birthDate,
          avatar: undefined,
          emailVerified: false,
          isActive: true,
        },
        include: {
          addresses: true,
        },
      });

      // Create the password entry
      await tx.userPassword.create({
        data: {
          userId: userProfile.id,
          passwordHash,
        },
      });

      // Assign new user to the 'customer' group (RBAC baseline)
      await tx.userGroup.create({
        data: {
          userId: userProfile.id,
          groupId: customerGroup.id,
          grantedBy: 'system-registration',
        },
      });

      return userProfile;
    });

    return this.mapToUser(result);
  }

  async getUsers(
    limit?: number,
    offset?: number,
    isActive?: boolean,
  ): Promise<{ users: User[]; total: number }> {
    const where: any = {};

    // Only add filters for defined and non-null values
    if (isActive !== undefined && isActive !== null) {
      where.isActive = isActive;
    }

    const [userProfiles, total] = await Promise.all([
      this.prisma.userProfile.findMany({
        where,
        take: limit,
        skip: offset,
        include: {
          addresses: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.userProfile.count({ where }),
    ]);

    return {
      users: userProfiles.map((up) => this.mapToUser(up)),
      total,
    };
  }

  async getUserById(id: string): Promise<User | null> {
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { id },
      include: {
        addresses: true,
        accounts: true,
        sessions: true,
      },
    });

    return userProfile ? this.mapToUser(userProfile) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { email },
      include: {
        addresses: true,
      },
    });

    return userProfile ? this.mapToUser(userProfile) : null;
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
    const updateData: any = {};

    if (data.email !== undefined) updateData.email = data.email;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (data.profile) {
      if (data.profile.firstName !== undefined) updateData.firstName = data.profile.firstName;
      if (data.profile.lastName !== undefined) updateData.lastName = data.profile.lastName;
      if (data.profile.phone !== undefined) updateData.phone = data.profile.phone;
      if (data.profile.birthDate !== undefined) updateData.dateOfBirth = data.profile.birthDate; // Mapear a dateOfBirth de la BD
      if (data.profile.avatarUrl !== undefined) updateData.avatar = data.profile.avatarUrl; // Mapear a avatar de la BD
    }

    const updatedUserProfile = await this.prisma.userProfile.update({
      where: { id },
      data: updateData,
      include: {
        addresses: true,
      },
    });

    return this.mapToUser(updatedUserProfile);
  }

  async deleteUser(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Delete related data first
      await tx.userPassword.deleteMany({ where: { userId: id } });
      await tx.userSession.deleteMany({ where: { userId: id } });
      await tx.userAccount.deleteMany({ where: { userId: id } });
      await tx.userAddress.deleteMany({ where: { userId: id } });
      await tx.userFavorite.deleteMany({ where: { userId: id } });

      // Delete the user profile
      await tx.userProfile.delete({ where: { id } });
    });
  }

  async getUserStats(): Promise<UserStats> {
    const [totalUsers, activeUsers, usersThisMonth] = await Promise.all([
      this.prisma.userProfile.count(),
      this.prisma.userProfile.count({ where: { isActive: true } }),
      this.prisma.userProfile.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      newUsersThisMonth: usersThisMonth,
    };
  }

  async getActiveUsers(): Promise<User[]> {
    const userProfiles = await this.prisma.userProfile.findMany({
      where: { isActive: true },
      include: {
        addresses: true,
      },
    });

    return userProfiles.map((up) => this.mapToUser(up));
  }

  async searchUsers(query: string): Promise<User[]> {
    const userProfiles = await this.prisma.userProfile.findMany({
      where: {
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        addresses: true,
      },
    });

    return userProfiles.map((up) => this.mapToUser(up));
  }

  // User profile operations (these delegate to user operations since UserProfile is the main entity)
  async createUserProfile(
    userId: string,
    profile: Omit<UserProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<UserProfile> {
    const updatedUserProfile = await this.prisma.userProfile.update({
      where: { id: userId },
      data: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        dateOfBirth: profile.dateOfBirth,
        avatar: profile.avatar,
      },
    });

    return this.mapToUserProfile(updatedUserProfile);
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { id: userId },
    });

    return userProfile ? this.mapToUserProfile(userProfile) : null;
  }

  async updateUserProfile(
    userId: string,
    profile: Partial<Omit<UserProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<UserProfile> {
    const updateData: any = {};

    if (profile.firstName !== undefined) updateData.firstName = profile.firstName;
    if (profile.lastName !== undefined) updateData.lastName = profile.lastName;
    if (profile.phone !== undefined) updateData.phone = profile.phone;
    if (profile.dateOfBirth !== undefined) updateData.dateOfBirth = profile.dateOfBirth;
    if (profile.avatar !== undefined) updateData.avatar = profile.avatar;

    const updatedUserProfile = await this.prisma.userProfile.update({
      where: { id: userId },
      data: updateData,
    });

    return this.mapToUserProfile(updatedUserProfile);
  }

  async deleteUserProfile(userId: string): Promise<void> {
    // Since UserProfile is the main entity, we don't delete it, just clear profile fields
    await this.prisma.userProfile.update({
      where: { id: userId },
      data: {
        firstName: '',
        lastName: '',
        phone: null,
        dateOfBirth: null,
        avatar: null,
      },
    });
  }

  // User address operations
  async createUserAddress(data: CreateUserAddressRequest): Promise<UserAddress> {
    const address = await this.prisma.userAddress.create({
      data: {
        userId: data.userId,
        type: data.title, // Mapear 'title' del dominio a 'type' de Prisma
        firstName: data.firstName,
        lastName: data.lastName,
        address1: data.addressLine1,
        address2: data.addressLine2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        isDefault: data.isDefault || false,
      },
    });

    return this.mapToUserAddress(address);
  }

  async getUserAddresses(userId: string): Promise<UserAddress[]> {
    const addresses = await this.prisma.userAddress.findMany({
      where: { userId },
    });

    return addresses.map((addr) => this.mapToUserAddress(addr));
  }

  async getUserAddressById(id: string): Promise<UserAddress | null> {
    const address = await this.prisma.userAddress.findUnique({
      where: { id },
    });

    return address ? this.mapToUserAddress(address) : null;
  }

  async updateUserAddress(id: string, data: UpdateUserAddressRequest): Promise<UserAddress> {
    const updateData: any = {};

    if (data.title !== undefined) updateData.type = data.title; // Mapear 'title' del dominio a 'type' de Prisma
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.addressLine1 !== undefined) updateData.address1 = data.addressLine1;
    if (data.addressLine2 !== undefined) updateData.address2 = data.addressLine2;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.postalCode !== undefined) updateData.postalCode = data.postalCode;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    const updatedAddress = await this.prisma.userAddress.update({
      where: { id },
      data: updateData,
    });

    return this.mapToUserAddress(updatedAddress);
  }

  async deleteUserAddress(id: string): Promise<void> {
    await this.prisma.userAddress.delete({
      where: { id },
    });
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Reset all addresses to non-default
      await tx.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      // Set the specified address as default
      await tx.userAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
    });
  }

  async getDefaultAddress(userId: string): Promise<UserAddress | null> {
    const address = await this.prisma.userAddress.findFirst({
      where: {
        userId,
        isDefault: true,
      },
    });

    return address ? this.mapToUserAddress(address) : null;
  }

  async getUserPasswordHash(userId: string): Promise<string | null> {
    const userPassword = await this.prisma.userPassword.findUnique({
      where: { userId },
    });

    return userPassword?.passwordHash || null;
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    await this.prisma.userProfile.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async updateUserLockout(
    userId: string,
    data: { failedLoginAttempts: number; lockedUntil: Date | null },
  ): Promise<void> {
    await this.prisma.userProfile.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: data.failedLoginAttempts,
        lockedUntil: data.lockedUntil,
      },
    });
  }

  async resetUserLockout(userId: string): Promise<void> {
    await this.prisma.userProfile.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  // ── Email verification operations ──────────────────────────────────────────

  async setEmailVerificationToken(
    userId: string,
    data: { token: string; expiresAt: Date },
  ): Promise<void> {
    await this.prisma.userProfile.update({
      where: { id: userId },
      data: {
        emailVerificationToken: data.token,
        emailVerificationExpiresAt: data.expiresAt,
      },
    });
  }

  async getEmailVerificationData(
    userId: string,
  ): Promise<{ token: string | null; expiresAt: Date | null; emailVerified: boolean } | null> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { id: userId },
      select: {
        emailVerificationToken: true,
        emailVerificationExpiresAt: true,
        emailVerified: true,
      },
    });

    if (!profile) return null;

    return {
      token: profile.emailVerificationToken,
      expiresAt: profile.emailVerificationExpiresAt,
      emailVerified: profile.emailVerified,
    };
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.prisma.userProfile.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });
  }

  async clearEmailVerificationToken(userId: string): Promise<void> {
    await this.prisma.userProfile.update({
      where: { id: userId },
      data: {
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });
  }

  // ── MFA operations ─────────────────────────────────────────────────────────

  async setMfaSecret(userId: string, encryptedSecret: string): Promise<void> {
    await this.prisma.userProfile.update({
      where: { id: userId },
      data: {
        mfaSecret: encryptedSecret,
        mfaEnabled: false, // stays false until VerifyMfaSetup confirms first TOTP
      },
    });
  }

  async getMfaData(
    userId: string,
  ): Promise<{ mfaEnabled: boolean; mfaSecret: string | null; mfaBackupCodes: string[] } | null> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { id: userId },
      select: {
        mfaEnabled: true,
        mfaSecret: true,
        mfaBackupCodes: true,
      },
    });

    if (!profile) return null;

    return {
      mfaEnabled: profile.mfaEnabled,
      mfaSecret: profile.mfaSecret,
      mfaBackupCodes: profile.mfaBackupCodes,
    };
  }

  async enableMfa(userId: string, backupCodeHashes: string[]): Promise<void> {
    await this.prisma.userProfile.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaBackupCodes: backupCodeHashes,
      },
    });
  }

  async disableMfa(userId: string): Promise<void> {
    await this.prisma.userProfile.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
      },
    });
  }
}
