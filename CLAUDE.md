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

## Odoo-Aligned Design Framework (apply to EVERY feature)

Este proyecto está **inspirado en Odoo** no solo en RBAC, sino como filosofía de diseño tipo ERP.
Todo `/plan` y todo análisis de implementación debe pasar por esta lente **antes** de escribir código.
No todos los conceptos aplican a todo feature — pero cada uno debe ser **considerado y descartado conscientemente**, no ignorado.

### Mapa conceptual: Odoo → este monorepo

| Concepto Odoo                     | Equivalente aquí / cómo aplicarlo                                                                 | Cuándo es obligatorio                                              |
|-----------------------------------|---------------------------------------------------------------------------------------------------|-------------------------------------------------------------------|
| `res.groups` + `ir.model.access`  | `groups` + `group_permissions` (`verb:noun`) — acceso a **nivel modelo** (CRUD)                   | Todo entity nuevo expuesto por GraphQL                            |
| `ir.rule` (record rules)          | `record_rules.domain_expr` + `RecordRuleResolver` — acceso a **nivel fila**                       | Todo entity con dueño/scoping (orders, media, reviews…)          |
| `domain` (lenguaje de filtros)    | `compileDomainExpr` (Zod, `@hbs/authz`) — usar el **mismo lenguaje** para filtros, no solo authz  | Cualquier filtrado declarativo reutilizable                      |
| `state` + transiciones controladas| Máquina de estados explícita (enum snake_case) + transición centralizada en use-case             | Todo entity con ciclo de vida (order, payment, shipment, review) |
| `ir.sequence`                     | Generador de folios legibles (`ORD-2026-000123`), gap-tolerant, por servicio                      | Todo documento de negocio visible al usuario                     |
| `mail.thread` / chatter / tracking| Audit trail: quién/cuándo/qué cambió (tabla audit o evento de dominio)                            | Entities sensibles (orders, pagos, permisos, precios)            |
| `ir.cron` (scheduled actions)     | Jobs recurrentes (cron/Redis): reconciliación stock, carritos abandonados, limpieza de tokens     | Trabajo diferido o periódico — nunca en el request path          |
| campos `computed`/`stored`        | Valores derivados (total de orden, disponibilidad): decidir compute-on-read vs stored+invalidado  | Cualquier dato derivado consultado con frecuencia                |
| `res.company` (multi-company)     | `tenant_id`/`company_id` en cada modelo, auto-inyectado vía record rule con `$ctx`                | Si/ cuando aparezca multi-tenant                                 |
| `res.config.settings`            | Configuración centralizada / feature flags por servicio (no env vars dispersas)                   | Comportamiento conmutable por entorno o tenant                   |
| `@api.constrains` / SQL constraints| Invariantes de dominio en entity/use-case **y** en DB — lanzar `DomainError` tipado              | Toda regla de negocio invariable                                 |
| Wizards (transient models)        | Operaciones multi-paso / mass actions modeladas explícitamente (import masivo, acción en lote)    | Flujos de varios pasos o acciones masivas                        |
| Approvals / activities            | Paso de aprobación antes de acciones sensibles (reembolsos, descuentos altos, borrados)           | Acciones de alto impacto o irreversibles                         |
| `@api.onchange`                   | Validación/derivación reactiva en el boundary (resolver/use-case), no en el cliente               | Inputs con dependencias entre campos                             |

### Checklist obligatorio por feature (responder en el `/plan`)

**1. Acceso en dos capas (siempre)**
- [ ] ¿Qué **permisos `verb:noun`** (nivel modelo) autorizan la operación?
- [ ] ¿Necesita **record rule** (nivel fila)? Si lee/lista/muta datos con dueño → sí.
- [ ] ¿La regla se **propaga** a todos los subgraphs que la consumen (evento + snapshot-on-boot)?

**2. Ciclo de vida**
- [ ] ¿El entity tiene **estados**? Defínelos como enum snake_case y **centraliza las transiciones** (una sola puerta, no `status =` disperso).
- [ ] ¿Cada transición está **guardada** por permiso/grupo y **emite evento**?

**3. Identidad y trazabilidad del documento**
- [ ] ¿Necesita **folio legible** (`ir.sequence`) además del UUID?
- [ ] ¿Es sensible? → **audit trail** (quién/cuándo/qué) vía evento o tabla.

**4. Datos derivados y consistencia**
- [ ] ¿Hay **campos computados** (totales, disponibilidad)? Decide compute-on-read vs stored+invalidación.
- [ ] ¿Qué **invariantes** (`constrains`) protegen el modelo? Decláralas en use-case y DB.

**5. Trabajo diferido**
- [ ] ¿Algo debería ser **cron/scheduled** o **evento async** en vez de síncrono en el request path?

**6. Multi-tenant / configuración (futuro-proof)**
- [ ] ¿El modelo debería llevar **scoping** (`tenant_id`) desde ya para no migrar después?
- [ ] ¿El comportamiento es **conmutable** (feature flag/config) en lugar de hardcodeado?

### Regla de oro

> **Toda feature que lea, liste o mute datos con dueño debe responder 3 preguntas Odoo:**
> 1. ¿Qué **grupos/permisos** la autorizan? (nivel modelo)
> 2. ¿Necesita una **record rule**? (nivel fila)
> 3. ¿La regla y los eventos se **propagan** a todos los subgraphs que los consumen?
>
> Y antes de cerrar el plan: **¿hay estado, folio, auditoría, derivados, cron o scoping que Odoo modelaría y aquí estamos omitiendo?**

---

## Roadmap de Microservicios — alineado a Odoo

