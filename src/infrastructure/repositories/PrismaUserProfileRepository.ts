import { IUserRepository } from '@domain/repositories/IUserRepository';
import { 
  User, 
  UserProfile, 
  UserAddress, 
  UserRole, 
  UserStats, 
  CreateUserRequest, 
  UpdateUserRequest, 
  CreateUserAddressRequest, 
  UpdateUserAddressRequest
} from '@domain/entities/User';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

export class PrismaUserProfileRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  // Helper method to transform Prisma UserProfile to Domain User
  private mapToUser(prismaUserProfile: any): User {
    return {
      id: prismaUserProfile.id,
      email: prismaUserProfile.email,
      role: prismaUserProfile.role as UserRole,
      isActive: prismaUserProfile.isActive,
      emailVerified: prismaUserProfile.emailVerified,
      createdAt: prismaUserProfile.createdAt,
      updatedAt: prismaUserProfile.updatedAt,
      profile: {
        id: prismaUserProfile.id,
        userId: prismaUserProfile.id,
        firstName: prismaUserProfile.firstName,
        lastName: prismaUserProfile.lastName,
        phone: prismaUserProfile.phone,
        birthDate: prismaUserProfile.dateOfBirth,
        avatarUrl: prismaUserProfile.avatar,
        createdAt: prismaUserProfile.createdAt,
        updatedAt: prismaUserProfile.updatedAt
      },
      addresses: prismaUserProfile.addresses ? prismaUserProfile.addresses.map(this.mapToUserAddress) : []
    };
  }

  private mapToUserAddress(prismaAddress: any): UserAddress {
    return {
      id: prismaAddress.id,
      userId: prismaAddress.userId,
      title: prismaAddress.type || 'shipping',  // Usar 'type' de Prisma, mapear a 'title' del dominio
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
      updatedAt: prismaAddress.updatedAt
    };
  }

  private mapToUserProfile(prismaUserProfile: any): UserProfile {
    return {
      id: prismaUserProfile.id,
      userId: prismaUserProfile.id,
      firstName: prismaUserProfile.firstName,
      lastName: prismaUserProfile.lastName,
      phone: prismaUserProfile.phone,
      birthDate: prismaUserProfile.dateOfBirth,
      avatarUrl: prismaUserProfile.avatar,
      createdAt: prismaUserProfile.createdAt,
      updatedAt: prismaUserProfile.updatedAt
    };
  }

  // User operations
  async createUser(data: CreateUserRequest): Promise<User> {
    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Create user profile and password in transaction
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
          role: data.role || 'customer',
          emailVerified: false,
          isActive: true
        },
        include: {
          addresses: true
        }
      });

      // Create the password entry
      await tx.userPassword.create({
        data: {
          userId: userProfile.id,
          passwordHash
        }
      });

      return userProfile;
    });

    return this.mapToUser(result);
  }

  async getUsers(limit?: number, offset?: number, role?: UserRole, isActive?: boolean): Promise<{ users: User[], total: number }> {
    const where: any = {};
    
    // Only add filters for defined and non-null values
    if (role !== undefined && role !== null) {
      where.role = role;
    }
    
    if (isActive !== undefined && isActive !== null) {
      where.isActive = isActive;
    }

    const [userProfiles, total] = await Promise.all([
      this.prisma.userProfile.findMany({
        where,
        take: limit,
        skip: offset,
        include: {
          addresses: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      this.prisma.userProfile.count({ where })
    ]);

    return {
      users: userProfiles.map(up => this.mapToUser(up)),
      total
    };
  }

  async getUserById(id: string): Promise<User | null> {
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { id },
      include: {
        addresses: true,
        accounts: true,
        sessions: true
      }
    });

    return userProfile ? this.mapToUser(userProfile) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { email },
      include: {
        addresses: true
      }
    });

    return userProfile ? this.mapToUser(userProfile) : null;
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
    const updateData: any = {};
    
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    
    if (data.profile) {
      if (data.profile.firstName !== undefined) updateData.firstName = data.profile.firstName;
      if (data.profile.lastName !== undefined) updateData.lastName = data.profile.lastName;
      if (data.profile.phone !== undefined) updateData.phone = data.profile.phone;
      if (data.profile.birthDate !== undefined) updateData.dateOfBirth = data.profile.birthDate;  // Mapear a dateOfBirth de la BD
      if (data.profile.avatarUrl !== undefined) updateData.avatar = data.profile.avatarUrl;       // Mapear a avatar de la BD
    }

    const updatedUserProfile = await this.prisma.userProfile.update({
      where: { id },
      data: updateData,
      include: {
        addresses: true
      }
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
    const [
      totalUsers,
      activeUsers,
      adminUsers,
      customerUsers,
      staffUsers,
      usersThisMonth
    ] = await Promise.all([
      this.prisma.userProfile.count(),
      this.prisma.userProfile.count({ where: { isActive: true } }),
      this.prisma.userProfile.count({ where: { role: 'admin' } }),
      this.prisma.userProfile.count({ where: { role: 'customer' } }),
      this.prisma.userProfile.count({ where: { role: 'staff' } }),
      this.prisma.userProfile.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ]);

    return {
      totalUsers,
      activeUsers,
      newUsersThisMonth: usersThisMonth,
      usersByRole: {
        admin: adminUsers,
        customer: customerUsers,
        staff: staffUsers
      }
    };
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    const userProfiles = await this.prisma.userProfile.findMany({
      where: { role },
      include: {
        addresses: true
      }
    });

    return userProfiles.map(up => this.mapToUser(up));
  }

  async getActiveUsers(): Promise<User[]> {
    const userProfiles = await this.prisma.userProfile.findMany({
      where: { isActive: true },
      include: {
        addresses: true
      }
    });

    return userProfiles.map(up => this.mapToUser(up));
  }

  async searchUsers(query: string): Promise<User[]> {
    const userProfiles = await this.prisma.userProfile.findMany({
      where: {
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        addresses: true
      }
    });

    return userProfiles.map(up => this.mapToUser(up));
  }

  // User profile operations (these delegate to user operations since UserProfile is the main entity)
  async createUserProfile(userId: string, profile: Omit<UserProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
    const updatedUserProfile = await this.prisma.userProfile.update({
      where: { id: userId },
      data: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        dateOfBirth: profile.birthDate,
        avatar: profile.avatarUrl
      }
    });

    return this.mapToUserProfile(updatedUserProfile);
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { id: userId }
    });

    return userProfile ? this.mapToUserProfile(userProfile) : null;
  }

  async updateUserProfile(userId: string, profile: Partial<Omit<UserProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<UserProfile> {
    const updateData: any = {};
    
    if (profile.firstName !== undefined) updateData.firstName = profile.firstName;
    if (profile.lastName !== undefined) updateData.lastName = profile.lastName;
    if (profile.phone !== undefined) updateData.phone = profile.phone;
    if (profile.birthDate !== undefined) updateData.dateOfBirth = profile.birthDate;
    if (profile.avatarUrl !== undefined) updateData.avatar = profile.avatarUrl;

    const updatedUserProfile = await this.prisma.userProfile.update({
      where: { id: userId },
      data: updateData
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
        avatar: null
      }
    });
  }

  // User address operations
  async createUserAddress(data: CreateUserAddressRequest): Promise<UserAddress> {
    const address = await this.prisma.userAddress.create({
      data: {
        userId: data.userId,
        type: data.title,  // Mapear 'title' del dominio a 'type' de Prisma
        firstName: data.firstName,
        lastName: data.lastName,
        address1: data.addressLine1,
        address2: data.addressLine2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        isDefault: data.isDefault || false
      }
    });

    return this.mapToUserAddress(address);
  }

  async getUserAddresses(userId: string): Promise<UserAddress[]> {
    const addresses = await this.prisma.userAddress.findMany({
      where: { userId }
    });

    return addresses.map(addr => this.mapToUserAddress(addr));
  }

  async getUserAddressById(id: string): Promise<UserAddress | null> {
    const address = await this.prisma.userAddress.findUnique({
      where: { id }
    });

    return address ? this.mapToUserAddress(address) : null;
  }

  async updateUserAddress(id: string, data: UpdateUserAddressRequest): Promise<UserAddress> {
    const updateData: any = {};
    
    if (data.title !== undefined) updateData.type = data.title;  // Mapear 'title' del dominio a 'type' de Prisma
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
      data: updateData
    });

    return this.mapToUserAddress(updatedAddress);
  }

  async deleteUserAddress(id: string): Promise<void> {
    await this.prisma.userAddress.delete({
      where: { id }
    });
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Reset all addresses to non-default
      await tx.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false }
      });

      // Set the specified address as default
      await tx.userAddress.update({
        where: { id: addressId },
        data: { isDefault: true }
      });
    });
  }

  async getDefaultAddress(userId: string): Promise<UserAddress | null> {
    const address = await this.prisma.userAddress.findFirst({
      where: { 
        userId,
        isDefault: true 
      }
    });

    return address ? this.mapToUserAddress(address) : null;
  }

  async getUserPasswordHash(userId: string): Promise<string | null> {
    const userPassword = await this.prisma.userPassword.findUnique({
      where: { userId }
    });

    return userPassword?.passwordHash || null;
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    await this.prisma.userProfile.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() }
    });
  }
}