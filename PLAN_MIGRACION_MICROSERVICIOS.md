# Plan de Migración a Microservicios (Monorepo) — Happy Baby Style Backend

> Documento vivo. Marcamos cada item del checklist a medida que avanzamos.
> Última actualización: 2026-05-26 (Fase 5 completada, 0.5 completada, Fase 6 reestructurada)

## Contexto

Hoy el backend era un **monolito** Node.js + TypeScript con Express + Apollo GraphQL y Prisma sobre una única PostgreSQL (40+ tablas), bien estructurado en Clean Architecture (domain / application / infrastructure / presentation). Todo corría en un solo proceso (puerto 3001), con un único contenedor de DI (`src/shared/container.ts`), una sola DB con FKs cruzadas, y despliegue manual (PM2 + Nginx + EC2, sin Docker ni CI/CD).

Objetivo: migrar **incrementalmente** (patrón Strangler) a microservicios en un **monorepo Nx**, comunicados vía **Apollo Federation v2**, con **una base de datos por servicio** y un **entorno de desarrollo en Docker Compose**. El monolito sigue vivo (`apps/legacy-api`) mientras se le arrancan servicios uno por uno.

**Decisiones confirmadas:**
- Monorepo: **Nx** (con pnpm)
- Comunicación/API: **Apollo Federation v2** (subgraph por servicio + gateway; el frontend sigue usando un solo `/graphql`)
- Datos: **DB-por-servicio** (5 bases de datos dedicadas + `happy_baby_style` para legacy-api)
- Runtime dev: **Docker Compose local** (Postgres + Redis + db-init + 6 servicios + gateway)
- **Sin datos históricos en prod**: no hay migración de datos pendiente (las DBs parten vacías)

---

## 1. Stack ACTUAL (post-migración)

| Capa | Tecnología | Estado |
|------|-----------|--------|
| Lenguaje | TypeScript (CommonJS, ES2020) | Sin cambios |
| Runtime | Node.js 22 (`.nvmrc` + `engines`) | ✅ Fijado |
| Package manager | pnpm 11 (workspace hoisted) | ✅ Migrado desde npm |
| Monorepo | Nx 22.7.3 | ✅ Configurado |
| HTTP | Express | Sin cambios |
| API | **Apollo Federation v2** (6 subgraphs + gateway) | ✅ Implementado |
| ORM / DB | Prisma 6 + PostgreSQL (per-service schemas) | ✅ DB-por-servicio |
| Auth | JWT/bcrypt/Google OAuth (`@hbs/auth`) | ✅ Extraído a lib |
| Logging | Winston (`@hbs/logging`) | ✅ Extraído a lib |
| Shared types | `@hbs/shared-kernel`, `@hbs/prisma` | ✅ Extraídos a libs |
| Uploads | multer + graphql-upload-cjs | Sin cambios |
| Email | Nodemailer (SMTP Hostinger) | Sin cambios |
| Testing | Jest + ts-jest + supertest | Sin cambios |
| Lint/Format | ESLint 9 (flat config) + Prettier | ✅ Configurado |
| Contenedores | Docker + Docker Compose | ✅ Implementado |
| CI/CD | GitHub Actions CI (pendiente) | ⏳ Fase 6.1 |
| Infra prod | Sin definir (antes: EC2 + Nginx + PM2) | 🔒 Pendiente decisión |

**Servicios extraídos y sus bases de datos:**

| Servicio | Puerto | DB | Dominio |
|---|---|---|---|
| gateway | 4000 | — | Composición Federation |
| legacy-api | 3001 | `happy_baby_style` | Cart, favoritos, reviews, loyalty, notificaciones, newsletter, analytics, config |
| category-service | 3002 | `happy_baby_category` | Categorías |
| product-service | 3003 | `happy_baby_product` | Productos, inventario, stock alerts |
| media-service | 3004 | `happy_baby_media` | Imágenes/SVG |
| order-service | 3005 | `happy_baby_order` | Órdenes, pagos, cupones, carriers, shipping |
| user-service | 3006 | `happy_baby_user` | Usuarios, auth, sesiones, analytics |

---

## 2. Stack DESTINO