Servicios actuales cubren **catálogo + orden + usuario + media**. Faltan los que **cierran el ciclo de venta**
y los de **operación/omnicanal**. Cada servicio nuevo sigue "Adding a New Microservice" + el "Odoo-Aligned Design Framework".
Prioridad de adopción: **payment → invoicing → inventory → shipping → pos → resto según negocio.**

### Tier 1 — Cierran el ciclo de venta (crítico)

| Servicio              | Puerto | Módulo Odoo                  | Responsabilidad                                                                 | Eventos / conexión                          |
|-----------------------|--------|------------------------------|---------------------------------------------------------------------------------|---------------------------------------------|
| **payment-service**   | :3007  | `payment`, `payment_*`       | Cobros vía gateways (Culqi, Niubiz, MercadoPago, Stripe), reembolsos, webhooks  | consume `order.created` → emite `order.paid`|
| **invoicing-service** | :3008  | `account` + `l10n_pe_*`      | **Facturación electrónica SUNAT** (ver detalle abajo)                           | consume `order.paid` → emite `invoice.issued`|
| **shipping-service**  | :3009  | `stock_delivery`, `delivery_*`| Costos de envío, carriers, guías, tracking, estados de entrega                  | consume `order.paid` → emite `shipment.*`   |

### Tier 2 — Omnicanal y operaciones

| Servicio               | Puerto | Módulo Odoo        | Responsabilidad                                                                   |
|------------------------|--------|--------------------|-----------------------------------------------------------------------------------|
| **inventory-service**  | :3010  | `stock`            | Extraer de product-service: multi-almacén, reservas, movimientos, reabastecimiento, valuación |
| **pos-service**        | :3011  | `point_of_sale`    | Tienda física: sesiones de caja (apertura/cierre/arqueo), modo offline + sync, descuento de stock en tiempo real |
| **purchase-service**   | :3012  | `purchase`         | Órdenes de compra a proveedores, recepción de mercadería, costos                  |

### Tier 3 — Crecimiento y cliente

| Servicio                  | Puerto | Módulo Odoo                  | Responsabilidad                                                       |
|---------------------------|--------|------------------------------|----------------------------------------------------------------------|
| **promotions-service**    | :3013  | `loyalty`, `sale_loyalty`    | Cupones, listas de precios, descuentos, programas de lealtad/puntos   |
| **subscription-service**  | :3014  | `sale_subscription`          | Suscripciones recurrentes (caja mensual de bebé, club de pañales)     |
| **crm-service**           | :3015  | `crm`                        | Leads, oportunidades, segmentación de clientes                       |
| **notification-service**  | :3016  | `mail`, `sms`                | Extraer email de user-service: email/SMS/push transaccional + marketing, plantillas |

### Tier 4 — Soporte y contenido

| Servicio              | Puerto | Módulo Odoo         | Responsabilidad                                  |
|-----------------------|--------|---------------------|--------------------------------------------------|
| **helpdesk-service**  | :3017  | `helpdesk`          | Tickets, RMA/devoluciones, garantías             |
| **review-service**    | :3018  | rating/comments     | Extraer de product-service: reseñas + moderación (state machine) |
| **cms-service**       | :3019  | `website`, `blog`   | Banners, contenido, blog, landing pages          |
| **analytics-service** | :3020  | BI/reporting        | Dashboards, KPIs, reportes                        |

> Puertos sugeridos (3007+) — confirmar al implementar para evitar colisión en docker-compose y gateway.

### invoicing-service — Facturación Electrónica SUNAT (Perú)

**No es un módulo genérico**: es regulatorio y específico de SUNAT. Equivale a `l10n_pe_edi` en Odoo.

**Comprobantes a soportar:**
- **Factura** (serie `F001`, correlativo) — ventas con RUC.
- **Boleta de Venta** (serie `B001`) — consumidor final (DNI o sin documento).
- **Nota de Crédito** (`FC01`/`BC01`) — devoluciones, anulaciones, descuentos.
- **Nota de Débito** (`FD01`/`BD01`) — cargos adicionales, intereses.

**Requisitos técnicos (todos obligatorios):**
- **Formato UBL 2.1** (XML firmado) según especificación SEE de SUNAT.
- **Firma digital** con certificado digital (`.pfx`/PKCS#12) — **nunca** commitear el cert; va en secret manager.
- **Envío**: vía SEE-SOL, **OSE** (Operador de Servicios Electrónicos) o **PSE** — definir proveedor. Respuesta = **CDR** (Constancia de Recepción).
- **Series y correlativos** → usar el patrón `ir.sequence` del framework: gap-tolerant, **por serie**, persistente y atómico (nunca reusar correlativo).
- **Resumen Diario de Boletas (RC)** — job **cron** que agrupa boletas del día y las comunica a SUNAT.
- **Comunicación de Baja** — anulación de facturas (genera estado `voided` + XML de baja).
- **Catálogos SUNAT**: tipo de documento (01/03/07/08), unidad de medida, moneda (`PEN`/`USD`), tipo de afectación IGV.
- **IGV 18%** — cálculo de impuestos, base imponible, operaciones gravadas/exoneradas/inafectas.
- **Validación de RUC** (11 dígitos) / DNI (8 dígitos) en el boundary antes de emitir.

**Patrones Odoo aplicados (obligatorios para este servicio):**
- **Máquina de estados**: `draft → signed → sent → accepted | rejected | voided`. Transición centralizada, cada paso emite evento.
- **Audit trail completo**: quién emitió/anuló, timestamp, hash del XML, CDR — requerido para fiscalización.
- **Idempotencia fuerte**: un `order.paid` jamás debe generar dos comprobantes (InboxEvent + unique constraint en `order_id`).
- **RBAC**: emisión guarda por permiso `invoices:write`; anulación por grupo `accounting-manager`; record rule por sucursal/almacén si hay multi-local.

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
