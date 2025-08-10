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
  UpdateUserAddressRequest,
  UserEntity,
  UserProfileEntity,
  UserAddressEntity
} from '@domain/entities/User';
import { PrismaClient } from '@prisma/client';

export class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  // User operations
  async createUser(data: CreateUserRequest): Promise<User> {
    const created = await this.prisma.userProfile.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        avatar: data.avatar,
        role: data.role || 'customer',
        emailVerified: data.emailVerified || false,
      },
      include: {
        addresses: true,
        orders: true,
        favorites: {
          include: {
            product: true
          }
        }
      }
    });

    return this.mapToUser(created);
  }

  async findUserById(id: string): Promise<User | null> {
    const user = await this.prisma.userProfile.findUnique({
      where: { id },
      include: {
        addresses: true,
        orders: true,
        favorites: {
          include: {
            product: true
          }
        }
      }
    });

    return user ? this.mapToUser(user) : null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.userProfile.findUnique({
      where: { email },
      include: {
        addresses: true,
        orders: true,
        favorites: {
          include: {
            product: true
          }
        }
      }
    });

    return user ? this.mapToUser(user) : null;
  }

  async findAllUsers(limit?: number, offset?: number): Promise<User[]> {
    const users = await this.prisma.userProfile.findMany({
      include: {
        addresses: true,
        orders: true,
        favorites: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    return users.map(user => this.mapToUser(user));
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
    const updateData: any = {};

    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.role) updateData.role = data.role;
    if (data.emailVerified !== undefined) updateData.emailVerified = data.emailVerified;

    const updated = await this.prisma.userProfile.update({
      where: { id },
      data: updateData,
      include: {
        addresses: true,
        orders: true,
        favorites: {
          include: {
            product: true
          }
        }
      }
    });

    return this.mapToUser(updated);
  }

  async deleteUser(id: string): Promise<void> {
    await this.prisma.userProfile.delete({
      where: { id }
    });
  }

  async countUsers(): Promise<number> {
    return await this.prisma.userProfile.count();
  }

  // UserProfile operations
  async createUserProfile(data: UserProfileEntity): Promise<UserProfile> {
    const created = await this.prisma.userProfile.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        avatar: data.avatar,
        role: data.role || 'customer',
        emailVerified: data.emailVerified || false,
      }
    });

    return this.mapToUserProfile(created);
  }

  async findUserProfileById(id: string): Promise<UserProfile | null> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { id }
    });

    return profile ? this.mapToUserProfile(profile) : null;
  }

  async updateUserProfile(id: string, data: Partial<UserProfileEntity>): Promise<UserProfile> {
    const updateData: any = {};

    if (data.email) updateData.email = data.email;
    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.role) updateData.role = data.role;
    if (data.emailVerified !== undefined) updateData.emailVerified = data.emailVerified;

    const updated = await this.prisma.userProfile.update({
      where: { id },
      data: updateData
    });

    return this.mapToUserProfile(updated);
  }

  // UserAddress operations
  async createUserAddress(data: CreateUserAddressRequest): Promise<UserAddress> {
    const created = await this.prisma.userAddress.create({
      data: {
        userId: data.userId,
        type: data.type || 'shipping',
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company,
        address1: data.address1,
        address2: data.address2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country || 'PE',
        phone: data.phone,
        isDefault: data.isDefault || false,
      }
    });

    return this.mapToUserAddress(created);
  }

  async findUserAddressById(id: string): Promise<UserAddress | null> {
    const address = await this.prisma.userAddress.findUnique({
      where: { id }
    });

    return address ? this.mapToUserAddress(address) : null;
  }

  async findUserAddressesByUserId(userId: string): Promise<UserAddress[]> {
    const addresses = await this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return addresses.map(address => this.mapToUserAddress(address));
  }

  async updateUserAddress(id: string, data: UpdateUserAddressRequest): Promise<UserAddress> {
    const updateData: any = {};

    if (data.type) updateData.type = data.type;
    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.company !== undefined) updateData.company = data.company;
    if (data.address1) updateData.address1 = data.address1;
    if (data.address2 !== undefined) updateData.address2 = data.address2;
    if (data.city) updateData.city = data.city;
    if (data.state) updateData.state = data.state;
    if (data.postalCode) updateData.postalCode = data.postalCode;
    if (data.country) updateData.country = data.country;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    const updated = await this.prisma.userAddress.update({
      where: { id },
      data: updateData
    });

    return this.mapToUserAddress(updated);
  }

  async deleteUserAddress(id: string): Promise<void> {
    await this.prisma.userAddress.delete({
      where: { id }
    });
  }

  // User Statistics
  async getUserStats(userId: string): Promise<UserStats> {
    const [orderCount, totalSpent, favoriteCount] = await Promise.all([
      this.prisma.order.count({
        where: { userId }
      }),
      this.prisma.order.aggregate({
        where: { userId },
        _sum: {
          totalAmount: true
        }
      }),
      this.prisma.userFavorite.count({
        where: { userId }
      })
    ]);

    return {
      userId,
      orderCount,
      totalSpent: totalSpent._sum.totalAmount ? parseFloat(totalSpent._sum.totalAmount.toString()) : 0,
      favoriteCount,
      averageOrderValue: orderCount > 0 && totalSpent._sum.totalAmount 
        ? parseFloat(totalSpent._sum.totalAmount.toString()) / orderCount 
        : 0
    };
  }

  // User Favorites
  async addToFavorites(userId: string, productId: string): Promise<void> {
    await this.prisma.userFavorite.create({
      data: {
        userId,
        productId
      }
    });
  }

  async removeFromFavorites(userId: string, productId: string): Promise<void> {
    await this.prisma.userFavorite.delete({
      where: {
        userId_productId: {
          userId,
          productId
        }
      }
    });
  }

  async getUserFavorites(userId: string): Promise<string[]> {
    const favorites = await this.prisma.userFavorite.findMany({
      where: { userId },
      select: { productId: true }
    });

    return favorites.map(fav => fav.productId);
  }

  // User Order History
  async getUserOrderHistory(userId: string, limit?: number, offset?: number): Promise<any[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        paymentMethods: true,
        shippingAddress: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    return orders;
  }

  // Helper mapping methods
  private mapToUser(data: any): User {
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
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      addresses: data.addresses?.map((addr: any) => this.mapToUserAddress(addr)) || [],
      favoriteProductIds: data.favorites?.map((fav: any) => fav.productId) || []
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
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }

  private mapToUserAddress(data: any): UserAddress {
    return {
      id: data.id,
      userId: data.userId,
      type: data.type,
      firstName: data.firstName,
      lastName: data.lastName,
      company: data.company,
      address1: data.address1,
      address2: data.address2,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      country: data.country,
      phone: data.phone,
      isDefault: data.isDefault,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    };
  }
}