**Se conserva:** TypeScript, Apollo Server, GraphQL, Prisma, PostgreSQL, JWT/bcrypt, Winston, Jest.

**Incorporado:** ✅ Nx · ✅ pnpm · ✅ Docker + Docker Compose · ✅ Apollo Federation v2 · ✅ Redis · ✅ ESLint + Prettier · ⏳ GitHub Actions CI · 🔒 CD (bloqueado hasta decidir plataforma prod).

---

## 3. Entorno de desarrollo

- `docker compose up` levanta todo el stack (Postgres + Redis + db-init + 6 servicios + gateway)
- Cada servicio ejecuta `prisma db push --skip-generate` al arrancar para crear sus tablas en su propia DB
- Para desarrollo local sin Docker: `nvm use` aplica Node 22 (`.nvmrc` en raíz)
- `nx run-many --target=lint --all` · `nx run-many --target=build --all` funcionan en los 10 proyectos

---

## 4. CHECKLIST DE MIGRACIÓN

> `[x]` = hecho · `[~]` = parcial · `[ ]` = pendiente · `[-]` = no aplica

### FASE 0 — Preparación y seguridad
- [x] **0.1** Credenciales rotadas y fuera del repo. `.env*` en `.gitignore`; solo `.env.template` versionado. ✓ 2026-05-24
- [x] **0.2** `.gitignore` corregido; `.env.template` versionable. ✓ 2026-05-24
- [x] **0.3** Node 22 fijado: `.nvmrc` en raíz + `"engines": "node": ">=22 <23"` en package.json. ✓ 2026-05-24
- [x] **0.4** Baseline de migraciones Prisma (`libs/prisma/migrations/0_init/migration.sql`, 41 tablas, 11 enums, 39 FKs). Aplicado en DB local Docker. ✓ 2026-05-25
- [x] **0.5** ESLint 9 (flat config) + typescript-eslint + Prettier. ✓ 2026-05-26
  - `eslint.config.js` con reglas baseline (hallazgos heredados = `warn`, no `error`)
  - `.prettierrc` + `.prettierignore`
  - `nx.json` targetDefault `lint` con `"command": "eslint {projectRoot}/src"`
  - `"lint": {}` añadido a los 10 `project.json` (6 apps + 4 libs)
  - `nx run-many --target=lint --all` → 10/10 proyectos, 0 errores
  - `prettier --write` aplicado: 235 archivos formateados para establecer baseline

### FASE 1 — Fundación del monorepo Nx
- [x] **1.1** Workspace Nx con pnpm inicializado. ✓ 2026-05-25
  - npm → pnpm; `.npmrc` con `node-linker=hoisted`; `pnpm-workspace.yaml`; `nx.json` (caché build/test/lint/type-check)
- [x] **1.2** Monolito movido a `apps/legacy-api/` sin cambiar su lógica. ✓ 2026-05-25
  - `project.json` con targets `build`, `type-check`, `test`, `lint`, `codegen`, `serve`
  - Scripts raíz de `package.json` redirigidos a `nx ... legacy-api`
- [x] **1.3** Librerías compartidas extraídas a `libs/`. ✓ 2026-05-25
  - `libs/shared-kernel` (`@hbs/shared-kernel`): BaseResponse, ResponseCodes, ResponseFactory, UrlBuilder
  - `libs/logging` (`@hbs/logging`): Winston wrapper + `ILogger`
  - `libs/auth` (`@hbs/auth`): tipos de auth + `extractTokenFromAuthHeader`
  - `libs/prisma` (`@hbs/prisma`): PrismaService + schema.prisma + migrations
- [x] **1.4** `tsconfig` paths y `nx graph` correctos. ✓ 2026-05-25

### FASE 2 — Contenerización (Docker Compose)
- [x] **2.1** Dockerfiles multi-stage por servicio. ✓ 2026-05-25
- [x] **2.2** `docker-compose.yml` con postgres, redis, legacy-api, 5 servicios, gateway, healthchecks. ✓ 2026-05-25
- [x] **2.3** `.dockerignore` y flujo `docker compose up/down` funcional. ✓ 2026-05-25
- [x] **2.4** Monolito corre idéntico dentro de Docker. ✓ 2026-05-25

