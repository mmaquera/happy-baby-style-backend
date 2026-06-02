import { GraphQLScalarType, GraphQLError, Kind } from 'graphql';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ResponseFactory, RESPONSE_CODES } from '@hbs/shared-kernel';
import { CreateUserUseCase } from '@application/use-cases/user/CreateUserUseCase';
import { GetUsersUseCase } from '@application/use-cases/user/GetUsersUseCase';
import { GetUserByIdUseCase } from '@application/use-cases/user/GetUserByIdUseCase';
import { UpdateUserUseCase } from '@application/use-cases/user/UpdateUserUseCase';
import { GetUserStatsUseCase } from '@application/use-cases/user/GetUserStatsUseCase';
import { AuthenticateUserUseCase } from '@application/use-cases/user/AuthenticateUserUseCase';
import { UpdateUserPasswordUseCase } from '@application/use-cases/user/UpdateUserPasswordUseCase';
import { SetUserPasswordUseCase } from '@application/use-cases/user/SetUserPasswordUseCase';
import { LogoutUserUseCase } from '@application/use-cases/user/LogoutUserUseCase';
import { RefreshTokenUseCase } from '@application/use-cases/user/RefreshTokenUseCase';
import { CreateUserAddressUseCase } from '@application/use-cases/user/CreateUserAddressUseCase';
import { UpdateUserAddressUseCase } from '@application/use-cases/user/UpdateUserAddressUseCase';
import { DeleteUserAddressUseCase } from '@application/use-cases/user/DeleteUserAddressUseCase';
import { GetUserAddressByIdUseCase } from '@application/use-cases/user/GetUserAddressByIdUseCase';
import { SetDefaultAddressUseCase } from '@application/use-cases/user/SetDefaultAddressUseCase';
import { GetUserOrderHistoryUseCase } from '@application/use-cases/user/GetUserOrderHistoryUseCase';
import { CreateUserSessionAnalyticsUseCase } from '@application/use-cases/user/CreateUserSessionAnalyticsUseCase';
import { UpdateUserSessionAnalyticsUseCase } from '@application/use-cases/user/UpdateUserSessionAnalyticsUseCase';
import { GetUserSessionAnalyticsUseCase } from '@application/use-cases/user/GetUserSessionAnalyticsUseCase';
import { RevokeUserSessionUseCase } from '@application/use-cases/user/RevokeUserSessionUseCase';
import { RevokeAllUserSessionsUseCase } from '@application/use-cases/user/RevokeAllUserSessionsUseCase';
import { ManageUserFavoritesUseCase } from '@application/use-cases/user/ManageUserFavoritesUseCase';
import { UnlockUserAccountUseCase } from '@application/use-cases/user/UnlockUserAccountUseCase';
import { RequestEmailVerificationUseCase } from '@application/use-cases/user/RequestEmailVerificationUseCase';
import { VerifyEmailUseCase } from '@application/use-cases/user/VerifyEmailUseCase';
import { ResendVerificationEmailUseCase } from '@application/use-cases/user/ResendVerificationEmailUseCase';
import { EnableMfaUseCase } from '@application/use-cases/user/EnableMfaUseCase';
import { VerifyMfaSetupUseCase } from '@application/use-cases/user/VerifyMfaSetupUseCase';
import { DisableMfaUseCase } from '@application/use-cases/user/DisableMfaUseCase';
import { VerifyTotpUseCase } from '@application/use-cases/user/VerifyTotpUseCase';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { IAuditRepository } from '@domain/repositories/IAuditRepository';
import { ISecurityEventRepository } from '@domain/repositories/ISecurityEventRepository';
import { assertOwnerOrAdmin, type TokenPayload } from '@hbs/auth';
// RBAC admin use cases
import { CreateGroupUseCase } from '@application/use-cases/authz/CreateGroupUseCase';
import { UpdateGroupUseCase } from '@application/use-cases/authz/UpdateGroupUseCase';
import { DeleteGroupUseCase } from '@application/use-cases/authz/DeleteGroupUseCase';
import { ListGroupsUseCase } from '@application/use-cases/authz/ListGroupsUseCase';
import { CreatePermissionUseCase } from '@application/use-cases/authz/CreatePermissionUseCase';
import { UpdatePermissionUseCase } from '@application/use-cases/authz/UpdatePermissionUseCase';
import { DeletePermissionUseCase } from '@application/use-cases/authz/DeletePermissionUseCase';
import { ListPermissionsUseCase } from '@application/use-cases/authz/ListPermissionsUseCase';
import { AssignUserToGroupUseCase } from '@application/use-cases/authz/AssignUserToGroupUseCase';
import { RemoveUserFromGroupUseCase } from '@application/use-cases/authz/RemoveUserFromGroupUseCase';
import { ListUserGroupsUseCase } from '@application/use-cases/authz/ListUserGroupsUseCase';
import { AssignPermissionToGroupUseCase } from '@application/use-cases/authz/AssignPermissionToGroupUseCase';
import { RevokePermissionFromGroupUseCase } from '@application/use-cases/authz/RevokePermissionFromGroupUseCase';
import { ListGroupPermissionsUseCase } from '@application/use-cases/authz/ListGroupPermissionsUseCase';
import { AddGroupImplicationUseCase } from '@application/use-cases/authz/AddGroupImplicationUseCase';
import { RemoveGroupImplicationUseCase } from '@application/use-cases/authz/RemoveGroupImplicationUseCase';
import { CreateRecordRuleUseCase } from '@application/use-cases/authz/CreateRecordRuleUseCase';
import { UpdateRecordRuleUseCase } from '@application/use-cases/authz/UpdateRecordRuleUseCase';
import { DeleteRecordRuleUseCase } from '@application/use-cases/authz/DeleteRecordRuleUseCase';
import { ListRecordRulesUseCase } from '@application/use-cases/authz/ListRecordRulesUseCase';
import { assertModelAccess, isAdmin } from '@hbs/authz';

