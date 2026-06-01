## Commit Rules

- NEVER add `Co-Authored-By` lines to commit messages.
- Use conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`.
- Commit messages in English. Scope optional but encouraged: `feat(order-service):`.

---

## Project Overview

Nx 22 monorepo — Node 22, pnpm 11, TypeScript 5.3.
5 Apollo Federation v2 subgraphs + 1 gateway, each a standalone microservice.
PostgreSQL 16 (per-service databases) + Redis 7 (event streaming via Streams).

apps/
  category-service  :3002   product categories
  product-service   :3003   products, variants, inventory, reviews  ← also Redis consumer
  media-service     :3004   file uploads, storage
  order-service     :3005   orders  ← Redis Stream producer
  user-service      :3006   users, auth, email, JWT signing
  gateway           :4000   Apollo Federation router + rate limiting

libs/
  @hbs/auth          JWT extraction & types (TokenPayload, UserRole, Permission) + RBAC guards
  @hbs/authz         Non-throwing RBAC helpers, compileDomainExpr, RecordRuleResolver
  @hbs/logging       ILogger interface, LoggerFactory, Winston implementation
  @hbs/prisma        Shared PrismaClient singleton
  @hbs/shared-kernel DomainError hierarchy, ResponseFactory, ResponseCodes

---

## Architecture: Clean Architecture + Hexagonal + DDD per service

Layer order (inner → outer). Never import outer layers from inner ones.

  domain/
    entities/        Pure business entities. No framework or Prisma imports.
    repositories/    Repository interfaces (ports). Prefix: IProductRepository.
    ports/           Other external ports: IEventPublisher, IProductValidationPort.
    errors/          Re-exports full DomainError hierarchy from @hbs/shared-kernel.

  application/
    use-cases/       One class per use case. Constructor-injected deps. No HTTP/GraphQL.
    use-cases/__tests__/  Jest unit tests for every use case. Mock all deps.

  infrastructure/
    repositories/    Prisma implementations of domain repository interfaces.
    adapters/        HTTP/external service adapters (HttpProductValidationAdapter).
    messaging/       Redis Stream consumers (OrderEventsConsumer).

  graphql/
    schema.ts        SDL via gql`` tag. Federation @key directives. Schema-first only.
    resolvers.ts     createResolvers(dep1, dep2, ...) factory. No logic — delegates to use cases.
    transformers/    Entity → GraphQL DTO mappers.

  index.ts           Wires all deps manually (no DI framework), starts Express + Apollo.

---

## Naming Conventions

Files:
  Entities:      PascalCase.ts            Product.ts, Order.ts
  Interfaces:    IPascalCase.ts           IProductRepository.ts
  Use cases:     PascalCaseUseCase.ts     CreateProductUseCase.ts
  Impls:         PrismaProductRepository.ts, HttpProductValidationAdapter.ts
  Tests:         *.spec.ts inside __tests__/

GraphQL:
  Types:      PascalCase          Product, ProductVariant, CreateProductInput
  Queries:    camelCase           products, productById
  Mutations:  camelCase           createProduct, updateProductVariant
  Responses:  PascalCaseResponse  GetProductsResponse, CreateProductResponse

Database (always use Prisma @map):
  Tables:   snake_case plural   products, product_variants, order_items
  Columns:  snake_case          category_id, stock_quantity, created_at
  Enums:    snake_case values   pending, low_stock, credit_card

---

## Shared Libraries

### @hbs/logging — always use, never console.log in services
  const logger = LoggerFactory.getInstance().createUseCaseLogger('CreateOrderUseCase');
  const logger = LoggerFactory.getInstance().createServiceLogger('OrderEventsConsumer');
  const logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaProductRepository');
  logger.info('message', { contextObject });
  logger.error('message', errorInstance, { contextObject });

### @hbs/shared-kernel — errors
Throw typed domain errors. Never throw plain Error for business logic.
  throw new NotFoundError('Product', productId);
  throw new DuplicateError('email already registered');
  throw new ValidationError('price must be positive', 'price');
  throw new BusinessLogicError('cannot cancel a delivered order');

### @hbs/shared-kernel — responses
Resolvers wrap results with ResponseFactory:
  return ResponseFactory.createSuccessResponse(data, 'Product created', ResponseCodes.CREATED);
  return ResponseFactory.createPaginatedResponse(items, total, limit, offset);

### @hbs/auth
  const token = extractTokenFromAuthHeader(req.headers.authorization);
  const currentUser = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
  const ctx = buildAuthContext(currentUser);   // wraps TokenPayload with RBAC helpers
Auth plugin in every subgraph guards all mutations: throw UNAUTHENTICATED if !currentUser.
Every subgraph must process.exit(1) at startup if JWT_SECRET is not set.

Throwing guards (use in resolvers — throw ForbiddenError on failure):
  requireRole(ctx, UserRole.ADMIN)
  requirePermission(ctx, 'orders:write')
  requireGroup(ctx, 'sales-manager')
  requireAnyGroup(ctx, ['sales-manager', 'sales-user'])
  requireAdmin(ctx)
  assertOwnerOrAdmin(ctx, resourceOwnerId)

For non-throwing checks (conditions, use-case logic) use @hbs/authz: hasPermission, belongsToGroup, isAdmin.

### @hbs/prisma
  import { prisma } from '@hbs/prisma';  // singleton — never instantiate PrismaClient directly
Pass prisma into repositories and use cases via constructor injection.

---

## Testing Patterns

Framework: Jest + ts-jest. Configs: apps/<svc>/jest.config.js + tsconfig.spec.json.
Run: `pnpm exec nx test <service-name>`

Rules:
- Test use cases only — not resolvers, not HTTP endpoints.
- Mock all injected deps with jest.fn().mockResolvedValue().
- Mock @hbs/logging with { virtual: true } at the top of every spec file.
- Use make*() factory functions for test data with sensible defaults + optional overrides.
- Cover: happy path, domain errors (NotFound, Duplicate, Validation), event publish failures.

Required mock at top of every spec:
  jest.mock('@hbs/logging', () => ({
    LoggerFactory: {
      getInstance: () => ({
        createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
      }),
    },
  }), { virtual: true });

---

## GraphQL & Federation

Schema-first: SDL in schema.ts using gql`` tag (never code-first / TypeGraphQL).
Every subgraph starts with:
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

Owned entities: `type Product @key(fields: "id") { ... }`
Referenced entities (stub): `type Category @key(fields: "id") { id: ID! }`
Cross-service lookups: implement __resolveReference on stub types.
All list queries: require pagination (limit/offset). Never return unbounded arrays.
All mutations: dedicated Input type + dedicated Response type. Never return raw entity.

---

## RBAC / Authorization Model

Multi-group RBAC inspirado en Odoo: usuarios pertenecen a N grupos, grupos tienen permisos, herencia transitiva entre grupos (group_implications), y record rules para filtrado row-level. Reemplaza el enum plano `UserRole`; `user_profiles.role` se mantiene solo para backward compat durante rollout.

### Data model (user-service DB)

| Table               | Purpose                                                         |
|---------------------|-----------------------------------------------------------------|
| `groups`            | Named groups; `is_system=true` protects seeds from deletion     |
| `permissions`       | `verb:noun` codes (e.g. `orders:write`)                         |
| `group_permissions` | M:N groups ↔ permissions                                        |
| `group_implications`| Transitiva: group A implies group B (CTE at login)              |
| `user_groups`       | M:N users ↔ groups (assignment)                                 |
| `record_rules`      | Row-level filter per group + model; domain expression JSON      |

6 seeded groups: `administrators`, `sales-manager`, `sales-user`, `inventory-user`, `customer-service`, `customer`. 15 permissions seeded.

### JWT shape

```ts
// TokenPayload (libs/auth/src/index.ts)
{ userId, email, role,          // legacy — kept for compat
  groups?: string[],             // group codes the user belongs to (effective, transitive)
  permissions: string[] }        // permission codes (effective, transitive)
