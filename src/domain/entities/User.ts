export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: Date;
  avatar?: string;
  role: UserRole;
  emailVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  addresses: UserAddress[];
  favoriteProductIds: string[];
}

export interface UserAddress {
  id: string;
  userId: string;
  title: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  profile?: UserProfile;
  addresses?: UserAddress[];
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
  STAFF = 'staff'
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role?: UserRole;
  profile?: {
    firstName: string;
    lastName: string;
    phone?: string;
    birthDate?: Date;
  };
  isActive?: boolean;
}

export interface UpdateUserRequest {
  email?: string;
  role?: UserRole;
  isActive?: boolean;
  profile?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    birthDate?: Date;
    avatarUrl?: string;
  };
}

export interface CreateUserAddressRequest {
  userId: string;
  title: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
}

export interface UpdateUserAddressRequest {
  title?: string;
  firstName?: string;
  lastName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  usersByRole: Record<UserRole, number>;
}

// Entity classes
export class UserProfileEntity implements UserProfile {
  constructor(
    public id: string,
    public email: string,
    public firstName: string,
    public lastName: string,
    public phone: string | undefined,
    public dateOfBirth: Date | undefined,
    public avatar: string | undefined,
    public role: UserRole,
    public emailVerified: boolean,
    public isActive: boolean,
    public lastLoginAt: Date | undefined,
    public createdAt: Date,
    public updatedAt: Date,
    public addresses: UserAddress[],
    public favoriteProductIds: string[]
  ) {}

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  static create(data: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'addresses' | 'favoriteProductIds'>): UserProfileEntity {
    return new UserProfileEntity(
      crypto.randomUUID(),
      data.email,
      data.firstName,
      data.lastName,
      data.phone,
      data.dateOfBirth,
      data.avatar,
      data.role,
      data.emailVerified,
      data.isActive,
      data.lastLoginAt,
      new Date(),
      new Date(),
      [],
      []
    );
  }
}

export class UserAddressEntity implements UserAddress {
  constructor(
    public id: string,
    public userId: string,
    public title: string,
    public firstName: string,
    public lastName: string,
    public addressLine1: string,
    public addressLine2: string | undefined,
    public city: string,
    public state: string,
    public postalCode: string,
    public country: string,
    public isDefault: boolean,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  get fullAddress(): string {
    const parts = [
      this.addressLine1,
      this.addressLine2,
      this.city,
      this.state,
      this.postalCode,
      this.country
    ].filter(Boolean);
    return parts.join(', ');
  }

  static create(data: Omit<UserAddress, 'id' | 'createdAt' | 'updatedAt'>): UserAddressEntity {
    return new UserAddressEntity(
      crypto.randomUUID(),
      data.userId,
      data.title,
      data.firstName,
      data.lastName,
      data.addressLine1,
      data.addressLine2,
      data.city,
      data.state,
      data.postalCode,
      data.country,
      data.isDefault,
      new Date(),
      new Date()
    );
  }
}

export class UserEntity implements User {
  constructor(
    public id: string,
    public email: string,
    public role: UserRole,
    public isActive: boolean,
    public emailVerified: boolean,
    public profile: UserProfileEntity | undefined,
    public addresses: UserAddressEntity[],
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  get fullName(): string {
    return this.profile?.fullName || this.email;
  }

  get displayName(): string {
    if (this.profile?.fullName) {
      return this.profile.fullName;
    }
    return this.email.split('@')[0];
  }

  get isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  get isStaff(): boolean {
    return this.role === UserRole.STAFF || this.role === UserRole.ADMIN;
  }

  static create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'profile' | 'addresses'>): UserEntity {
    return new UserEntity(
      crypto.randomUUID(),
      data.email,
      data.role,
      data.isActive,
      data.emailVerified,
      undefined,
      [],
      new Date(),
      new Date()
    );
  }
}