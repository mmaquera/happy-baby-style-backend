import { Permission, UserRole } from './types';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: Object.values(Permission),
  [UserRole.STAFF]: [
    Permission.READ_PRODUCT,
    Permission.UPDATE_PRODUCT,
    Permission.READ_ORDER,
    Permission.UPDATE_ORDER,
    Permission.READ_USER,
    Permission.VIEW_ANALYTICS,
  ],
  [UserRole.CUSTOMER]: [
    Permission.READ_PRODUCT,
    Permission.CREATE_ORDER,
    Permission.READ_ORDER,
    Permission.READ_USER,
  ],
};

export function resolvePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