```

Login resolves effective groups + permissions via recursive CTE in Postgres. Falls back to `resolvePermissions(role)` if user has no groups assigned.

### Guards — when to use which

**Resolvers** (throw ForbiddenError): use `@hbs/auth` guards — `requirePermission`, `requireGroup`, `requireAnyGroup`, `requireAdmin`, `assertOwnerOrAdmin`.

**Use-case conditions / partial filters**: use `@hbs/authz` non-throwing helpers — `hasPermission(ctx, code)`, `belongsToGroup(ctx, code)`, `isAdmin(ctx)`.

**Hybrid helpers** (local per subgraph, accept new groups OR legacy role):
- `requireOrderManagementAccess(ctx)` — order-service
- `requireProductManagementAccess(ctx)` — product-service
- `requireUserManagementAccess(ctx)` — user-service
- `requireCategoryAdmin(ctx)` — category-service

Prefer these over raw `requireRole` — they stay compatible during the rollout window.

### Record rules — domain expression

JSON stored in `record_rules.domain_expr`. Compiled to a Prisma `where` clause by `compileDomainExpr` (Zod-validated, `@hbs/authz`).

```jsonc
// leaf comparison
{ "op": "=", "field": "customerId", "value": { "$ctx": "userId" } }
// composite
{ "AND": [ { "op": "=", "field": "status", "value": "active" }, ... ] }
// universal deny (no records)
{ "AND": [{ "NOT": {} }] }
```

Supported ops: `=`, `!=`, `in`, `not_in`, `<`, `>`, `<=`, `>=`. `$ctx` resolves against `RecordRuleContext` (userId, groups, permissions).

`RecordRuleResolver.resolve(model, ctx)` aggregates all rules for the user's groups (singleflight + fail-closed: returns universal deny on error).

### Record rules — propagation

```
admin mutation → use case → IEventPublisher.publishRecordRuleUpdated()
  → XADD stream:record-rules-updated
    → RecordRulesEventsConsumer (each subgraph)
      → StreamRecordRuleSource.upsert()
        → RecordRuleResolver.refresh()
          → next repo query picks up new where clause
