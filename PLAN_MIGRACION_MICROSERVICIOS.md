# Plan de Migración a Microservicios (Monorepo) — Happy Baby Style Backend

> Documento vivo. Marcamos cada item del checklist a medida que avanzamos.
> Última actualización: 2026-05-25 (Fase 4.4 completada)

## Contexto

Hoy el backend es un **monolito** Node.js + TypeScript con Express + Apollo GraphQL y Prisma sobre una única PostgreSQL (40+ tablas), bien estructurado en Clean Architecture (domain / application / infrastructure / presentation). Todo corre en un solo proceso (puerto 3001), con un único contenedor de DI (`src/shared/container.ts`), una sola DB con FKs cruzadas, y despliegue manual (PM2 + Nginx + EC2, sin Docker ni CI/CD).

Objetivo: migrar **incrementalmente** (patrón Strangler) a microservicios en un **monorepo Nx**, comunicados vía **Apollo Federation**, empezando con **base de datos compartida** (separada lógicamente por dominio) y un **entorno de desarrollo en Docker Compose**. El monolito sigue vivo (`apps/legacy-api`) mientras se le arrancan servicios uno por uno.

**Decisiones confirmadas:**
- Monorepo: **Nx** (con pnpm)
- Comunicación/API: **Apollo Federation v2** (subgraph por servicio + gateway; el frontend sigue usando un solo `/graphql`)
- Datos: **shared DB primero** → **DB-por-servicio después**
- Runtime dev: **Docker Compose local** (Postgres + Redis + servicios + gateway)

---

## 1. Stack ACTUAL

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Lenguaje | TypeScript (CommonJS, ES2020) | 5.3.2 |
| Runtime | Node.js (sin pin) | — |
| HTTP | Express | 4.18.2 |
| API | Apollo Server + GraphQL | 4.11.2 / 16.8.1 |
| ORM / DB | Prisma + PostgreSQL (`pg`) | 6.13.0 / 8.16.3 |
| Auth | jsonwebtoken + bcrypt + Google OAuth | 9.0.2 / 6.0.0 |
| Uploads | multer + graphql-upload-cjs | — |
| Logging | Winston (+ daily-rotate) | 3.11.0 |
| Email | Nodemailer (SMTP Hostinger) | 7.0.10 |
| Optimización | DataLoader (anti N+1) | 2.2.3 |
| Testing | Jest + ts-jest + supertest | 29.7.0 |
| Codegen | @graphql-codegen/cli | 5.0.0 |
| Lint/Format | **No existe** | — |
| Contenedores | **No existe** | — |
| CI/CD | **No existe** (deploy manual) | — |
| Infra prod | EC2 + Nginx + PM2 + Let's Encrypt; dev usa AWS RDS | — |

**Dominios (candidatos a servicio):** Product, Category, User/Auth (~17 use-cases), Order, Image/SVG. En schema además: pagos, reviews, inventario, cupones, loyalty, notificaciones.

**Acoplamientos a resolver:** DB única con FKs cruzadas · DI container único (60+ deps) · llamada síncrona Order→Product (validación de stock) · pipeline Express/Apollo compartido.

---

## 2. Stack DESTINO

**Se conserva:** TypeScript, Apollo Server, GraphQL, Prisma, PostgreSQL, JWT/bcrypt, Winston, Jest, DataLoader.

**Se incorpora (en orden):** 1) Nx · 2) pnpm · 3) Docker + Docker Compose · 4) Apollo Federation v2 · 5) Redis · 6) ESLint + Prettier · 7) GitHub Actions (CI/CD).

---

## 3. Entorno de desarrollo a configurar

- Node 18+ fijado con `.nvmrc` (+ `engines`)
- pnpm (`corepack enable`)
- Nx CLI
- Docker Desktop (Compose v2)
- Apollo Rover CLI (componer/validar supergraph)
- `psql` + Prisma CLI (ya está)
- Redis vía Docker
- VS Code: Nx Console, Prisma, ESLint, GraphQL

---

