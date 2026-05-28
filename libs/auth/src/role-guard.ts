import { GraphQLError } from 'graphql';
import { TokenPayload, UserRole } from './types';

export function requireAdmin(currentUser: TokenPayload | null | undefined): void {
  if (!currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  if (currentUser.role !== UserRole.ADMIN) {
    throw new GraphQLError('Admin access required', {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }
}