```

Snapshot-on-boot: call `fetchSnapshotAndPopulate(source)` in `index.ts` → hits `GET /internal/record-rules` on user-service. Currently wired only in order-service (pilot). Other subgraphs must add it before prod.

### Adding groups / permissions / rules

- **Seeds** (`libs/prisma/seed.ts`): for system groups + core permissions. Idempotent `upsert`. Run via `pnpm exec prisma db seed`.
- **Admin mutations** (`user-service` GraphQL, guarded by `requireAdministrator`): runtime CRUD for tenant-specific groups, permissions, and record rules. 16 mutations + 5 queries.
- Cycle detection in group_implications is enforced at use-case level before insert.

### Debugging

```bash
# Decode live JWT (replace <token>)
node -e "console.log(JSON.parse(Buffer.from('<token>'.split('.')[1],'base64').toString()))"
# Inspect stream backlog
redis-cli XPENDING stream:record-rules-updated record-rules-group - + 20
# Consumer logs (order-service pilot)
pnpm run docker:up && docker logs order-service -f | grep record-rule
```

### Migration & rollout state

| Phase | Description                               | Status      |
|-------|-------------------------------------------|-------------|
| A     | Schema + seeds + login CTE                | Done        |
| B     | JWT carries groups+permissions; auth lib guards; order-service pilot | Done |
| C     | All subgraphs snapshot-on-boot + BOLA fixes + DROP legacy role column | Pending |

### Known backlog (pre-prod required)

- **BOLA in order-service**: `getOrderById` and `updateOrderStatus` lack per-record owner check — see security backlog memory.
- **Snapshot-on-boot**: only order-service has `fetchSnapshotAndPopulate`; product/category/media/user subgraphs need it wired in `index.ts`.
- **Migrations**: currently using `prisma db push`; must migrate to `prisma migrate deploy` before production.
- **Drop `user_profiles.role`**: column kept for backward compat; schedule DROP after prod backfill confirms all users have group assignments.
- **Stream consumer lag metrics**: no dashboards/alerts for `stream:record-rules-updated` consumer lag — blind to propagation failures.

---

## Event-Driven Patterns (Redis Streams)

Transport: Redis Streams (XADD/XREADGROUP/XACK). Never pub/sub for durable events.
Current flow:
  order-service → XADD stream:order-events → product-service consumer group

Rules:
- Every event MUST carry eventId (uuid) for idempotency.
- Consumers use an InboxEvent table as idempotency guard (P2002 → skip + XACK).
- XAUTOCLAIM reclaims entries idle > 60s from crashed consumers.
- No-ack on error → entry stays pending for retry (do not swallow errors silently).
- XADD failure must be logged as error (stock will not decrement — needs alerting/reconciliation).

Adding a new event type:
  1. Add interface to producer's domain/ports/IEventPublisher.ts
  2. Implement XADD in RedisEventPublisher with MAXLEN ~ 10000
  3. Define the same event interface locally in consumer service (never cross-import between services)
  4. New use case + InboxEvent guard + consumer handler

---

## Adding a New Microservice

1. Create apps/<name>-service/ following the 4-layer structure above.
2. Add project.json with build / type-check / test / serve targets (copy from category-service).
3. Add tsconfig.json + tsconfig.spec.json + jest.config.js.
4. Create apps/<name>-service/prisma/schema.prisma for service-specific models.
5. Add service to docker-compose.yml: postgres dependency, JWT_SECRET env var, /health endpoint.
6. Register subgraph in apps/gateway/src/index.ts IntrospectAndCompose list.
7. Add to supergraph.yaml for rover compose.
8. If using Redis: add REDIS_URL env + redis service_healthy dependency in docker-compose.

---

## Suggesting Improvements

After completing a task, each agent proactively flags one improvement opportunity in its own
domain (architect: layer/DDD violations & cross-service smells; backend: N+1, unbounded queries,
heavy sync work in request path; database: index/migration/query issues; security: missing
authz, unvalidated input, secret/token leaks; devops: missing health checks, no resource
limits, secrets in plain env, missing DLQ/observability; bruno: collection drift from schema,
missing requests for new mutations, stale env vars). One bullet, do NOT implement unless asked.

Format: "Improvement opportunity: [what] — [why/risk]"

---

## Agent Orchestration

Project-defined agents must be used to execute approved plans. Dispatch is **consultive**:
before launching agents, list which ones will run, in what order, and wait for approval.

### Routing & ownership

| Trigger                                                            | Agent                   | Owns during execution                                                                  |
|--------------------------------------------------------------------|-------------------------|----------------------------------------------------------------------------------------|
| /plan, /ultrareview, cross-service design, federation, supergraph  | microservices-architect | Splits plan into tasks, assigns specialists, runs `/ultrareview`, decides re-work.     |
| Use cases, resolvers, repositories, adapters, messaging, refactors | backend-expert          | Implements application/infrastructure/graphql layers + Jest tests. No Prisma schema.   |
| Prisma schema, migrations, indexes, N+1, query optimization        | database-expert         | Owns schema, migrations, indexes, repo query shape. Hands typed interface to backend.  |
| Auth flows, authz, threat modeling, crypto, file upload, RBAC      | security-analyst        | Gates auth/authz, validates input boundaries, signs off on tokens/secrets/admin fields.|
| docker-compose, CI/CD, env vars, health, observability, Redis ops  | senior-devops-expert    | Owns docker-compose, CI workflows, deploy strategy, env/secrets, monitoring, prod readiness. |
| Bruno collection sync after schema/resolver/env/auth changes       | bruno-collections-curator | Owns `.bru` files in `bruno/`. Keeps requests, variables, auth headers, response examples in sync with subgraph schemas. |
| Codebase search, file/symbol lookup, "where is X"                  | Explore                 | —                                                                                      |
| Claude Code CLI, Agent SDK, Anthropic API questions                | claude-code-guide       | —                                                                                      |

Fallback to `general-purpose` only when no specialist fits.

### Workflow (post-/plan approval)

1. **architect** splits approved plan into per-agent tasks → posts dispatch list → waits for approval.
2. Independent tasks run in parallel (one message, multiple Agent calls); sequential when an
   agent's output feeds the next (e.g. db schema → backend repo). Never run two agents that
   write to the same files concurrently.
3. **architect** runs `/ultrareview`, routes findings back to the owning agent, marks done only
   when no blocking findings remain.

### Agent → Skills composition

Each agent composes a fixed set of Claude Code skills. Scope restrictions prevent two agents
from invoking the same skill with conflicting intent.

| Agent                   | Primary skills                                              | Scope restriction                                |
|-------------------------|-------------------------------------------------------------|--------------------------------------------------|
| microservices-architect | `senior-architect`, `database-architect`, `senior-security`, `code-review` | DB: design decisions only, not schema/indexes. Security: threat modeling only, not pentest. |
| backend-expert          | `senior-backend`, `verify`, `run`, `code-review`            | No auth/authz decisions — escalate to security-analyst. |
| database-expert         | `database-architect` (owner), `senior-backend`              | `senior-backend`: query context only.            |
| security-analyst        | `senior-security` (owner), `security-review`, `code-review` | Owns all auth/authz/pentest decisions.           |
| senior-devops-expert    | `senior-devops` (owner), `code-review`                      | No application logic or DB schema — escalate.    |
| bruno-collections-curator | `code-review`                                             | Only touches `bruno/`. Triggered by upstream schema/resolver/env/auth changes. |

Shared skills (`database-architect`, `senior-backend`) are split by phase: architect uses them
pre-implementation (design), specialists use them during/post-implementation (build, audit).

---

## Dev Commands

pnpm run docker:up            # start full stack (postgres, redis, all services)
pnpm run docker:down          # stop stack (preserve volumes)
pnpm run docker:reset         # stop + wipe volumes (resets all databases)
pnpm run type-check           # tsc --noEmit across all services
pnpm run test                 # jest across all services
pnpm run lint                 # eslint across all services
pnpm run build                # compile all services
pnpm exec nx test <svc>       # single service: nx test product-service
pnpm exec nx type-check <svc>
pnpm exec nx build <svc>
pnpm exec prisma generate     # regenerate @hbs/prisma client after schema changes
                              # run from libs/prisma/: cd libs/prisma && pnpm exec prisma generate
