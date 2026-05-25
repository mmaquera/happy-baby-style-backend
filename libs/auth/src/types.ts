export enum UserRole {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
  STAFF = 'staff',
}

export enum Permission {
  CREATE_PRODUCT = 'create:product',
  READ_PRODUCT = 'read:product',
  UPDATE_PRODUCT = 'update:product',
  DELETE_PRODUCT = 'delete:product',

  CREATE_ORDER = 'create:order',
  READ_ORDER = 'read:order',
  UPDATE_ORDER = 'update:order',
  DELETE_ORDER = 'delete:order',

  CREATE_USER = 'create:user',
  READ_USER = 'read:user',
  UPDATE_USER = 'update:user',
  DELETE_USER = 'delete:user',

  MANAGE_USERS = 'manage:users',
  MANAGE_SYSTEM = 'manage:system',
  VIEW_ANALYTICS = 'view:analytics',
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  iat?: number;
  exp?: number;
}
