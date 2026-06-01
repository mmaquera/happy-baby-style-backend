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
  @hbs/auth          JWT extraction & types (TokenPayload, UserRole, Permission)
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
Auth plugin in every subgraph guards all mutations: throw UNAUTHENTICATED if !currentUser.
Every subgraph must process.exit(1) at startup if JWT_SECRET is not set.

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

After completing a task, proactively flag (one bullet, do NOT implement unless asked):

Architecture smells:
- Use case with >1 responsibility → suggest split
- Repository returning raw Prisma types to domain → suggest entity mapping
- Service importing directly from another service's source → suggest port/adapter or event

Performance:
- N+1 in resolvers → suggest DataLoader
- Unbounded list query → suggest pagination
- Heavy sync work in request path → suggest async background job

Resilience:
- HTTP call without timeout → suggest axios with timeout config
- Event consumer without dead-letter handling → suggest DLQ stream

Security:
- Resolver exposing admin fields without role check → flag explicitly
- User input reaching use case without validation → suggest guard at application boundary

Format: "Improvement opportunity: [what] — [why/risk]"

---

## Claude Code Skills — Use on Every Request

Use the available skills at the start of every prompt/request, not just when explicitly asked.

  /plan         → ALWAYS before implementing anything non-trivial.
                  New service, new use case, schema change, event contract, cross-service flow,
                  adding a shared lib feature, or any change touching >2 files.
  /ultrareview  → ALWAYS after completing an implementation.
                  Run on the current branch (or /ultrareview <PR#> for a GitHub PR) before
                  considering the task done. Catches architecture violations, missed edge cases,
                  security issues, and pattern inconsistencies.

Default behavior for every user request:
  1. If the request requires writing or changing code → invoke /plan first.
  2. Implement once the plan is approved.
  3. After implementation → invoke /ultrareview.
  4. Address any findings from the review before reporting the task as complete.

Never skip /plan for cross-service changes (event contracts, federation schema, shared libs).
Never skip /ultrareview before marking a feature or fix as done.

---

## Agent Orchestration

Project-defined agents must be used to execute approved plans. Dispatch is **consultive**:
before launching agents, list which ones will run, in what order, and wait for approval.

### Routing table

| Trigger                                                                 | Agent                   |
|-------------------------------------------------------------------------|-------------------------|
| /plan, /ultrareview, cross-service design, federation, supergraph       | microservices-architect |
| Use cases, resolvers, repositories, adapters, messaging, refactors      | backend-expert          |
| Prisma schema, migrations, indexes, N+1, query optimization             | database-expert         |
| Auth flows, authz, threat modeling, crypto, file upload risk, RBAC      | security-analyst        |
| Codebase search, file/symbol lookup, "where is X" questions             | Explore                 |
| Questions about Claude Code CLI, Agent SDK, or Anthropic API            | claude-code-guide       |

Fallback to `general-purpose` only when no specialist fits.

### Per-agent responsibility on plan execution

- **microservices-architect** — owns the plan. Splits approved plan into tasks, assigns each
  task to the owning specialist, runs `/ultrareview` at the end, decides re-work.
- **backend-expert** — implements application/infrastructure/graphql layers for assigned tasks.
  Writes Jest tests for every new use case. Must not touch Prisma schema directly.
- **database-expert** — owns Prisma schema, migrations, indexes, and repository query shape.
  Hands back typed repository interface + impl to backend-expert.
- **security-analyst** — gates auth/authz, validates input boundaries, signs off on any task
  touching tokens, secrets, uploads, or admin fields before merge.

### Workflow (post-/plan approval)

1. **architect** splits the approved plan into per-agent tasks and posts the dispatch list.
2. **Wait for user approval of the dispatch list** (consultive mode).
3. Run independent tasks in parallel — single message, multiple Agent tool uses:
   - schema/migration → **database-expert**
   - use cases/resolvers/repos → **backend-expert**
   - auth/authz/threat surface → **security-analyst**
4. **architect** runs `/ultrareview` on the merged result.
5. Any finding is routed back to the owning agent (backend / db / security) for the fix.
6. Task is done only after `/ultrareview` reports no blocking findings.

### Parallelization rules

- Independent agents → parallel (one message, multiple Agent calls).
- Sequential when an agent's output is the next agent's input (e.g. db schema → backend repo).
- Never run two agents that write to the same files concurrently.

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