## 4. CHECKLIST DE MIGRACIÓN

> Lo resolvemos uno por uno, en conjunto. `[x]` = hecho · `[~]` = en progreso · `[ ]` = pendiente.

### FASE 0 — Preparación y seguridad
- [ ] **0.1** Rotar (opcional, higiene) credenciales reales de RDS/SMTP/JWT. *Nota: `.env*` están gitignored y nunca se commitearon — el repo está limpio; solo existen en texto plano localmente.* → acción del usuario en AWS/Hostinger.
- [x] **0.2** Arreglar `.gitignore` (`!env.template` → `!.env.template`, limpieza de entradas muertas) y dejar `.env.template` versionable. ✓ 2026-05-24 — verificado con `git add --dry-run`: el template es versionable y los `.env` reales siguen bloqueados. *(Pendiente commitear `.env.template` cuando se haga el commit.)*
- [x] **0.3** Pin de Node: `.nvmrc` (`22`) + `engines: "node": ">=22 <23"` en package.json. ✓ 2026-05-24 — Node 22 LTS.
- [x] **0.4** Baseline de migraciones Prisma (antes solo había README → riesgo de drift). ✓ 2026-05-25.
  - [x] Paso 1 (offline, sin DB): generado `prisma/migrations/0_init/migration.sql` (41 tablas, 11 enums, 39 FKs) + `prisma/migrations/migration_lock.toml`.
  - [x] Paso 2: aplicado en la **DB local de Docker** (`postgres:16-alpine`, `happy_baby_style`) vía `migrate deploy`; `0_init` registrado en `_prisma_migrations` y `migrate status` → "Database schema is up to date!" (sin drift).
  - [ ] Pendiente (fuera de dev local): baselinear **RDS dev** y **prod (EC2)** cuando sean alcanzables. Como esas DB ya tienen el schema (vía `db push`), ahí el comando es `npx prisma migrate resolve --applied 0_init` (NO `deploy`). Verificar antes con `npx prisma migrate status`.
- [x] **0.5** ESLint 9 (flat config) + typescript-eslint + Prettier. ✓ 2026-05-24 — `eslint.config.js`, `.prettierrc`, `.prettierignore`; scripts `lint`/`lint:fix`/`format`/`format:check`. Baseline no estricto (hallazgos heredados = warning) → `npm run lint` pasa en verde. Pendiente: correr `npm run format` para formatear el código existente (diff grande, sin hacer aún).