### FASE 3 — Gateway de Federation
- [x] **3.1** `legacy-api` convertido en subgraph federado (`buildSubgraphSchema`, `@key`, `@shareable`). ✓ 2026-05-25
- [x] **3.2** `apps/gateway/` con `ApolloGateway` + `IntrospectAndCompose`. ✓ 2026-05-25
- [x] **3.3** `supergraph.yaml` + script `rover:compose` para validación offline. ✓ 2026-05-25
- [x] **3.4** Auth forwarding en gateway (`AuthenticatedDataSource` reenvía `Authorization`). ✓ 2026-05-25

### FASE 4 — Extracción incremental de servicios (Strangler)
- [x] **4.1** `category-service` (piloto end-to-end). ✓ 2026-05-25
  - Clean Architecture completa, 6 use-cases, `type Category @key(fields: "id")`, `__resolveReference`
  - legacy-api limpiado: `type Category` → stub; resolvers de categoría eliminados
- [x] **4.2** `product-service`. ✓ 2026-05-25
  - 5 use-cases, `type Product @key(fields: "id")`, inventario y variantes incluidos
  - legacy-api limpiado: `type Product` y `ProductVariant` → stubs
- [x] **4.3** `media-service` (Image/SVG, uploads + storage). ✓ 2026-05-25
  - `type Image @key` y `type Svg @key`; mutations `uploadImage`, `uploadSvg`
  - legacy-api limpiado: Image/Svg → stubs; scalar Upload eliminado
- [x] **4.4** `order-service`. ✓ 2026-05-25
  - `IProductValidationPort` + `HttpProductValidationAdapter` rompe acoplamiento síncrono
  - `RedisEventPublisher` publica `order:created` para stock decrement asíncrono
  - legacy-api limpiado: Order/OrderItem → stubs; todas las queries/mutations de orden eliminadas
- [x] **4.5** `user-service` (auth, addresses, sessions, analytics). ✓ 2026-05-25
  - 22 use-cases + 4 repositorios Prisma + JWT/Google OAuth + Nodemailer
  - legacy-api limpiado: User/UserProfile/UserAddress → stubs; auth eliminada
- [x] **4.6** `legacy-api` limpiado de dominios migrados (coupon, carrier, shipping, payment, transaction, inventory, images). ✓ 2026-05-26
  - Eliminados de legacy-api: ~170 líneas de resolvers mock + tipos en schema
  - Añadidos a order-service: resolvers Prisma reales para coupon, couponUsage, carrier, shippingZone, shippingRate, deliverySlot, paymentMethod, transaction
  - Añadidos a product-service: resolvers Prisma reales para inventoryTransaction, stockAlert
  - `prisma` pasado a `createResolvers()` en order-service e product-service
  - Fix: `toggleFavorite` devuelve `UserFavorite` (nullable) — correcto para el caso remove
  - Gateway compone sin errores de federación

### FASE 5 — Separación de bases de datos
- [x] **5.1** 5 bases de datos creadas e inicializadas. ✓ 2026-05-26
  - `docker/init-databases.sql` con `CREATE DATABASE IF NOT EXISTS` idempotente para `happy_baby_category`, `happy_baby_product`, `happy_baby_order`, `happy_baby_user`, `happy_baby_media`
  - Servicio `db-init` en docker-compose: corre `psql -f /init-databases.sql` tras postgres healthy
  - Todos los servicios tienen su propia `DATABASE_URL` en docker-compose
- [x] **5.2** FKs cruzadas eliminadas; per-service `prisma/schema.prisma`. ✓ 2026-05-26
  - `Order` denormalizado: `customerEmail`, `customerName`, campos de shipping inline (sin FK a `UserAddress`)
  - Cada servicio tiene su `apps/<servicio>/prisma/schema.prisma` reducido a su dominio
  - CMD en Dockerfiles: `prisma db push --schema apps/<servicio>/prisma/schema.prisma --skip-generate && node ...`
- [~] **5.3** Redis pub/sub implementado para Order→Product. Patrón Outbox formal **no implementado**.
- [-] **5.4** No aplica: sin datos históricos en producción, las DBs parten vacías.

### FASE 6 — CI y despliegue
> Dividida en dos bloques según dependencia de infraestructura cloud.

