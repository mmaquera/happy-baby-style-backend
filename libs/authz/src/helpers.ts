import type { TokenPayload } from '@hbs/auth';

/**
 * Verifica si el usuario tiene el permiso especificado.
 * Backward-compat: si el token no tiene `permissions` (token viejo pre-Fase 5),
 * retorna false. El caller debe combinar con fallback a `requireRole` si necesita.
 */
export function hasPermission(
  user: TokenPayload | null | undefined,
  permissionCode: string,
): boolean {
  if (!user) return false;
  return user.permissions?.includes(permissionCode as any) ?? false;
}

/**
 * Verifica si el usuario pertenece al grupo especificado.
 * Backward-compat: si el token no tiene `groups` (token viejo pre-Fase 5),
 * retorna false. El campo `groups` se añade al TokenPayload en Fase 5.5.
 */
export function belongsToGroup(
  user: TokenPayload | null | undefined,
  groupCode: string,
): boolean {
  if (!user) return false;
  return user.groups?.includes(groupCode) ?? false;
}

/**
 * Atajo: ¿es admin? Comprueba pertenencia al grupo `administrators`.
 */
export function isAdmin(user: TokenPayload | null | undefined): boolean {
  if (!user) return false;
  return belongsToGroup(user, 'administrators');
}

/**
 * ¿Pertenece a ALGUNO de los grupos listados?
 */
export function belongsToAnyGroup(
  user: TokenPayload | null | undefined,
  ...groupCodes: string[]
): boolean {
  return groupCodes.some(code => belongsToGroup(user, code));
}

/**
 * ¿Tiene ALGUNO de los permisos listados?
 */
export function hasAnyPermission(
  user: TokenPayload | null | undefined,
  ...permissionCodes: string[]
): boolean {
  return permissionCodes.some(code => hasPermission(user, code));
}