### FASE 1 — Fundación del monorepo Nx
- [x] **1.1** Inicializar workspace Nx con pnpm. ✓ 2026-05-25.
  - [x] Migración npm → pnpm: pnpm 11 instalado; `.npmrc` con `node-linker=hoisted` (node_modules plano estilo npm para evitar TS2742 por dependencias fantasma); `pnpm-workspace.yaml` con `packages: [apps/*, libs/*]` + `allowBuilds` (bcrypt, prisma, @prisma/*, @apollo/protobufjs, nx); `package-lock.json` eliminado, `pnpm-lock.yaml` generado. Fix TS2742 puntual: anotación `const app: express.Express` en `src/index.ts`. Commit `30d859b`.
  - [x] `nx init` (v22.7.3, no-interactivo, sin Nx Cloud, sin plugins): crea `nx.json` (caché para build/test/lint/type-check), añade `nx` a devDeps, ignora `.nx/cache` en `.gitignore`. `nx show projects` = `[]` (esperado: aún no hay `apps/`/`libs/`). `type-check` sigue limpio.
- [x] **1.2** Mover el monolito a `apps/legacy-api/` sin cambiar su lógica. ✓ 2026-05-25.
  - `git mv` de `src/`, `tests/`, `tsconfig*.json`, `jest.config.js`, `codegen.yml` → `apps/legacy-api/`. `prisma/`, `.env*`, `scripts/`, `docs/`, `logs/`, `uploads/`, `docker-compose.yml` quedan en la raíz (workspace). Deps siguen en el `package.json` raíz (single-version, pnpm hoisted).
  - `apps/legacy-api/project.json` con targets Nx (`build`, `type-check`, `test`, `lint`, `codegen`, `serve`) vía `nx:run-commands` envolviendo el tooling existente (tsc/jest/eslint/codegen/ts-node-dev). Scripts raíz de `package.json` redirigidos a `nx ... legacy-api`; `eslint.config.js` globs → `apps/**`; `scripts/dev-server.js` apunta a la nueva ruta con `TS_NODE_PROJECT`.
  - Verificado: `nx type-check`, `nx build` (genera `apps/legacy-api/dist/src/index.js`) y `nx lint` en verde.
  - Tests: el move **no introdujo regresiones** — baseline pre-move (`4e6528c`) = 18 suites/129 tests fallando, idéntico al post-move. Fix incluido: `@config/*` faltaba en el `moduleNameMapper` de jest (bug preexistente) → ahora 15 suites pasan (antes 13). Quedan **143 fallos preexistentes** (mocks, p. ej. `RateLimitService.startTimer`) sin relación con la migración → tratar como deuda aparte.
- [~] **1.3** Extraer libs compartidas a `libs/`. Convención de alias: **`@hbs/<lib>`** (paquetes pnpm del workspace; cada lib compila a su `dist`, el app la consume vía node_modules; `tsconfig.base.json` registra el path; cada app declara `implicitDependencies` + `dependsOn: ["^build"]`).
  - [x] `libs/shared-kernel` (`@hbs/shared-kernel`): BaseResponse, ResponseCodes, ResponseFactory. ✓ 2026-05-25. Imports del app actualizados (alias `@shared/*` y relativos `../../shared/*`); mapper de jest → fuente. Verificado: `nx build/type-check/lint legacy-api` verdes, test afectado pasa. **`UrlBuilder` NO se movió**: depende de `@config/storage` (config del app) → requiere desacople antes de extraerlo.
  - [x] `libs/logging` (`@hbs/logging`): Winston wrapper (LoggerConfig, LoggerFactory, LoggingDecorator, PerformanceLogger, RequestLogger, WinstonLogger) + el contrato `ILogger` (movido desde `domain/interfaces`). ✓ 2026-05-25. ~56 archivos actualizados (`@infrastructure/logging/*`, `@domain/interfaces/ILogger` y rutas relativas → `@hbs/logging`). `WinstonLogger` desacoplado de `DomainError` (chequeo estructural en vez de `instanceof`). Verificado: `nx build/type-check/lint legacy-api` verdes, test afectado pasa.
  - [x] `libs/auth` (`@hbs/auth`): tipos compartidos de auth (`AuthUser`, `UserRole`, `Permission`, `TokenPayload`) + utilidad pura `extractTokenFromAuthHeader`. ✓ 2026-05-24. `AuthService` refactorizado para importar tipos desde `@hbs/auth` y re-exportarlos (consumidores no cambian). `JwtAuthService` y `GoogleOAuthService` permanecen en el app (dependen de repositorio/dominio). `nx build legacy-api` verde.
  - [x] `libs/prisma` (`@hbs/prisma`): PrismaService + schema.prisma + migrations movidos desde raíz. ✓ 2026-05-24. `prisma.config.ts` en raíz configura la nueva ruta; `PrismaService` desacoplado de `environment` (usa `process.env` directo); app re-exporta desde thin wrapper en `@infrastructure/database/prisma`. Verificado: `nx build legacy-api`, `type-check` y `prisma migrate status` en verde.
- [x] **1.4** Configurar `tsconfig` paths y validar `nx graph`. ✓ 2026-05-25 — `nx graph` muestra 5 proyectos (1 app + 4 libs) con dependencias correctas. `tsconfig.base.json` y `tsconfig.production.json` tienen todos los paths `@hbs/*` configurados para compilación y runtime respectivamente.

### FASE 2 — Contenerización (Docker Compose)
- [x] **2.1** Dockerfile base multi-stage para apps Node/TS. ✓ 2026-05-25 — stage `builder` (pnpm install + nx build) y stage `runner` (node_modules + dist + libs/*/dist). Fix clave: schema Prisma copiado antes de `pnpm install` para que `@prisma/client` postinstall genere el cliente con el schema correcto.
- [x] **2.2** `docker-compose.yml` con `postgres`, `redis`, `legacy-api` (healthchecks + env por servicio). ✓ 2026-05-25 — postgres:16, redis:7-alpine, legacy-api con `env_file: .env` + override de `DATABASE_URL` y `REDIS_URL` al network interno Docker.
- [x] **2.3** `.dockerignore` y scripts up/down/logs. ✓ 2026-05-25 — `.dockerignore` excluye node_modules, dist, .env, logs, uploads.
- [x] **2.4** Validar que el monolito corre idéntico dentro de Docker. ✓ 2026-05-25 — `GET /health` → `{"status":"OK"}` y `{ health }` GraphQL query responden correctamente desde el contenedor. Fix runtime: `tsconfig.production.json` sobreescribe `@hbs/*` paths a `dist/` (tsconfig-paths seguía extends y cargaba `.ts` sources desde `tsconfig.base.json`).

