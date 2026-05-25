import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { UnauthorizedError, ForbiddenError, ValidationError } from '@domain/errors/DomainError';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
}

export enum UserRole {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
  STAFF = 'staff'
}

export enum Permission {
  // Product permissions
  CREATE_PRODUCT = 'create:product',
  READ_PRODUCT = 'read:product',
  UPDATE_PRODUCT = 'update:product',
  DELETE_PRODUCT = 'delete:product',
  
  // Order permissions
  CREATE_ORDER = 'create:order',
  READ_ORDER = 'read:order',
  UPDATE_ORDER = 'update:order',
  DELETE_ORDER = 'delete:order',
  
  // User permissions
  CREATE_USER = 'create:user',
  READ_USER = 'read:user',
  UPDATE_USER = 'update:user',
  DELETE_USER = 'delete:user',
  
  // Admin permissions
  MANAGE_USERS = 'manage:users',
  MANAGE_SYSTEM = 'manage:system',
  VIEW_ANALYTICS = 'view:analytics'
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  iat?: number;
  exp?: number;
}

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly saltRounds: number = 12;

  // Role-based permissions mapping
  private readonly rolePermissions: Record<UserRole, Permission[]> = {
    [UserRole.ADMIN]: [
      Permission.CREATE_PRODUCT,
      Permission.READ_PRODUCT,
      Permission.UPDATE_PRODUCT,
      Permission.DELETE_PRODUCT,
      Permission.CREATE_ORDER,
      Permission.READ_ORDER,
      Permission.UPDATE_ORDER,
      Permission.DELETE_ORDER,
      Permission.CREATE_USER,
      Permission.READ_USER,
      Permission.UPDATE_USER,
      Permission.DELETE_USER,
      Permission.MANAGE_USERS,
      Permission.MANAGE_SYSTEM,
      Permission.VIEW_ANALYTICS
    ],
    [UserRole.STAFF]: [
      Permission.CREATE_PRODUCT,
      Permission.READ_PRODUCT,
      Permission.UPDATE_PRODUCT,
      Permission.CREATE_ORDER,
      Permission.READ_ORDER,
      Permission.UPDATE_ORDER,
      Permission.READ_USER,
      Permission.VIEW_ANALYTICS
    ],
    [UserRole.CUSTOMER]: [
      Permission.READ_PRODUCT,
      Permission.CREATE_ORDER,
      Permission.READ_ORDER,
      Permission.READ_USER
    ]
  };

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    
    if (!process.env.JWT_SECRET) {
      console.warn('JWT_SECRET not set in environment variables. Using default (not secure for production)');
    }
  }

  async hashPassword(password: string): Promise<string> {
    if (!password || password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long');
    }
    
    return await bcrypt.hash(password, this.saltRounds);
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  generateToken(user: AuthUser): string {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    };

    const secret = this.jwtSecret;
    if (!secret) {
      throw new Error('JWT secret is not configured');
    }
    
    return (jwt.sign as any)(payload, secret, { 
      expiresIn: this.jwtExpiresIn,
      issuer: 'happy-baby-style-admin'
    });
  }

  verifyToken(token: string): TokenPayload {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;
      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      throw new UnauthorizedError('Token verification failed');
    }
  }

  extractTokenFromHeader(authHeader?: string): string {
    if (!authHeader) {
      throw new UnauthorizedError('Authorization header is required');
    }

    const [type, token] = authHeader.split(' ');
    
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedError('Invalid authorization header format. Expected: Bearer <token>');
    }

    return token;
  }

  getRolePermissions(role: UserRole): Permission[] {
    return this.rolePermissions[role] || [];
  }

  hasPermission(userPermissions: Permission[], requiredPermission: Permission): boolean {
    return userPermissions.includes(requiredPermission);
  }

  hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
    // Admin has access to everything
    if (userRole === UserRole.ADMIN) {
      return true;
    }
    
    return userRole === requiredRole;
  }

  hasAnyPermission(userPermissions: Permission[], requiredPermissions: Permission[]): boolean {
    return requiredPermissions.some(permission => 
      this.hasPermission(userPermissions, permission)
    );
  }

  requirePermission(userPermissions: Permission[], requiredPermission: Permission): void {
    if (!this.hasPermission(userPermissions, requiredPermission)) {
      throw new ForbiddenError(`Missing required permission: ${requiredPermission}`);
    }
  }

  requireRole(userRole: UserRole, requiredRole: UserRole): void {
    if (!this.hasRole(userRole, requiredRole)) {
      throw new ForbiddenError(`Missing required role: ${requiredRole}`);
    }
  }

  requireAnyPermission(userPermissions: Permission[], requiredPermissions: Permission[]): void {
    if (!this.hasAnyPermission(userPermissions, requiredPermissions)) {
      throw new ForbiddenError(`Missing any of required permissions: ${requiredPermissions.join(', ')}`);
    }
  }

  createAuthUser(userData: {
    id: string;
    email: string;
    role: UserRole;
  }): AuthUser {
    return {
      ...userData,
      permissions: this.getRolePermissions(userData.role)
    };
  }

  refreshToken(token: string): string {
    const payload = this.verifyToken(token);
    
    // Create new token without the old timestamps
    const newUser: AuthUser = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions
    };

    return this.generateToken(newUser);
  }
}