# ADR: Impersonate User — Deferred

**Status:** Deferred  
**Date:** 2026-06-02  
**Deciders:** backend-expert, microservices-architect

---

## Context

The `impersonateUser` mutation exists in the user-service GraphQL schema and is
guarded by `requireAdministrator`. Its current implementation returns a hard error:
`"Impersonation not supported in this environment"`.

Impersonation (acting as another user without knowing their password) is a legitimate
admin tool for support workflows, but it requires non-trivial infrastructure that does
not yet exist in this platform.

---

## Why This Is Deferred

### Technical requirements that are not yet met

1. **`@hbs/auth` TokenPayload extension**: The JWT payload must carry an `impersonatedBy`
   field (`{ userId, email }`) so that downstream services (order-service, product-service,
   media-service) can distinguish impersonated requests in their logs and audit trails.
   This is a **cross-library breaking change** that requires coordination with all subgraphs.

2. **Short-lived token with restricted scope**: Impersonation tokens must have a short TTL
   (e.g. 15 minutes) and must **not** grant the ability to further impersonate another user
   (no chained impersonation).

3. **Explicit revocation**: An impersonation token must be revocable independently of the
   target user's normal sessions. This requires a dedicated revocation table or Redis entry.

4. **Audit trail**: Every impersonation event must be logged with:
   - who impersonated (admin `userId`)
   - who was impersonated (target `userId`)
   - timestamp and TTL
   - originating IP and userAgent
   This audit must be append-only and immutable.

5. **No production usage yet**: The platform has no active customers, so this feature has
   zero urgency. Implementing it prematurely increases the attack surface without benefit.

---

## Proposed design when implemented

```
Mutation impersonateUser(userId: ID!): ImpersonateUserResponse

JWT shape:
  {
    userId: <target-user-id>,
    email: <target-email>,
    groups: <target-groups>,
    permissions: <target-permissions>,
    impersonatedBy: { userId: <admin-id>, email: <admin-email> },
    exp: now + 15 minutes
  }
```

### Required implementation steps

1. Add `impersonatedBy?: { userId: string; email: string }` to `TokenPayload` in
   `libs/auth/src/index.ts`. Add guard helper `isImpersonated(ctx)`.

2. Add `impersonation_sessions` table to user-service Prisma schema:
   `id`, `adminUserId`, `targetUserId`, `tokenHash`, `expiresAt`, `createdAt`.

3. Implement `ImpersonateUserUseCase`:
   - verify target user exists and is active
   - generate short-lived JWT with `impersonatedBy` field
   - hash and persist in `impersonation_sessions`
   - write audit log

4. Add `revokeImpersonation(sessionId)` mutation for early termination.

5. Update all subgraph logs to include `impersonatedBy` when present.

6. Add integration tests: impersonated token is rejected if target account is locked;
   chained impersonation is rejected; revocation invalidates the token.

---

## Current stub

The resolver remains as-is, returning a clear error:

```typescript
impersonateUser: async (_: any, { userId }: any, context: any) => {
  requireAdministrator(context.currentUser);
  // ADR: impersonation deferred — see apps/user-service/ADR-impersonate-user.md
  return ResponseFactory.createErrorResponse(
    'Impersonation not supported in this environment',
    RESPONSE_CODES.INTERNAL_ERROR,
    {},
  );
},
```

The mutation stays in the SDL so clients know the API surface exists; the error message
is explicit so it is never mistaken for a transient failure.