### FASE 3 — Gateway de Federation
- [x] **3.1** Convertir `legacy-api` en subgraph federado (`@apollo/subgraph`). ✓ 2026-05-25 — `buildSubgraphSchema([{ typeDefs, resolvers }])` en `server.ts`. Sin cambios en schema ni resolvers; `_service { sdl }` responde automáticamente.
- [x] **3.2** Crear `apps/gateway/` (Apollo Gateway/Router). ✓ 2026-05-25 — `apps/gateway/src/index.ts` con `ApolloGateway` + `IntrospectAndCompose` (no requiere Apollo Studio). `AuthenticatedDataSource` reenvía el header `Authorization` al subgraph. Proyecto Nx con targets build/type-check/serve. `Dockerfile.gateway` separado (imagen ~150MB vs ~800MB del legacy).
- [x] **3.3** Composición del supergraph con Rover. ✓ 2026-05-25 — `supergraph.yaml` en raíz; script `rover:compose` en package.json. Para CI: `rover supergraph compose --config supergraph.yaml`. En dev: `IntrospectAndCompose` compone al arrancar.
- [x] **3.4** Auth forwarding a nivel gateway. ✓ 2026-05-25 — `AuthenticatedDataSource.willSendRequest` reenvía `Authorization: Bearer <token>` del cliente al subgraph. Auth logic y rate-limit permanecen en `legacy-api` (hub único); se migrarán al gateway cuando haya múltiples subgraphs.

**Verificación Fase 3:** `docker compose ps` → 4 contenedores healthy (postgres, redis, legacy-api:3001, gateway:4000). `POST :4000/graphql { health }` → `"GraphQL server is running with clean architecture!"` a través del gateway.