// ── requireAdministrator guard ──────────────────────────────────────────────
// Requires the caller to belong to the 'administrators' group (RBAC-only).
function requireAdministrator(currentUser: TokenPayload | null | undefined): void {
  if (!currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  const inAdministratorsGroup = currentUser.groups?.includes('administrators') ?? false;
  if (!inAdministratorsGroup) {
    throw new GraphQLError('Insufficient privileges — administrators group required', {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }
}

// ── requireUserManagementAccess guard ───────────────────────────────────────
// For administrative list/read queries (users, searchUsers, activeUsers, etc.).
// Accepts any group that has read:user permission OR legacy STAFF/ADMIN role.
const USER_MANAGEMENT_GROUPS = [
  'administrators',
  'customer-service',
] as const;

function requireUserManagementAccess(currentUser: TokenPayload | null | undefined): void {
  if (!currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  if (currentUser.groups?.some((g) => (USER_MANAGEMENT_GROUPS as readonly string[]).includes(g))) {
    return;
  }
  throw new GraphQLError('Insufficient privileges', {
    extensions: { code: 'FORBIDDEN', http: { status: 403 } },
  });
}

// ── Scalars ─────────────────────────────────────────────────────────────────

const dateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  serialize: (value: any) => (value instanceof Date ? value.toISOString() : value),
  parseValue: (value: any) => new Date(value as string),
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? new Date(ast.value) : null),
});

const decimalScalar = new GraphQLScalarType({
  name: 'Decimal',
  serialize: (value: any) => Number(value),
  parseValue: (value: any) => Number(value),
  parseLiteral: (ast) =>
    ast.kind === Kind.FLOAT || ast.kind === Kind.INT ? Number(ast.value) : null,
});

const jsonScalar = new GraphQLScalarType({
  name: 'JSON',
  serialize: (value: any) => value,
  parseValue: (value: any) => value,
  parseLiteral: (ast: any) => {
    if (ast.kind === Kind.STRING) return JSON.parse(ast.value);
    return ast.value ?? null;
  },
});

// ── Transform helpers ────────────────────────────────────────────────────────

const transformUserAddress = (addr: any) => ({
  id: addr.id,
  userId: addr.userId || addr.user_id,
  type: addr.type || addr.title || 'home',
  firstName: addr.firstName || addr.first_name,
  lastName: addr.lastName || addr.last_name,
  company: addr.company || null,
  address1: addr.address1 || addr.addressLine1 || addr.address_line1,
  address2: addr.address2 || addr.addressLine2 || addr.address_line2 || null,
  city: addr.city,
  state: addr.state,
  postalCode: addr.postalCode || addr.postal_code,
  country: addr.country || 'CO',
  phone: addr.phone || null,
  isDefault:
    addr.isDefault !== undefined
      ? addr.isDefault
      : addr.is_default !== undefined
        ? addr.is_default
        : false,
  createdAt: addr.createdAt || addr.created_at,
  updatedAt: addr.updatedAt || addr.updated_at,
  fullName:
    `${addr.firstName || addr.first_name || ''} ${addr.lastName || addr.last_name || ''}`.trim(),
  fullAddress: [
    addr.address1 || addr.addressLine1,
    addr.city,
    addr.state,
    addr.postalCode || addr.postal_code,
  ]
    .filter(Boolean)
    .join(', '),
  user: { __typename: 'UserProfile', id: addr.userId || addr.user_id },
});

const transformUserProfile = (profile: any) => ({
  id: profile.id,
  email: profile.email,
  firstName: profile.firstName || profile.first_name,
  lastName: profile.lastName || profile.last_name,
  phone: profile.phone || null,
  dateOfBirth: profile.dateOfBirth || profile.date_of_birth || null,
  avatar: profile.avatar || null,
  emailVerified:
    profile.emailVerified !== undefined
      ? profile.emailVerified
      : profile.email_verified !== undefined
        ? profile.email_verified
        : false,
  isActive:
    profile.isActive !== undefined
      ? profile.isActive
      : profile.is_active !== undefined
        ? profile.is_active
        : true,
  lastLoginAt: profile.lastLoginAt || profile.last_login_at || null,
  createdAt: profile.createdAt || profile.created_at,
  updatedAt: profile.updatedAt || profile.updated_at,
  fullName:
    `${profile.firstName || profile.first_name || ''} ${profile.lastName || profile.last_name || ''}`.trim(),
  addresses: profile.addresses?.map(transformUserAddress) || [],
});

const transformUser = (user: any) => ({
  id: user.id,
  email: user.email,
  isActive:
    user.isActive !== undefined
      ? user.isActive
      : user.is_active !== undefined
        ? user.is_active
        : true,
  emailVerified:
    user.emailVerified !== undefined
      ? user.emailVerified
      : user.email_verified !== undefined
        ? user.email_verified
        : false,
  lastLoginAt: user.lastLoginAt || user.last_login_at || null,
  createdAt: user.createdAt || user.created_at,
  updatedAt: user.updatedAt || user.updated_at,
  profile: user.profile ? transformUserProfile(user.profile) : null,
  addresses: user.addresses?.map(transformUserAddress) || [],
  accounts: [],
  sessions: [],
  sessionsAnalytics: [],
});

// ── Container interface ──────────────────────────────────────────────────────

export interface UserServiceDeps {
  prisma: PrismaClient;
  userRepository: IUserRepository;
  authRepository: IAuthRepository;
  auditRepository: IAuditRepository;
  securityEventRepository: ISecurityEventRepository;
  createUserUseCase: CreateUserUseCase;
  getUsersUseCase: GetUsersUseCase;
  getUserByIdUseCase: GetUserByIdUseCase;
  updateUserUseCase: UpdateUserUseCase;
  getUserStatsUseCase: GetUserStatsUseCase;
  authenticateUserUseCase: AuthenticateUserUseCase;
  updateUserPasswordUseCase: UpdateUserPasswordUseCase;
  setUserPasswordUseCase: SetUserPasswordUseCase;
  logoutUserUseCase: LogoutUserUseCase;
  refreshTokenUseCase: RefreshTokenUseCase;
  createUserAddressUseCase: CreateUserAddressUseCase;
  updateUserAddressUseCase: UpdateUserAddressUseCase;
  deleteUserAddressUseCase: DeleteUserAddressUseCase;
  getUserAddressByIdUseCase: GetUserAddressByIdUseCase;
  setDefaultAddressUseCase: SetDefaultAddressUseCase;
  getUserOrderHistoryUseCase: GetUserOrderHistoryUseCase;
  createUserSessionAnalyticsUseCase: CreateUserSessionAnalyticsUseCase;
  updateUserSessionAnalyticsUseCase: UpdateUserSessionAnalyticsUseCase;
  getUserSessionAnalyticsUseCase: GetUserSessionAnalyticsUseCase;
  revokeUserSessionUseCase: RevokeUserSessionUseCase;
  revokeAllUserSessionsUseCase: RevokeAllUserSessionsUseCase;
  manageUserFavoritesUseCase: ManageUserFavoritesUseCase;
  // RBAC admin use cases (Fase 5.10)
  createGroupUseCase: CreateGroupUseCase;
  updateGroupUseCase: UpdateGroupUseCase;
  deleteGroupUseCase: DeleteGroupUseCase;
  listGroupsUseCase: ListGroupsUseCase;
  createPermissionUseCase: CreatePermissionUseCase;
  updatePermissionUseCase: UpdatePermissionUseCase;
  deletePermissionUseCase: DeletePermissionUseCase;
  listPermissionsUseCase: ListPermissionsUseCase;
  assignUserToGroupUseCase: AssignUserToGroupUseCase;
  removeUserFromGroupUseCase: RemoveUserFromGroupUseCase;
  listUserGroupsUseCase: ListUserGroupsUseCase;
  assignPermissionToGroupUseCase: AssignPermissionToGroupUseCase;
  revokePermissionFromGroupUseCase: RevokePermissionFromGroupUseCase;
  listGroupPermissionsUseCase: ListGroupPermissionsUseCase;
  addGroupImplicationUseCase: AddGroupImplicationUseCase;
  removeGroupImplicationUseCase: RemoveGroupImplicationUseCase;
  createRecordRuleUseCase: CreateRecordRuleUseCase;
  updateRecordRuleUseCase: UpdateRecordRuleUseCase;
  deleteRecordRuleUseCase: DeleteRecordRuleUseCase;
  listRecordRulesUseCase: ListRecordRulesUseCase;
  unlockUserAccountUseCase: UnlockUserAccountUseCase;
  // Email verification use cases (WS2)
  requestEmailVerificationUseCase: RequestEmailVerificationUseCase;
  verifyEmailUseCase: VerifyEmailUseCase;
  resendVerificationEmailUseCase: ResendVerificationEmailUseCase;
  // MFA use cases (WS3)
  enableMfaUseCase: EnableMfaUseCase;
  verifyMfaSetupUseCase: VerifyMfaSetupUseCase;
  disableMfaUseCase: DisableMfaUseCase;
  verifyTotpUseCase: VerifyTotpUseCase;
}

// ── Resolver factory ─────────────────────────────────────────────────────────

export function createResolvers(deps: UserServiceDeps) {
  const {
    prisma,
    authRepository,
    auditRepository,
    securityEventRepository,
    createUserUseCase,
    getUsersUseCase,
    getUserByIdUseCase,
    updateUserUseCase,
    getUserStatsUseCase,
    authenticateUserUseCase,
    updateUserPasswordUseCase,
    setUserPasswordUseCase,
    logoutUserUseCase,
    refreshTokenUseCase,
    createUserAddressUseCase,
    updateUserAddressUseCase,
    deleteUserAddressUseCase,
    getUserAddressByIdUseCase,
    setDefaultAddressUseCase,
    getUserOrderHistoryUseCase,
    createUserSessionAnalyticsUseCase,
    updateUserSessionAnalyticsUseCase,
    getUserSessionAnalyticsUseCase,
    revokeUserSessionUseCase,
    revokeAllUserSessionsUseCase,
    manageUserFavoritesUseCase,
    // RBAC admin use cases
    createGroupUseCase,
    updateGroupUseCase,
    deleteGroupUseCase,
    listGroupsUseCase,
    createPermissionUseCase,
    updatePermissionUseCase,
    deletePermissionUseCase,
    listPermissionsUseCase,
    assignUserToGroupUseCase,
    removeUserFromGroupUseCase,
    listUserGroupsUseCase,
    assignPermissionToGroupUseCase,
    revokePermissionFromGroupUseCase,
    listGroupPermissionsUseCase,
    addGroupImplicationUseCase,
    removeGroupImplicationUseCase,
    createRecordRuleUseCase,
    updateRecordRuleUseCase,
    deleteRecordRuleUseCase,
    listRecordRulesUseCase,
    unlockUserAccountUseCase,
    requestEmailVerificationUseCase,
    verifyEmailUseCase,
    resendVerificationEmailUseCase,
    enableMfaUseCase,
    verifyMfaSetupUseCase,
    disableMfaUseCase,
    verifyTotpUseCase,
  } = deps;

  return {
    DateTime: dateTimeScalar,
    Decimal: decimalScalar,
    JSON: jsonScalar,

    // ── Federation reference resolvers ─────────────────────────────────────

    User: {
      __resolveReference: async (ref: { id: string }) => {
        const user = await getUserByIdUseCase.execute(ref.id);
        return user ? transformUser(user) : null;
      },
    },

    UserProfile: {
      __resolveReference: async (ref: { id: string }) => {
        const user = await getUserByIdUseCase.execute(ref.id);
        return user?.profile ? transformUserProfile(user.profile) : null;
      },
    },

    UserAddress: {
      __resolveReference: async (ref: { id: string }) => {
        const address = await deps.userRepository.getUserAddressById(ref.id);
        return address ? transformUserAddress(address) : null;
      },
    },

    // ── Queries ────────────────────────────────────────────────────────────

    Query: {
      health: () => 'user-service running',

      users: async (_: any, { filter, pagination }: any, context: any) => {
        requireUserManagementAccess(context.currentUser);
        const startTime = Date.now();
        const traceId = `users-${Date.now()}`;
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        try {
          const limit = pagination?.limit || 10;
          const offset = pagination?.offset || 0;
          const users = await getUsersUseCase.execute({
            limit,
            offset,
            isActive: filter?.isActive,
            search: filter?.search,
          });
          const duration = Date.now() - startTime;
          const currentPage = Math.floor(offset / limit) + 1;
          return ResponseFactory.createSuccessResponse(
            {
              items: users.map(transformUser),
              pagination: {
                total: users.length,
                limit,
                offset,
                hasMore: users.length === limit,
                currentPage,
                totalPages: currentPage,
              },
            },
            'Users retrieved successfully',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration },
          );
        } catch (error: any) {
          const duration = Date.now() - startTime;
          return ResponseFactory.createErrorResponse(
            'Failed to fetch users',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration },
          );
        }
      },

      user: async (_: any, { id }: { id: string }) => {
        const user = await getUserByIdUseCase.execute(id);
        return user ? transformUser(user) : null;
      },

      userProfile: async (_: any, { userId }: { userId: string }) => {
        const user = await getUserByIdUseCase.execute(userId);
        return user?.profile ? transformUserProfile(user.profile) : null;
      },

      currentUser: async (_: any, __: any, context: any) => {
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `current-user-${Date.now()}`;
        if (!context.currentUser) {
          return ResponseFactory.createErrorResponse(
            'Authentication required',
            RESPONSE_CODES.AUTHENTICATION_FAILED,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
        try {
          const user = await getUserByIdUseCase.execute(context.currentUser.userId);
          if (!user) {
            return ResponseFactory.createErrorResponse(
              'User not found',
              RESPONSE_CODES.RESOURCE_NOT_FOUND,
              {},
              { requestId, traceId, duration: 0 },
            );
          }
          return ResponseFactory.createSuccessResponse(
            transformUser(user),
            'Current user retrieved',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Failed to get current user',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      searchUsers: async (_: any, { query }: { query: string }, context: any) => {
        requireUserManagementAccess(context.currentUser);
        try {
          const users = await deps.userRepository.searchUsers(query);
          return users.map(transformUser);
        } catch {
          return [];
        }
      },

      activeUsers: async (_: any, __: any, context: any) => {
        requireUserManagementAccess(context.currentUser);
        try {
          const users = await deps.userRepository.getActiveUsers();
          return users.map(transformUser);
        } catch {
          return [];
        }
      },

      usersByProvider: async (_: any, { provider }: { provider: string }, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `users-by-provider-${Date.now()}`;
        try {
          const accounts = await authRepository.findUserAccountByProvider(provider as any, '');
          return ResponseFactory.createSuccessResponse(
            [],
            'Users by provider retrieved',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Operation failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      userStats: async (_: any, __: any, context: any) => {
        requireUserManagementAccess(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `user-stats-${Date.now()}`;
        const startTime = Date.now();
        try {
          const stats = await getUserStatsUseCase.execute();
          const duration = Date.now() - startTime;
          return ResponseFactory.createSuccessResponse(
            {
              totalUsers: stats.totalUsers,
              activeUsers: stats.activeUsers,
              newUsersThisMonth: stats.newUsersThisMonth,
            },
            'User stats retrieved',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Operation failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      userAnalytics: async (_: any, __: any, context: any) => {
        requireUserManagementAccess(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `user-analytics-${Date.now()}`;
        try {
          const stats = await getUserStatsUseCase.execute();
          return {
            totalUsers: stats.totalUsers,
            activeUsers: stats.activeUsers,
            newUsersThisMonth: stats.newUsersThisMonth,
            topSpenders: [],
            userEngagement: {},
          };
        } catch (error: any) {
          return {
            totalUsers: 0,
            activeUsers: 0,
            newUsersThisMonth: 0,
            topSpenders: [],
            userEngagement: {},
          };
        }
      },

      userAddresses: async (_: any, { userId }: { userId: string }, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `user-addresses-${Date.now()}`;
        try {
          const user = await getUserByIdUseCase.execute(userId);
          const addresses = user?.addresses?.map(transformUserAddress) || [];
          return ResponseFactory.createSuccessResponse(
            { items: addresses },
            'Addresses retrieved',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Operation failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      userAddress: async (_: any, { id }: { id: string }, context: any) => {
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `user-address-${Date.now()}`;
        try {
          const address = await getUserAddressByIdUseCase.execute(id);
          if (!address) {
            return ResponseFactory.createErrorResponse(
              'Address not found',
              RESPONSE_CODES.RESOURCE_NOT_FOUND,
              {},
              { requestId, traceId, duration: 0 },
            );
          }
          return ResponseFactory.createSuccessResponse(
            { entity: transformUserAddress(address) },
            'Address retrieved',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Operation failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      userAccounts: async (_: any, { userId }: { userId: string }, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        try {
          return await authRepository.findUserAccountsByUserId(userId);
        } catch {
          return [];
        }
      },

      userSessions: async (_: any, { userId }: { userId: string }, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        try {
          return await authRepository.findSessionsByUserId(userId);
        } catch {
          return [];
        }
      },

      activeSessions: async (_: any, { userId }: { userId: string }, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        try {
          const sessions = await authRepository.findSessionsByUserId(userId);
          return sessions.filter((s: any) => s.isActive && new Date(s.expiresAt) > new Date());
        } catch {
          return [];
        }
      },

      userSessionAnalytics: async (_: any, { userId }: { userId: string }, context: any) => {
        // NF-4: owner can access their own analytics; management roles (administrators,
        // customer-service) can access any user's analytics. Anonymous → UNAUTHENTICATED.
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }
        if (context.currentUser.userId !== userId) {
          requireUserManagementAccess(context.currentUser);
        }
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `session-analytics-${Date.now()}`;
        try {
          const result = await getUserSessionAnalyticsUseCase.execute({ userId });
          return result || [];
        } catch {
          return [];
        }
      },

      userOrderHistory: async (_: any, { userId, filter, pagination }: any, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        try {
          const result = await getUserOrderHistoryUseCase.execute({
            userId,
            limit: pagination?.limit || 20,
            offset: pagination?.offset || 0,
          });
          return {
            orders: (result.orders || []).map((o: any) => ({ __typename: 'Order', id: o.id })),
            total: result.total || 0,
            hasMore: result.hasMore || false,
            stats: {
              totalOrders: result.stats?.totalOrders || 0,
              totalSpent: result.stats?.totalSpent || 0,
              averageOrderValue: result.stats?.averageOrderValue || 0,
              lastOrderDate: result.stats?.lastOrderDate || null,
              ordersByStatus: {},
            },
          };
        } catch {
          return {
            orders: [],
            total: 0,
            hasMore: false,
            stats: {
              totalOrders: 0,
              totalSpent: 0,
              averageOrderValue: 0,
              lastOrderDate: null,
              ordersByStatus: {},
            },
          };
        }
      },

      userFavoriteStats: async (_: any, { userId }: { userId: string }) => {
        try {
          const stats = await manageUserFavoritesUseCase.getFavoriteStats(userId);
          const recent = await manageUserFavoritesUseCase.getUserFavorites(userId);
          return {
            totalFavorites: stats.totalFavorites,
            recentFavorites: recent.slice(0, 5).map((f) => ({
              ...f,
              user: { __typename: 'UserProfile', id: f.userId },
              product: { __typename: 'Product', id: f.productId },
            })),
            favoriteCategories: [],
          };
        } catch {
          return { totalFavorites: 0, recentFavorites: [], favoriteCategories: [] };
        }
      },

      userActivitySummary: async (_: any, { userId }: { userId: string }) => {
        return {
          recentOrders: [],
          favoriteProducts: [],
          cartItemsCount: 0,
          totalSpent: 0,
          joinDate: new Date(),
          lastActivity: new Date(),
        };
      },

      userAuditLogs: async (_: any, { userId }: { userId: string }, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `audit-logs-${Date.now()}`;
        try {
          const logs = await auditRepository.findByUserId(userId);
          return ResponseFactory.createSuccessResponse(
            { items: logs },
            'Audit logs retrieved',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Operation failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      userSecurityEvents: async (_: any, { userId }: { userId: string }, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `security-events-${Date.now()}`;
        try {
          const events = await securityEventRepository.findByUserId(userId);
          return ResponseFactory.createSuccessResponse(
            { items: events },
            'Security events retrieved',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Operation failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      // ── Favorites queries ────────────────────────────────────────────────

      userFavorites: async (_: any, { userId }: { userId: string }, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        try {
          const favs = await manageUserFavoritesUseCase.getUserFavorites(userId);
          return favs.map((f) => ({
            ...f,
            user: { __typename: 'UserProfile', id: f.userId },
            product: { __typename: 'Product', id: f.productId },
          }));
        } catch {
          return [];
        }
      },

      isProductFavorited: async (_: any, { userId, productId }: any, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        try {
          return await deps.prisma.userFavorite
            .count({ where: { userId, productId } })
            .then((c) => c > 0);
        } catch {
          return false;
        }
      },

      // ── Saved payment methods queries ────────────────────────────────────

      savedPaymentMethods: async (_: any, { userId }: { userId: string }, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        try {
          const methods = await prisma.savedPaymentMethod.findMany({
            where: { userId, isActive: true },
            orderBy: { createdAt: 'desc' },
          });
          return methods.map((m) => ({
            ...m,
            user: { __typename: 'UserProfile', id: m.userId },
          }));
        } catch {
          return [];
        }
      },

      // ── Loyalty & rewards queries ────────────────────────────────────────

      loyaltyPrograms: async () => {
        try {
          return await prisma.loyaltyProgram.findMany({ where: { isActive: true } });
        } catch {
          return [];
        }
      },

      userRewardPoints: async (_: any, { userId }: { userId: string }, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        try {
          const points = await prisma.rewardPoint.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
          });
          return points.map((p) => ({
            ...p,
            user: { __typename: 'UserProfile', id: p.userId },
          }));
        } catch {
          return [];
        }
      },

      userRewardBalance: async (_: any, { userId }: { userId: string }, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        try {
          const result = await prisma.rewardPoint.groupBy({
            by: ['type'],
            where: { userId },
            _sum: { points: true },
          });
          let balance = 0;
          for (const r of result) {
            if (r.type === 'earned' || r.type === 'bonus') balance += r._sum.points ?? 0;
            else if (r.type === 'redeemed' || r.type === 'expired') balance -= r._sum.points ?? 0;
          }
          return Math.max(0, balance);
        } catch {
          return 0;
        }
      },

      // ── Notification queries ─────────────────────────────────────────────

      userNotifications: async (_: any, { userId }: { userId: string }, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        try {
          const notifs = await prisma.pushNotification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
          });
          return notifs.map((n) => ({
            ...n,
            user: { __typename: 'UserProfile', id: n.userId },
          }));
        } catch {
          return [];
        }
      },

      unreadNotifications: async (_: any, { userId }: { userId: string }, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        try {
          const notifs = await prisma.pushNotification.findMany({
            where: { userId, isRead: false },
            orderBy: { createdAt: 'desc' },
          });
          return notifs.map((n) => ({
            ...n,
            user: { __typename: 'UserProfile', id: n.userId },
          }));
        } catch {
          return [];
        }
      },

      notificationTemplates: async () => {
        try {
          const templates = await prisma.notificationTemplate.findMany({
            where: { isActive: true },
          });
          return templates.map((t) => ({ ...t, variables: t.variables as string[] }));
        } catch {
          return [];
        }
      },

      emailTemplates: async () => {
        try {
          const templates = await prisma.emailTemplate.findMany({ where: { isActive: true } });
          return templates.map((t) => ({ ...t, variables: t.variables as string[] }));
        } catch {
          return [];
        }
      },

      // ── Newsletter queries ───────────────────────────────────────────────

      newsletterSubscriptions: async () => {
        try {
          const subs = await prisma.newsletterSubscription.findMany({ where: { isActive: true } });
          return subs.map((s) => ({
            ...s,
            user: s.userId ? { __typename: 'UserProfile', id: s.userId } : null,
          }));
        } catch {
          return [];
        }
      },

      isSubscribedToNewsletter: async (_: any, { email }: { email: string }) => {
        try {
          const count = await prisma.newsletterSubscription.count({
            where: { email, isActive: true },
          });
          return count > 0;
        } catch {
          return false;
        }
      },

      // ── App events queries ───────────────────────────────────────────────

      userAppEvents: async (_: any, { userId }: { userId: string }, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        try {
          const events = await prisma.appEvent.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 100,
          });
          return events.map((e) => ({
            ...e,
            user: e.userId ? { __typename: 'UserProfile', id: e.userId } : null,
          }));
        } catch {
          return [];
        }
      },

      productAppEvents: async (_: any, { productId }: { productId: string }) => {
        try {
          const events = await prisma.appEvent.findMany({
            where: { productId },
            orderBy: { createdAt: 'desc' },
            take: 100,
          });
          return events.map((e) => ({
            ...e,
            user: e.userId ? { __typename: 'UserProfile', id: e.userId } : null,
          }));
        } catch {
          return [];
        }
      },

      // ── RBAC admin queries ───────────────────────────────────────────────

      groups: async (_: any, { pagination }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `list-groups-${Date.now()}`;
        const result = await listGroupsUseCase.execute({
          limit: pagination?.limit ?? 50,
          offset: pagination?.offset ?? 0,
        });
        return ResponseFactory.createSuccessResponse(
          {
            items: result.items,
            total: result.total,
            limit: pagination?.limit ?? 50,
            offset: pagination?.offset ?? 0,
          },
          'Groups retrieved successfully',
          RESPONSE_CODES.SUCCESS,
          { requestId, traceId, duration: 0 },
        );
      },

      permissions: async (_: any, { pagination }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `list-permissions-${Date.now()}`;
        const result = await listPermissionsUseCase.execute({
          limit: pagination?.limit ?? 50,
          offset: pagination?.offset ?? 0,
        });
        return ResponseFactory.createSuccessResponse(
          {
            items: result.items,
            total: result.total,
            limit: pagination?.limit ?? 50,
            offset: pagination?.offset ?? 0,
          },
          'Permissions retrieved successfully',
          RESPONSE_CODES.SUCCESS,
          { requestId, traceId, duration: 0 },
        );
      },

      recordRules: async (_: any, { modelName, pagination }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `list-record-rules-${Date.now()}`;
        const result = await listRecordRulesUseCase.execute(
          { modelName: modelName ?? undefined },
          {
            limit: pagination?.limit ?? 50,
            offset: pagination?.offset ?? 0,
          },
        );
        return ResponseFactory.createSuccessResponse(
          {
            items: result.items,
            total: result.total,
            limit: pagination?.limit ?? 50,
            offset: pagination?.offset ?? 0,
          },
          'Record rules retrieved successfully',
          RESPONSE_CODES.SUCCESS,
          { requestId, traceId, duration: 0 },
        );
      },

      userGroups: async (_: any, { userId }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `list-user-groups-${Date.now()}`;
        const memberships = await listUserGroupsUseCase.execute(userId);
        return ResponseFactory.createSuccessResponse(
          {
            items: memberships.map((m) => ({
              userId: m.userId,
              groupId: m.groupId,
              group: null,
              grantedAt: m.grantedAt,
              grantedBy: m.grantedBy,
            })),
            total: memberships.length,
          },
          'User groups retrieved successfully',
          RESPONSE_CODES.SUCCESS,
          { requestId, traceId, duration: 0 },
        );
      },

      groupPermissions: async (_: any, { groupId }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `list-group-permissions-${Date.now()}`;
        const links = await listGroupPermissionsUseCase.execute(groupId);
        return ResponseFactory.createSuccessResponse(
          {
            items: links.map((l) => ({
              groupId: l.groupId,
              permissionId: l.permissionId,
              permission: null,
              group: null,
              createdAt: l.createdAt,
            })),
            total: links.length,
          },
          'Group permissions retrieved successfully',
          RESPONSE_CODES.SUCCESS,
          { requestId, traceId, duration: 0 },
        );
      },
    },

    // ── Mutations ──────────────────────────────────────────────────────────

    Mutation: {
      registerUser: async (_: any, { input }: any, context: any) => {
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `register-${Date.now()}`;
        const startTime = Date.now();
        try {
          await createUserUseCase.execute({
            email: input.email,
            password: input.password,
            profile: { firstName: input.firstName, lastName: input.lastName },
          });
          const result = await authenticateUserUseCase.execute({
            email: input.email,
            password: input.password,
            userAgent: context?.req?.headers?.['user-agent'],
            ipAddress: context?.req?.ip,
          });
          const duration = Date.now() - startTime;

          // Bug #3 fix: a newly-registered user could in theory have MFA enabled
          // (e.g. if authenticateUserUseCase is extended to handle that path).
          // Guard against result.mfaRequired before accessing result.user to avoid
          // a runtime crash on transformUser(undefined).
          if (result.mfaRequired) {
            return ResponseFactory.createSuccessResponse(
              {
                mfaRequired: true,
                mfaChallengeToken: result.mfaChallengeToken,
              },
              'MFA verification required',
              RESPONSE_CODES.SUCCESS,
              { requestId, traceId, duration },
            );
          }

          // Trigger email verification best-effort (non-blocking)
          try {
            await requestEmailVerificationUseCase.execute({ email: input.email });
          } catch (verifyErr) {
            // best-effort — never block registration
          }

          return ResponseFactory.createSuccessResponse(
            {
              user: transformUser(result.user!),
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
            },
            'User registered successfully',
            RESPONSE_CODES.CREATED,
            { requestId, traceId, duration },
          );
        } catch (error: any) {
          const duration = Date.now() - startTime;
          return ResponseFactory.createErrorResponse(
            'Registration failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration },
          );
        }
      },

      loginUser: async (_: any, { email, password }: any, context: any) => {
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `login-${Date.now()}`;
        const startTime = Date.now();
        try {
          const result = await authenticateUserUseCase.execute({
            email,
            password,
            userAgent: context?.req?.headers?.['user-agent'],
            ipAddress: context?.req?.ip,
          });
          const duration = Date.now() - startTime;

          // MFA step-up: return challenge token instead of final tokens
          if (result.mfaRequired) {
            return ResponseFactory.createSuccessResponse(
              {
                mfaRequired: true,
                mfaChallengeToken: result.mfaChallengeToken,
              },
              'MFA verification required',
              RESPONSE_CODES.SUCCESS,
              { requestId, traceId, duration },
            );
          }

          return ResponseFactory.createSuccessResponse(
            {
              user: transformUser(result.user!),
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
            },
            'Login successful',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration },
          );
        } catch (error: any) {
          const duration = Date.now() - startTime;
          return ResponseFactory.createErrorResponse(
            'Invalid email or password',
            RESPONSE_CODES.AUTHENTICATION_FAILED,
            {},
            { requestId, traceId, duration },
          );
        }
      },

      logoutUser: async (_: any, __: any, context: any) => {
        try {
          if (context.currentUser?.userId) {
            await logoutUserUseCase.execute(context.currentUser.userId);
          }
          return { success: true, message: 'Logged out successfully' };
        } catch {
          return { success: true, message: 'Logged out' };
        }
      },

      refreshToken: async (_: any, { refreshToken }: any, context: any) => {
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `refresh-token-${Date.now()}`;
        try {
          const result = await refreshTokenUseCase.execute({ refreshToken });
          return ResponseFactory.createSuccessResponse(
            {
              user: transformUser(result.user),
              accessToken: result.tokens.accessToken,
              refreshToken: result.tokens.refreshToken,
            },
            'Token refreshed',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Token refresh failed',
            RESPONSE_CODES.AUTHENTICATION_FAILED,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      createUser: async (_: any, { input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'User', 'create');
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `create-user-${Date.now()}`;
        const startTime = Date.now();
        try {
          const user = await createUserUseCase.execute({
            email: input.email,
            password: input.password,
            isActive: input.isActive !== undefined ? input.isActive : true,
            profile: {
              firstName: input.firstName,
              lastName: input.lastName,
              phone: input.phone,
              birthDate: input.dateOfBirth,
            },
          });
          const duration = Date.now() - startTime;
          const transformedUser = transformUser(user);
          return ResponseFactory.createSuccessResponse(
            {
              entity: transformedUser,
              id: user.id,
              createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
            },
            'User created successfully',
            RESPONSE_CODES.CREATED,
            { requestId, traceId, duration },
          );
        } catch (error: any) {
          const duration = Date.now() - startTime;
          return ResponseFactory.createErrorResponse(
            'Failed to create user',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration },
          );
        }
      },

      updateUser: async (_: any, { id, input }: any, context: any) => {
        assertModelAccess(context.currentUser, 'User', 'write');
        const user = await updateUserUseCase.execute(id, {
          email: input.email,
          profile: {
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            birthDate: input.dateOfBirth,
            avatarUrl: input.avatarUrl,
          },
        });
        return transformUser(user);
      },

      deleteUser: async (_: any, { id }: any, context: any) => {
        assertModelAccess(context.currentUser, 'User', 'unlink');
        try {
          await deps.userRepository.deleteUser(id);
          return { success: true, message: 'User deleted successfully' };
        } catch {
          return { success: false, message: 'Failed to delete user' };
        }
      },

      activateUser: async (_: any, { id }: any, context: any) => {
        assertModelAccess(context.currentUser, 'User', 'write');
        const user = await updateUserUseCase.execute(id, { isActive: true });
        return transformUser(user);
      },

      deactivateUser: async (_: any, { id }: any, context: any) => {
        assertModelAccess(context.currentUser, 'User', 'write');
        const user = await updateUserUseCase.execute(id, { isActive: false });
        return transformUser(user);
      },

      updateUserPassword: async (
        _: any,
        { email, currentPassword, newPassword }: any,
        context: any,
      ) => {
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }
        if (
          !isAdmin(context.currentUser) &&
          context.currentUser.email !== email
        ) {
          throw new GraphQLError('Forbidden: not the owner', {
            extensions: { code: 'FORBIDDEN', http: { status: 403 } },
          });
        }
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `update-password-${Date.now()}`;
        try {
          await updateUserPasswordUseCase.execute({
            email,
            currentPassword,
            newPassword,
            confirmPassword: newPassword,
          });
          return { success: true, message: 'Password updated successfully' };
        } catch (error: any) {
          return { success: false, message: 'Failed to update password' };
        }
      },

      requestPasswordReset: async (_: any, { email }: any, context: any) => {
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `password-reset-${Date.now()}`;
        try {
          await updateUserPasswordUseCase.generatePasswordResetToken(email);
          return ResponseFactory.createSuccessResponse(
            { email, timestamp: new Date().toISOString() },
            'Password reset email sent',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createSuccessResponse(
            { email, timestamp: new Date().toISOString() },
            'If this email exists, a reset link has been sent',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        }
      },

      resetPassword: async (_: any, { token, newPassword }: any, context: any) => {
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `reset-password-${Date.now()}`;
        try {
          await updateUserPasswordUseCase.resetPasswordWithToken(token, newPassword);
          return ResponseFactory.createSuccessResponse(
            { timestamp: new Date().toISOString(), passwordUpdated: true },
            'Password reset successfully',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Password reset failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      setUserPassword: async (_: any, { userId, newPassword }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `set-password-${Date.now()}`;
        try {
          await setUserPasswordUseCase.execute({
            userId,
            newPassword,
            adminUserId: context?.currentUser?.userId || 'system',
          });
          return ResponseFactory.createSuccessResponse(
            { userId, timestamp: new Date().toISOString(), passwordUpdated: true },
            'Password set successfully',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Operation failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      createUserProfile: async (_: any, { input }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const user = await createUserUseCase.execute({
          email: input.email,
          password: input.password,
          isActive: input.isActive !== undefined ? input.isActive : true,
          profile: {
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            birthDate: input.dateOfBirth,
          },
        });
        return user.profile
          ? transformUserProfile(user.profile)
          : transformUserProfile({ ...user, firstName: input.firstName, lastName: input.lastName });
      },

      updateUserProfile: async (_: any, { userId, input }: any, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        const user = await updateUserUseCase.execute(userId, {
          profile: {
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            birthDate: input.dateOfBirth,
            avatarUrl: input.avatarUrl,
          },
        });
        return user.profile ? transformUserProfile(user.profile) : null;
      },

      deleteUserProfile: async (_: any, { userId }: any, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        try {
          await deps.userRepository.deleteUserProfile(userId);
          return { success: true, message: 'Profile deleted' };
        } catch (error: any) {
          return { success: false, message: 'Operation failed' };
        }
      },

      createUserAddress: async (_: any, { input }: any, context: any) => {
        assertOwnerOrAdmin(context.currentUser, input.userId);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `create-address-${Date.now()}`;
        const startTime = Date.now();
        try {
          const address = await createUserAddressUseCase.execute({
            userId: input.userId,
            title: input.type || 'home',
            firstName: input.firstName,
            lastName: input.lastName,
            addressLine1: input.address1,
            addressLine2: input.address2,
            city: input.city,
            state: input.state,
            postalCode: input.postalCode,
            country: input.country || 'CO',
            isDefault: input.isDefault || false,
          });
          const duration = Date.now() - startTime;
          const transformed = transformUserAddress(address);
          return ResponseFactory.createSuccessResponse(
            { entity: transformed, id: address.id, createdAt: address.createdAt?.toISOString() },
            'Address created',
            RESPONSE_CODES.CREATED,
            { requestId, traceId, duration },
          );
        } catch (error: any) {
          const duration = Date.now() - startTime;
          return ResponseFactory.createErrorResponse(
            'Operation failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration },
          );
        }
      },

      updateUserAddress: async (_: any, { id, input }: any, context: any) => {
        const existing = await prisma.userAddress.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('UserAddress', id);
        assertOwnerOrAdmin(context.currentUser, existing.userId);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `update-address-${Date.now()}`;
        try {
          const address = await updateUserAddressUseCase.execute(id, {
            title: input.type,
            firstName: input.firstName,
            lastName: input.lastName,
            addressLine1: input.address1,
            addressLine2: input.address2,
            city: input.city,
            state: input.state,
            postalCode: input.postalCode,
            country: input.country,
            isDefault: input.isDefault,
          });
          const transformed = transformUserAddress(address);
          return ResponseFactory.createSuccessResponse(
            {
              entity: transformed,
              id: address.id,
              updatedAt: address.updatedAt?.toISOString(),
              changes: Object.keys(input),
            },
            'Address updated',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Operation failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      deleteUserAddress: async (_: any, { id }: any, context: any) => {
        const existing = await prisma.userAddress.findUnique({ where: { id } });
        // CWE-203: return an identical "not found" whether the address is absent OR
        // owned by another user, so a non-owner cannot enumerate valid ids.
        const ownsAddress =
          !!existing &&
          (isAdmin(context.currentUser) || context.currentUser?.userId === existing.userId);
        if (!ownsAddress) {
          return ResponseFactory.createErrorResponse('Address not found', RESPONSE_CODES.RESOURCE_NOT_FOUND, {});
        }
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `delete-address-${Date.now()}`;
        try {
          await deleteUserAddressUseCase.execute(id);
          return ResponseFactory.createSuccessResponse(
            { id, deletedAt: new Date().toISOString(), softDelete: false },
            'Address deleted',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Operation failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      setDefaultAddress: async (_: any, { userId, addressId }: any, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `set-default-address-${Date.now()}`;
        try {
          await setDefaultAddressUseCase.execute(userId, addressId);
          return ResponseFactory.createSuccessResponse(
            { userId, addressId, updatedAt: new Date().toISOString() },
            'Default address set',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Operation failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      revokeUserSession: async (_: any, { sessionId, userId, reason }: any, context: any) => {
        // When a specific userId is provided: owner or admin may revoke (STAFF excluded — sessions are PII).
        // When no userId: admin-only path (e.g. revoking by sessionId without knowing the owner).
        if (userId) {
          assertOwnerOrAdmin(context.currentUser, userId);
        } else {
          requireAdministrator(context.currentUser);
        }
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `revoke-session-${Date.now()}`;
        try {
          const result = await revokeUserSessionUseCase.execute({ sessionId, userId, reason });
          return ResponseFactory.createSuccessResponse(
            {
              sessionId: result.sessionId,
              revokedAt: result.revokedAt,
              reason: result.reason,
              analyticsCleaned: result.analyticsCleaned,
            },
            'Session revoked',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Operation failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      revokeAllUserSessions: async (
        _: any,
        { userId, requestingUserId, reason, excludeCurrentSession }: any,
        context: any,
      ) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `revoke-all-sessions-${Date.now()}`;
        try {
          const result = await revokeAllUserSessionsUseCase.execute({
            userId,
            requestingUserId,
            reason,
            excludeCurrentSession,
          });
          return ResponseFactory.createSuccessResponse(
            {
              userId,
              sessionsRevoked: result.sessionsRevoked,
              analyticsCleaned: result.analyticsCleaned,
              revokedAt: result.revokedAt,
              reason,
            },
            'All sessions revoked',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Operation failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      unlinkUserAccount: async (_: any, { accountId }: any, context: any) => {
        const account = await prisma.userAccount.findUnique({ where: { id: accountId } });
        if (!account) return { success: false, message: 'Account not found' };
        assertOwnerOrAdmin(context.currentUser, account.userId);
        try {
          await authRepository.deleteUserAccount(accountId);
          return { success: true, message: 'Account unlinked' };
        } catch (error: any) {
          return { success: false, message: 'Operation failed' };
        }
      },

      forcePasswordReset: async (_: any, { userId }: any, context: any) => {
        requireAdministrator(context.currentUser);
        return { success: true, message: 'Password reset forced' };
      },

      impersonateUser: async (_: any, { userId }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `impersonate-${Date.now()}`;
        return ResponseFactory.createErrorResponse(
          'Impersonation not supported in this environment',
          RESPONSE_CODES.INTERNAL_ERROR,
          {},
          { requestId, traceId, duration: 0 },
        );
      },

      createUserSessionAnalytics: async (_: any, { input }: any, context: any) => {
        // NF-4: owner may create analytics for their own userId; management can create for any.
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }
        if (context.currentUser.userId !== input.userId) {
          requireUserManagementAccess(context.currentUser);
        }
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `create-session-analytics-${Date.now()}`;
        try {
          const result = await createUserSessionAnalyticsUseCase.execute(input);
          return ResponseFactory.createSuccessResponse(
            {
              entity: result.analytics,
              id: result.analytics.id,
              createdAt: (result.analytics.createdAt as any)?.toISOString?.(),
            },
            'Session analytics created',
            RESPONSE_CODES.CREATED,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Operation failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      updateUserSessionAnalytics: async (_: any, { id, input }: any, context: any) => {
        // NF-4: load the record first so we can derive the owner, then enforce owner-or-management.
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }
        const existingForUpdate = await authRepository.findSessionAnalyticsById(id);
        if (!existingForUpdate) {
          return ResponseFactory.createErrorResponse(
            'Session analytics not found',
            RESPONSE_CODES.RESOURCE_NOT_FOUND,
            {},
          );
        }
        if (context.currentUser.userId !== existingForUpdate.userId) {
          requireUserManagementAccess(context.currentUser);
        }
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `update-session-analytics-${Date.now()}`;
        try {
          const result = await updateUserSessionAnalyticsUseCase.execute(id, input);
          return ResponseFactory.createSuccessResponse(
            {
              entity: result.analytics,
              id: result.analytics.id,
              updatedAt: (result.analytics as any).updatedAt?.toISOString?.(),
              changes: result.changes,
            },
            'Session analytics updated',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Operation failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      deleteUserSessionAnalytics: async (_: any, { id }: any, context: any) => {
        // NF-4: owner may delete their own analytics; management can delete any.
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }
        const existingForDelete = await authRepository.findSessionAnalyticsById(id);
        if (!existingForDelete) {
          return ResponseFactory.createErrorResponse(
            'Session analytics not found',
            RESPONSE_CODES.RESOURCE_NOT_FOUND,
            {},
          );
        }
        if (context.currentUser.userId !== existingForDelete.userId) {
          requireUserManagementAccess(context.currentUser);
        }
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `delete-session-analytics-${Date.now()}`;
        try {
          await authRepository.deleteSessionAnalytics(id);
          return ResponseFactory.createSuccessResponse(
            { id, deletedAt: new Date().toISOString(), softDelete: false },
            'Session analytics deleted',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Operation failed',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      // ── Favorites mutations ──────────────────────────────────────────────

      addToFavorites: async (_: any, { userId, productId }: any, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        const fav = await manageUserFavoritesUseCase.addToFavorites({ userId, productId });
        return {
          ...fav,
          user: { __typename: 'UserProfile', id: fav.userId },
          product: { __typename: 'Product', id: fav.productId },
        };
      },

      removeFromFavorites: async (_: any, { userId, productId }: any, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        try {
          await manageUserFavoritesUseCase.removeFromFavorites({ userId, productId });
          return { success: true, message: 'Removed from favorites' };
        } catch (error: any) {
          return { success: false, message: 'Failed to remove from favorites' };
        }
      },

      toggleFavorite: async (_: any, { userId, productId }: any, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        const result = await manageUserFavoritesUseCase.toggleFavorite(userId, productId);
        if (result.action === 'removed') return null;
        return {
          ...result.favorite!,
          user: { __typename: 'UserProfile', id: userId },
          product: { __typename: 'Product', id: productId },
        };
      },

      // ── Saved payment methods mutations ──────────────────────────────────

      createSavedPaymentMethod: async (_: any, { input }: any, context: any) => {
        assertOwnerOrAdmin(context.currentUser, input.userId);
        const method = await prisma.savedPaymentMethod.create({
          data: {
            userId: input.userId,
            type: input.type,
            provider: input.provider,
            lastFour: input.lastFour,
            expiryMonth: input.expiryMonth,
            expiryYear: input.expiryYear,
            cardholderName: input.cardholderName,
            isDefault: input.isDefault ?? false,
            metadata: input.metadata ?? {},
          },
        });
        return { ...method, user: { __typename: 'UserProfile', id: method.userId } };
      },

      updateSavedPaymentMethod: async (_: any, { id, input }: any, context: any) => {
        const existing = await prisma.savedPaymentMethod.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('SavedPaymentMethod', id);
        assertOwnerOrAdmin(context.currentUser, existing.userId);
        const method = await prisma.savedPaymentMethod.update({
          where: { id },
          data: {
            isDefault: input.isDefault,
            isActive: input.isActive,
            metadata: input.metadata,
          },
        });
        return { ...method, user: { __typename: 'UserProfile', id: method.userId } };
      },

      deleteSavedPaymentMethod: async (_: any, { id }: any, context: any) => {
        const existing = await prisma.savedPaymentMethod.findUnique({ where: { id } });
        // CWE-203: identical "not found" for absent or non-owned records (anti-enumeration).
        const ownsPaymentMethod =
          !!existing &&
          (isAdmin(context.currentUser) || context.currentUser?.userId === existing.userId);
        if (!ownsPaymentMethod) {
          return { success: false, message: 'Payment method not found' };
        }
        try {
          await prisma.savedPaymentMethod.update({ where: { id }, data: { isActive: false } });
          return { success: true, message: 'Payment method deleted' };
        } catch (error: any) {
          return { success: false, message: 'Failed to delete payment method' };
        }
      },

      // ── Notification mutations ───────────────────────────────────────────

      createPushNotification: async (_: any, { input }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const notif = await prisma.pushNotification.create({
          data: {
            userId: input.userId,
            title: input.title,
            body: input.body,
            type: input.type,
            data: input.data ?? {},
          },
        });
        return { ...notif, user: { __typename: 'UserProfile', id: notif.userId } };
      },

      markNotificationAsRead: async (_: any, { id }: any, context: any) => {
        const notif = await prisma.pushNotification.findUnique({ where: { id } });
        if (!notif) throw new NotFoundError('PushNotification', id);
        assertOwnerOrAdmin(context.currentUser, notif.userId);
        const updated = await prisma.pushNotification.update({
          where: { id },
          data: { isRead: true, readAt: new Date() },
        });
        return { ...updated, user: { __typename: 'UserProfile', id: updated.userId } };
      },

      markAllNotificationsAsRead: async (_: any, { userId }: any, context: any) => {
        assertOwnerOrAdmin(context.currentUser, userId);
        try {
          await prisma.pushNotification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true, readAt: new Date() },
          });
          return { success: true, message: 'All notifications marked as read' };
        } catch {
          return { success: false, message: 'Failed to mark notifications as read' };
        }
      },

      createNotificationTemplate: async (_: any, { input }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const template = await prisma.notificationTemplate.create({
          data: {
            name: input.name,
            type: input.type,
            title: input.title,
            body: input.body,
            variables: input.variables ?? [],
            isActive: input.isActive ?? true,
          },
        });
        return { ...template, variables: template.variables as string[] };
      },

      // ── Newsletter mutations ─────────────────────────────────────────────

      subscribeToNewsletter: async (_: any, { email, userId }: any) => {
        const existing = await prisma.newsletterSubscription.findUnique({ where: { email } });
        if (existing) {
          const updated = await prisma.newsletterSubscription.update({
            where: { email },
            data: { isActive: true, unsubscribedAt: null, userId: userId ?? existing.userId },
          });
          return {
            ...updated,
            user: updated.userId ? { __typename: 'UserProfile', id: updated.userId } : null,
          };
        }
        const sub = await prisma.newsletterSubscription.create({
          data: { email, userId: userId ?? null },
        });
        return {
          ...sub,
          user: sub.userId ? { __typename: 'UserProfile', id: sub.userId } : null,
        };
      },

      unsubscribeFromNewsletter: async (_: any, { email }: any) => {
        try {
          await prisma.newsletterSubscription.update({
            where: { email },
            data: { isActive: false, unsubscribedAt: new Date() },
          });
          return { success: true, message: 'Unsubscribed successfully' };
        } catch {
          return { success: false, message: 'Failed to unsubscribe' };
        }
      },

      // ── RBAC admin mutations ───────────────────────────────────────────────

      createGroup: async (_: any, { input }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `create-group-${Date.now()}`;
        const group = await createGroupUseCase.execute(input);
        return ResponseFactory.createSuccessResponse(
          group,
          'Group created successfully',
          RESPONSE_CODES.CREATED,
          { requestId, traceId, duration: 0 },
        );
      },

      updateGroup: async (_: any, { id, input }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `update-group-${Date.now()}`;
        const group = await updateGroupUseCase.execute(id, input);
        return ResponseFactory.createSuccessResponse(
          group,
          'Group updated successfully',
          RESPONSE_CODES.SUCCESS,
          { requestId, traceId, duration: 0 },
        );
      },

      deleteGroup: async (_: any, { id }: any, context: any) => {
        requireAdministrator(context.currentUser);
        await deleteGroupUseCase.execute(id);
        return { success: true, message: 'Group deleted successfully' };
      },

      assignUserToGroup: async (_: any, { userId, groupId }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `assign-user-group-${Date.now()}`;
        const membership = await assignUserToGroupUseCase.execute({
          userId,
          groupId,
          grantedBy: context.currentUser?.userId,
        });
        return ResponseFactory.createSuccessResponse(
          {
            userId: membership.userId,
            groupId: membership.groupId,
            group: null,
            grantedAt: membership.grantedAt,
            grantedBy: membership.grantedBy,
          },
          'User assigned to group',
          RESPONSE_CODES.SUCCESS,
          { requestId, traceId, duration: 0 },
        );
      },

      removeUserFromGroup: async (_: any, { userId, groupId }: any, context: any) => {
        requireAdministrator(context.currentUser);
        await removeUserFromGroupUseCase.execute(userId, groupId);
        return { success: true, message: 'User removed from group' };
      },

      assignPermissionToGroup: async (_: any, { groupId, permissionId }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `assign-perm-group-${Date.now()}`;
        const link = await assignPermissionToGroupUseCase.execute(groupId, permissionId);
        return ResponseFactory.createSuccessResponse(
          {
            groupId: link.groupId,
            permissionId: link.permissionId,
            permission: null,
            group: null,
            createdAt: link.createdAt,
          },
          'Permission assigned to group',
          RESPONSE_CODES.SUCCESS,
          { requestId, traceId, duration: 0 },
        );
      },

      revokePermissionFromGroup: async (_: any, { groupId, permissionId }: any, context: any) => {
        requireAdministrator(context.currentUser);
        await revokePermissionFromGroupUseCase.execute(groupId, permissionId);
        return { success: true, message: 'Permission revoked from group' };
      },

      addGroupImplication: async (_: any, { groupId, impliedGroupId }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `add-implication-${Date.now()}`;
        const implication = await addGroupImplicationUseCase.execute({ groupId, impliedGroupId });
        return ResponseFactory.createSuccessResponse(
          {
            groupId: implication.groupId,
            impliedGroupId: implication.impliedGroupId,
            impliedGroup: null,
            createdAt: implication.createdAt,
          },
          'Group implication added',
          RESPONSE_CODES.SUCCESS,
          { requestId, traceId, duration: 0 },
        );
      },

      removeGroupImplication: async (_: any, { groupId, impliedGroupId }: any, context: any) => {
        requireAdministrator(context.currentUser);
        await removeGroupImplicationUseCase.execute(groupId, impliedGroupId);
        return { success: true, message: 'Group implication removed' };
      },

      createPermission: async (_: any, { input }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `create-permission-${Date.now()}`;
        const permission = await createPermissionUseCase.execute(input);
        return ResponseFactory.createSuccessResponse(
          permission,
          'Permission created successfully',
          RESPONSE_CODES.CREATED,
          { requestId, traceId, duration: 0 },
        );
      },

      updatePermission: async (_: any, { id, input }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `update-permission-${Date.now()}`;
        const permission = await updatePermissionUseCase.execute(id, input);
        return ResponseFactory.createSuccessResponse(
          permission,
          'Permission updated successfully',
          RESPONSE_CODES.SUCCESS,
          { requestId, traceId, duration: 0 },
        );
      },

      deletePermission: async (_: any, { id }: any, context: any) => {
        requireAdministrator(context.currentUser);
        await deletePermissionUseCase.execute(id);
        return { success: true, message: 'Permission deleted successfully' };
      },

      createRecordRule: async (_: any, { input }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `create-record-rule-${Date.now()}`;
        const rule = await createRecordRuleUseCase.execute(input);
        return ResponseFactory.createSuccessResponse(
          rule,
          'Record rule created successfully',
          RESPONSE_CODES.CREATED,
          { requestId, traceId, duration: 0 },
        );
      },

      updateRecordRule: async (_: any, { id, input }: any, context: any) => {
        requireAdministrator(context.currentUser);
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `update-record-rule-${Date.now()}`;
        const rule = await updateRecordRuleUseCase.execute(id, input);
        return ResponseFactory.createSuccessResponse(
          rule,
          'Record rule updated successfully',
          RESPONSE_CODES.SUCCESS,
          { requestId, traceId, duration: 0 },
        );
      },

      deleteRecordRule: async (_: any, { id }: any, context: any) => {
        requireAdministrator(context.currentUser);
        await deleteRecordRuleUseCase.execute(id);
        return { success: true, message: 'Record rule deleted successfully' };
      },

      // Account management
      unlockUserAccount: async (_: any, { userId }: any, context: any) => {
        requireUserManagementAccess(context.currentUser);
        const now = new Date().toISOString();
        await unlockUserAccountUseCase.execute({
          targetUserId: userId,
          adminUserId: context.currentUser!.userId,
          ipAddress: context.req?.ip,
          userAgent: context.req?.headers?.['user-agent'],
        });
        return {
          success: true,
          message: 'User account unlocked successfully',
          code: 'UPDATED',
          timestamp: now,
          data: { userId, unlockedAt: now },
        };
      },

      // ── Email Verification mutations (WS2) ────────────────────────────────

      requestEmailVerification: async (_: any, { email }: any, context: any) => {
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `req-email-verify-${Date.now()}`;
        try {
          const result = await requestEmailVerificationUseCase.execute({ email });
          return ResponseFactory.createSuccessResponse(
            { email: result.email, timestamp: result.timestamp },
            'If this email is registered, a verification link has been sent',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Failed to process email verification request',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      verifyEmail: async (_: any, { token }: any, context: any) => {
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `verify-email-${Date.now()}`;
        try {
          const result = await verifyEmailUseCase.execute({ token });
          return ResponseFactory.createSuccessResponse(
            { timestamp: result.timestamp, emailVerified: result.emailVerified },
            'Email verified successfully',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            error?.message || 'Email verification failed',
            RESPONSE_CODES.VALIDATION_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      resendVerificationEmail: async (_: any, { email }: any, context: any) => {
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `resend-email-verify-${Date.now()}`;
        try {
          const result = await resendVerificationEmailUseCase.execute({ email });
          return ResponseFactory.createSuccessResponse(
            { email: result.email, timestamp: result.timestamp },
            'If this email is registered and unverified, a new verification link has been sent',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Failed to process resend request',
            RESPONSE_CODES.INTERNAL_ERROR,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },

      // ── MFA mutations (WS3) ───────────────────────────────────────────────

      enableMFA: async (_: any, __: any, context: any) => {
        // G-11: requires authenticated user
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `enable-mfa-${Date.now()}`;
        const result = await enableMfaUseCase.execute({ userId: context.currentUser.userId });
        return ResponseFactory.createSuccessResponse(
          {
            otpauthUrl: result.otpauthUrl,
            qrDataUrl: result.qrDataUrl,
            secret: result.secret,
          },
          'MFA setup initiated — scan the QR code with your authenticator app',
          RESPONSE_CODES.SUCCESS,
          { requestId, traceId, duration: 0 },
        );
      },

      verifyMFASetup: async (_: any, { code }: any, context: any) => {
        // G-11: requires authenticated user
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `verify-mfa-setup-${Date.now()}`;
        const result = await verifyMfaSetupUseCase.execute({
          userId: context.currentUser.userId,
          code,
        });
        return ResponseFactory.createSuccessResponse(
          {
            backupCodes: result.backupCodes,
            mfaEnabled: result.mfaEnabled,
          },
          'MFA enabled successfully — store your backup codes in a safe place',
          RESPONSE_CODES.SUCCESS,
          { requestId, traceId, duration: 0 },
        );
      },

      disableMFA: async (_: any, { password }: any, context: any) => {
        // G-11: requires authenticated user
        if (!context.currentUser) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
          });
        }
        await disableMfaUseCase.execute({
          userId: context.currentUser.userId,
          password,
        });
        return { success: true, message: 'MFA disabled successfully' };
      },

      verifyTotp: async (_: any, { mfaChallengeToken, code }: any, context: any) => {
        const requestId = context?.req?.headers?.['x-request-id'] || `req-${Date.now()}`;
        const traceId = `verify-totp-${Date.now()}`;
        try {
          const result = await verifyTotpUseCase.execute({ mfaChallengeToken, code });
          return ResponseFactory.createSuccessResponse(
            {
              user: transformUser(result.user),
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
            },
            'MFA verification successful',
            RESPONSE_CODES.SUCCESS,
            { requestId, traceId, duration: 0 },
          );
        } catch (error: any) {
          return ResponseFactory.createErrorResponse(
            'Invalid email or password',
            RESPONSE_CODES.AUTHENTICATION_FAILED,
            {},
            { requestId, traceId, duration: 0 },
          );
        }
      },
    },
  };
}
