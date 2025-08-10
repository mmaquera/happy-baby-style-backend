import { User, UserProfile, UserAddress, UserRole, UserStats, CreateUserRequest, UpdateUserRequest, CreateUserAddressRequest, UpdateUserAddressRequest } from '../entities/User';

export interface IUserRepository {
  // User operations
  createUser(data: CreateUserRequest): Promise<User>;
  getUsers(limit?: number, offset?: number, role?: UserRole, isActive?: boolean): Promise<{ users: User[], total: number }>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUser(id: string, data: UpdateUserRequest): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getUserStats(): Promise<UserStats>;
  getUsersByRole(role: UserRole): Promise<User[]>;
  getActiveUsers(): Promise<User[]>;
  searchUsers(query: string): Promise<User[]>;
  getUserPasswordHash(userId: string): Promise<string | null>;
  updateUserLastLogin(userId: string): Promise<void>;
  
  // User profile operations
  createUserProfile(userId: string, profile: Omit<UserProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<UserProfile>;
  getUserProfile(userId: string): Promise<UserProfile | null>;
  updateUserProfile(userId: string, profile: Partial<Omit<UserProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<UserProfile>;
  deleteUserProfile(userId: string): Promise<void>;
  
  // User address operations
  createUserAddress(data: CreateUserAddressRequest): Promise<UserAddress>;
  getUserAddresses(userId: string): Promise<UserAddress[]>;
  getUserAddressById(id: string): Promise<UserAddress | null>;
  updateUserAddress(id: string, data: UpdateUserAddressRequest): Promise<UserAddress>;
  deleteUserAddress(id: string): Promise<void>;
  setDefaultAddress(userId: string, addressId: string): Promise<void>;
  getDefaultAddress(userId: string): Promise<UserAddress | null>;
}