### FASE 4 — Extracción incremental de servicios (Strangler)
- [x] **4.1** `category-service` (piloto end-to-end). ✓ 2026-05-25
  - [x] `apps/category-service/` creado con Clean Architecture completa: `domain/entities`, `domain/errors`, `domain/repositories`, `application/use-cases` (6 use cases), `infrastructure/repositories`, `graphql/` (schema + resolvers + transformer).
  - [x] **Federation subgraph:** `buildSubgraphSchema` con `@key(fields: "id")` en `type Category` y `__resolveReference` para resolución cross-service.
  - [x] **Sin acoplamiento a legacy:** imports completamente relativos (sin aliases `@domain/*` ni `@hbs/*` dentro del app); `STORAGE_BASE_URL` leído de `process.env` directamente (sin `@config/storage`).
  - [x] **Patrón tsconfig crítico descubierto:** cada app DEBE declarar `"baseUrl": "./"` en su propio `tsconfig.json` para que los paths `@hbs/*` fallen a resolver a `node_modules/@hbs/*` (symlinks → `dist/*.d.ts`) en vez de a los fuentes de `libs/` (que dispara TS6059 "not under rootDir"). Sin este override, TypeScript hereda la `baseUrl` de la raíz del workspace y resuelve correctamente los fuentes → error en compilación.
  - [x] **`project.json`:** `implicitDependencies` usa **nombres de proyecto Nx** (`"logging"`, `"prisma"`, `"shared-kernel"`), NO los nombres de paquete npm (`@hbs/...`). Error descubierto y corregido.
  - [x] **`legacy-api` limpiado de Category:** schema.ts (tipos, inputs, responses de categoría eliminados; `type Category` reducido a stub `@key(fields: "id") { id: ID! }`); resolvers.ts (todas las resolvers de categoría eliminadas; `Product.category` ahora retorna `{ __typename: 'Category', id: categoryId }` → gateway enruta al category-service); `container.ts` (PrismaCategoryRepository + 6 use cases eliminados).
  - [x] **Gateway y Docker actualizados:** `apps/gateway/src/index.ts` con segundo subgraph `category-service`; `docker-compose.yml` con servicio `category-service` (puerto 3002, healthcheck); `supergraph.yaml` con entrada `category`; `.env.template` con `CATEGORY_SERVICE_PORT=3002`.
  - [x] **Build limpio:** `nx build` en verde para los 3 proyectos (legacy-api, gateway, category-service) + 4 libs dependientes.
  - **Acoplamiento cruzado resuelto:** `Category.products` (cross-domain) diferido a Fase 4.2 cuando se extraiga product-service. Por ahora, category-service no expone `products`.
- [x] **4.2** `product-service`. ✓ 2026-05-25
  - [x] `apps/product-service/` con Clean Architecture completa: entidades simplificadas (sin CategoryEntity), 5 use-cases (get, getById, create, update, delete), PrismaProductRepository (sin `include: { category: true }` — ya no se necesita el JOIN), transformer con URL builder inline.
  - [x] **Federation subgraph:** `type Product @key(fields: "id")` con `__resolveReference`. `Product.category` retorna `{ __typename: 'Category', id: parent.categoryId }` → gateway enruta a category-service. `type Category @key(fields: "id") { id: ID! }` como entidad externa.
  - [x] **Queries migradas desde legacy-api:** `products`, `product`, `productBySku`, `productsByCategory`, `searchProducts`, `productVariants`, `productVariant`, `productStats`, `lowStockProducts`, `outOfStockProducts`.
  - [x] **Mutations migradas:** `createProduct`, `updateProduct`, `deleteProduct`, `createProductVariant`, `updateProductVariant`, `deleteProductVariant`, `bulkUpdateProducts`.
  - [x] **legacy-api limpiado:** `type Product` reducido a stub `@key(fields: "id") { id: ID! }`, igual para `ProductVariant`. Eliminados todos los input types, response types y resolvers de producto. Imports de use-cases de producto eliminados. Se conserva `getProductsUseCase` en el container para `dashboardMetrics` (agrega conteos cross-domain).
  - [x] **Gateway y Docker actualizados:** tercer subgraph `product-service` en `IntrospectAndCompose`; servicio `product-service` en docker-compose (puerto 3003); `supergraph.yaml` extendido; `.env.template` con `PRODUCT_SERVICE_PORT=3003`; `Dockerfile.product-service`.
  - [x] **Build limpio:** `nx build` verde para los 4 proyectos (legacy-api, gateway, category-service, product-service).