**Bloque A — CI de calidad (sin AWS, runners gratuitos de GitHub)**
- [ ] **6.1** Workflow `ci.yml`: lint + type-check + `nx affected --target=build --base=origin/main` en cada PR y push a `main`
- [ ] **6.2** (opcional) Rover CLI en CI para validar el supergraph schema antes de mergear

**Bloque B — CD y despliegue (bloqueado: sin infraestructura prod definida)**
- [🔒] **6.3** Build y push de imágenes Docker a un registry (ECR, Docker Hub o GHCR)
- [🔒] **6.4** Deploy automático al target prod (VPS + Docker Compose, AWS ECS/Fargate, u otro)
- [🔒] **6.5** Gestión de secretos en prod (AWS Secrets Manager, SSM, o equivalente)

---

## 5. Lo que está pendiente (priorizado)

### Listo para implementar ahora
1. **6.1** — Workflow CI (`ci.yml`) con lint + type-check + `nx affected` build. Sin dependencias externas.

### Bloqueado hasta decidir infraestructura prod
2. **6.3–6.5** — Registry de imágenes, plataforma de despliegue y gestión de secretos.

### Pendiente futuro / opcional
3. **3.3** — Profundizar Rover CLI (validación de supergraph en CI, no solo local).
4. **3.4** — Consolidar rate-limit y logging centralizado en el gateway.
5. **5.3** — Patrón Outbox formal para consistencia eventual garantizada (at-least-once delivery).

---

## 6. Archivos críticos

| Archivo | Rol |
|---|---|
| `docker-compose.yml` | Orquestación local completa (8 servicios + db-init) |
| `docker/init-databases.sql` | Creación idempotente de las 5 DBs de servicio |
| `.nvmrc` | Fija Node 22 para desarrollo local sin Docker |
| `eslint.config.js` | Flat config ESLint v9 + typescript-eslint + prettier |
| `.prettierrc` | Configuración Prettier |
| `nx.json` | targetDefaults: build/lint/type-check/test con caché y comando por defecto |
| `libs/prisma/schema.prisma` | Schema canónico completo (fuente de tipos TS) |
| `libs/prisma/migrations/` | Historial de migraciones para `happy_baby_style` |
| `apps/<servicio>/prisma/schema.prisma` | Schema reducido por dominio (solo para `prisma db push`) |
| `apps/gateway/src/index.ts` | Composición Federation + auth forwarding |
| `apps/legacy-api/src/graphql/schema.ts` | Subgraph legacy (cart, reviews, loyalty, notificaciones, config) |
| `apps/order-service/src/graphql/schema.ts` | Órdenes + coupon + carrier + shipping + payment method |
| `apps/product-service/src/graphql/schema.ts` | Catálogo + inventario + stock alerts |
| `Dockerfile.<servicio>` | Build multi-stage + CMD con `prisma db push && node` |

---

## 7. Verificación por fase

- **Fase 0:** sin secretos versionados; `nx run-many --target=lint --all` → 0 errores; `prettier --check` limpio.
- **Fase 1:** `nx graph` correcto; `nx build legacy-api` pasa; libs compiladas.
- **Fase 2:** `docker compose up` → todos los contenedores `healthy`; `/health` responde.
- **Fase 3:** `POST localhost:4000/graphql { health }` responde a través del gateway; composición sin errores.
- **Fase 4:** cada dominio migrado responde vía gateway desde su subgraph propietario; legacy-api no lo sirve. `{ activeCoupons }`, `{ carriers }`, `{ stockAlerts }` resuelven desde order-service y product-service.
- **Fase 5:** `docker compose up` → 8 servicios healthy; `prisma db push` crea tablas en cada DB separada; `SELECT COUNT(*) FROM coupons` en `happy_baby_order` devuelve 0 (tabla existe y vacía).
- **Fase 6.1 (CI):** un PR que toca `category-service` dispara solo su build/lint/type-check; los demás se saltan gracias a `nx affected`; el check bloquea el merge si falla.
- **Fase 6.3–6.5 (CD):** imagen Docker publicada al registry al mergear a `main`; deploy al target prod sin intervención manual. *(Pendiente de decidir plataforma.)*
