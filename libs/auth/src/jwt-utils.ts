/** Returns the Bearer token string or null if the header is missing/malformed. */
export function extractTokenFromAuthHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}
