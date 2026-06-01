import jwt from 'jsonwebtoken';
import { TokenPayload } from './types';
import { extractTokenFromAuthHeader } from './jwt-utils';

export interface AuthContextResult {
  currentUser: TokenPayload | null;
}

/**
 * Verifies the JWT from the Authorization header (Bearer scheme) and returns the decoded TokenPayload.
 * Returns { currentUser: null } if no token is present, the token is invalid, or the token is expired.
 *
 * Does NOT throw on verification failure — the caller (resolver/plugin) decides what to do with an
 * unauthenticated context. Will throw only if JWT_SECRET is not set, which indicates a misconfiguration
 * that should have been caught by the process.exit(1) guard at service startup.
 */
export function buildAuthContext(authHeader: string | undefined): AuthContextResult {
  const token = extractTokenFromAuthHeader(authHeader);
  if (!token) {
    return { currentUser: null };
  }
  try {
    const currentUser = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    return { currentUser };
  } catch {
    return { currentUser: null };
  }
}