- [x] **4.3** `media-service` (Image/SVG, uploads + storage, puerto 3004). Completado 2026-05-25.
  - [x] **Entidades y dominio:** `ImageEntity`, `SvgEntity`, `ImageEntityType`, `SvgEntityType`, `StorageError`, `DomainError` copiados con rutas relativas (sin alias `@domain/*`).
  - [x] **Application layer:** `UploadImageUseCase` (resuelve Promise de graphql-upload, lee stream a buffer, valida y sube), `UploadSvgUseCase` (lee stream, sanitiza, extrae metadata, sube). `storageConfig` inlineado desde `process.env` (sin `@config/storage`). `SvgValidationService` copiado (420 líneas, autocontenido). `FileValidationService` copiado.
  - [x] **Infrastructure:** `PrismaImageRepository`, `PrismaSvgRepository` (ambos escriben en tabla `image` de la DB compartida, los SVGs se distinguen por mimeType). `LocalStorageService` adaptado con `storageConfig` inlineado.
  - [x] **Federation subgraph:** `type Image @key(fields: "id")` y `type Svg @key(fields: "id")` con `__resolveReference`. Mutations: `uploadImage`, `uploadSvg`, `deleteImage`, `deleteSvg`. Queries: `image`, `imagesByEntity`, `svg`, `svgsByEntity`, `svgs`, `svgsCount`. Scalar `Upload` definido en el subgraph.
  - [x] **legacy-api limpiado:** `type Image` y `type Svg` reducidos a stubs `@key(fields: "id") { id: ID! }`. Eliminados `SvgDimensions`, `UploadImageResponse`, `UploadImageData`, `UploadSvgResponse`, `UploadSvgData`, `scalar Upload`, mutations `uploadImage`/`uploadSvg`. Container sin `imageRepository`, `svgRepository`, `storageService`, `uploadImageUseCase`, `uploadSvgUseCase`.
  - [x] **Gateway y Docker actualizados:** cuarto subgraph `media-service` en `IntrospectAndCompose`; servicio `media-service` en docker-compose (puerto 3004, volume `./uploads:/workspace/uploads`); `supergraph.yaml` extendido; `.env.template` con `MEDIA_SERVICE_PORT=3004`; `Dockerfile.media-service`.
  - [x] **Build y type-check limpios:** `nx run media-service:build` y `nx run legacy-api:type-check` verdes.
- [x] **4.4** `order-service` (puerto 3005). Completado 2026-05-25.
  - [x] **Hexagonal port:** `IProductValidationPort` rompe el acoplamiento síncrono `CreateOrderUseCase → IProductRepository`. `HttpProductValidationAdapter` llama a product-service vía GraphQL con `fetch` nativo (Node 22).
  - [x] **Async stock decrement:** `IEventPublisher` + `RedisEventPublisher` (ioredis) publica en canal `order:created`. product-service puede suscribirse para decrementar stock de forma asíncrona. Event publish failure es no-fatal.
  - [x] **Federation subgraph:** `type Order @key(fields: "id")`, `type OrderItem @key(fields: "id")`. Scalars: `Decimal`, `DateTime`, `JSON`. Queries: `orders`, `order`, `ordersByStatus`, `orderStats`. Mutations: `createOrder`, `updateOrder`, `updateOrderStatus`, `bulkUpdateOrderStatus`. User/Product como stubs de Federation.
  - [x] **legacy-api limpiado:** `type Order` y `type OrderItem` reducidos a stubs `@key(fields: "id") { id: ID! }`. `OrderTracking` eliminado. Inputs `CreateOrderInput`, `UpdateOrderInput`, `CreateOrderItemInput`, `OrderFilterInput`, `PaginatedOrders` eliminados. Queries `orders`, `order`, `orderByNumber`, `userOrders`, `orderItems`, `orderTracking`, `orderTransactions` eliminados. Mutations `createOrder`, `updateOrder`, `updateOrderStatus`, `cancelOrder`, `shipOrder`, `deliverOrder`, `createOrderItem`, `updateOrderItem`, `deleteOrderItem`, `applyCoupon`, `removeCoupon`, `bulkUpdateOrderStatus` eliminados. Container sin `createOrderUseCase`, `getOrdersUseCase`, `getOrderByIdUseCase`, `updateOrderUseCase`. Se conserva `orderRepository` + `getOrderStatsUseCase` para `dashboardMetrics` y `orderAnalytics`.
  - [x] **Gateway y Docker actualizados:** quinto subgraph `order-service` en `IntrospectAndCompose`; servicio `order-service` en docker-compose (puerto 3005, depends_on postgres+redis, `PRODUCT_SERVICE_URL: http://product-service:3003/graphql`); `supergraph.yaml` extendido; `.env.template` con `ORDER_SERVICE_PORT=3005`; `Dockerfile.order-service`.
  - [x] **Build y type-check limpios:** `nx run order-service:build` y `nx run legacy-api:type-check` verdes.
