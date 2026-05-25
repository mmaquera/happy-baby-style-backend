import { AuthService, AuthUser, Permission, UserRole } from '@application/auth/AuthService';
import { UnauthorizedError, ForbiddenError } from '@domain/errors/DomainError';
import { Context } from '../../graphql/server';

export class AuthMiddleware {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  async authenticateUser(context: Context): Promise<AuthUser | null> {
    try {
      const authHeader = context.req?.headers.authorization;
      
      if (!authHeader) {
        return null; // No authentication attempted
      }

      const token = this.authService.extractTokenFromHeader(authHeader);
      const payload = this.authService.verifyToken(token);

      return {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        permissions: payload.permissions
      };
    } catch (error) {
      // Authentication failed, but we don't throw here
      // Let individual resolvers decide if auth is required
      console.error('Authentication failed:', error);
      return null;
    }
  }

  requireAuthentication(user: AuthUser | null): AuthUser {
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }
    return user;
  }

  requirePermission(user: AuthUser | null, permission: Permission): AuthUser {
    const authenticatedUser = this.requireAuthentication(user);
    this.authService.requirePermission(authenticatedUser.permissions, permission);
    return authenticatedUser;
  }

  requireRole(user: AuthUser | null, role: UserRole): AuthUser {
    const authenticatedUser = this.requireAuthentication(user);
    this.authService.requireRole(authenticatedUser.role, role);
    return authenticatedUser;
  }

  requireAnyPermission(user: AuthUser | null, permissions: Permission[]): AuthUser {
    const authenticatedUser = this.requireAuthentication(user);
    this.authService.requireAnyPermission(authenticatedUser.permissions, permissions);
    return authenticatedUser;
  }

  // Higher-order function to wrap resolvers with authentication
  withAuth<TArgs = any, TResult = any>(
    resolver: (parent: any, args: TArgs, context: Context, info: any) => TResult,
    options?: {
      permission?: Permission;
      permissions?: Permission[];
      role?: UserRole;
      requireAuth?: boolean;
    }
  ) {
    return async (parent: any, args: TArgs, context: Context, info: any): Promise<TResult> => {
      const { permission, permissions, role, requireAuth = true } = options || {};

      // Skip auth if not required and no specific permissions/roles needed
      if (!requireAuth && !permission && !permissions && !role) {
        return resolver(parent, args, context, info);
      }

      let user = context.user;

      // Require basic authentication
      if (requireAuth || permission || permissions || role) {
        user = this.requireAuthentication(user || null);
      }

      // Check specific permission
      if (permission && user) {
        this.requirePermission(user, permission);
      }

      // Check any of multiple permissions
      if (permissions && permissions.length > 0 && user) {
        this.requireAnyPermission(user, permissions);
      }

      // Check specific role
      if (role && user) {
        this.requireRole(user, role);
      }

      return resolver(parent, args, context, info);
    };
  }

  // Wrapper for admin-only operations
  withAdminAuth<TArgs = any, TResult = any>(
    resolver: (parent: any, args: TArgs, context: Context, info: any) => TResult
  ) {
    return this.withAuth(resolver, { role: UserRole.ADMIN });
  }

  // Wrapper for staff+ operations (staff or admin)
  withStaffAuth<TArgs = any, TResult = any>(
    resolver: (parent: any, args: TArgs, context: Context, info: any) => TResult
  ) {
    return this.withAuth(resolver, { 
      permissions: [Permission.MANAGE_USERS, Permission.UPDATE_PRODUCT] 
    });
  }

  // Check if user owns resource or has admin/staff privileges
  requireOwnershipOrStaff(user: AuthUser, resourceUserId: string): void {
    const isOwner = user.id === resourceUserId;
    const hasStaffPrivileges = this.authService.hasAnyPermission(
      user.permissions, 
      [Permission.MANAGE_USERS, Permission.READ_USER]
    );

    if (!isOwner && !hasStaffPrivileges) {
      throw new ForbiddenError('Access denied: insufficient privileges');
    }
  }

  // Create context with authenticated user
  async createAuthContext(req: any): Promise<{ user: AuthUser | null; isAuthenticated: boolean }> {
    const user = await this.authenticateUser({ req } as Context);
    
    return {
      user,
      isAuthenticated: !!user
    };
  }
}