- [x] **4.5** `user-service` (auth, addresses, sessions, analytics) — el hub, al final.
  - [x] `apps/user-service/` con dominio completo: User, UserProfile, UserAddress, Auth, AuditLog, SecurityEvent.
  - [x] 22 use cases + 4 repositorios Prisma + NodemailerEmailService + JwtAuthService.
  - [x] `schema.ts` con federation `@key(fields: "id")` en User/UserProfile/UserAddress; Order/Product como stubs.
  - [x] `resolvers.ts` con `createResolvers(deps)` factory; `__resolveReference` para los 3 tipos propios.
  - [x] `index.ts` en puerto 3006; StubUserOrderRepository para `GetUserOrderHistoryUseCase` (cross-domain).
  - [x] `Dockerfile.user-service`, entrada en `docker-compose.yml`, `supergraph.yaml`, `gateway/src/index.ts`, `.env.template`.
  - [x] legacy-api limpiada: User/UserProfile/UserAddress → stubs `@key`; eliminadas todas las queries/mutations de usuario y auth.
  - [x] **Build y type-check limpios:** `nx run user-service:build` y `nx run legacy-api:type-check` verdes.
- [ ] **4.6** Retirar de `legacy-api` cada dominio migrado hasta vaciarlo.

### FASE 5 — Separación de bases de datos
- [ ] **5.1** Pasar cada dominio de schema lógico a su propia DB.
- [ ] **5.2** Romper FKs cruzadas; referencias por ID + resolución vía Federation.
- [ ] **5.3** Consistencia eventual (patrón Outbox + eventos sobre Redis/broker).
- [ ] **5.4** Migrar datos por dominio con scripts versionados y verificación.

### FASE 6 — CI/CD y despliegue
- [ ] **6.1** GitHub Actions con `nx affected` (lint + test + build).
- [ ] **6.2** Build y push de imágenes Docker por servicio.
- [ ] **6.3** Definir target de despliegue prod (AWS ECS/Fargate o K8s) y reemplazar deploy manual.
- [ ] **6.4** Gestión de secretos en prod (AWS Secrets Manager / SSM).

---

## 5. Archivos críticos

- `package.json`, `tsconfig*.json`, `jest.config.js`, `codegen.yml` → reorganizados bajo Nx.
- `src/index.ts` → base de `apps/legacy-api` y `apps/gateway`.
- `src/shared/container.ts` → DI único; se descompone por servicio.
- `src/graphql/schema.ts` + `resolvers.ts` → se parten por dominio hacia subgraphs.
- `prisma/schema.prisma` → a `libs/prisma`; luego se divide por servicio (Fase 5).
- `src/infrastructure/repositories/*` y `src/application/use-cases/*` → se reparten por servicio.

---

## 6. Verificación por fase

- **Fase 0:** sin secretos versionados; `prisma migrate status` sin drift; `eslint .` limpio.
- **Fase 1:** `nx graph` correcto; `nx build/test legacy-api` pasan.
- **Fase 2:** `docker compose up` levanta todo; `/health` responde; GraphQL igual que antes.
- **Fase 3:** gateway responde en `/graphql` componiendo el subgraph; frontend sin cambios.
- **Fase 4:** dominio migrado responde vía gateway; tests verdes; `legacy-api` ya no lo sirve.
- **Fase 5:** cada servicio con su DB; flujo async (orden → evento → stock) verificado.
- **Fase 6:** PR de un servicio dispara solo su build/test (`nx affected`); imagen publicada.

> Regresión transversal en cada fase: `npm run test` y las queries/mutations clave del schema GraphQL deben responder idénticamente desde el frontend.
