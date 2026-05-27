# Plan de Migración a Microservicios (Monorepo) — Happy Baby Style Backend

> Documento vivo. Marcamos cada item del checklist a medida que avanzamos.
> Última actualización: 2026-05-26 (Fases 0–7.11 completadas — legacy-api eliminado)

## Contexto

El backend era un **monolito** Node.js + TypeScript con Express + Apollo GraphQL y Prisma sobre una única PostgreSQL (40+ tablas), bien estructurado en Clean Architecture (domain / application / infrastructure / presentation). Todo corría en un solo proceso (puerto 3001), con un único contenedor de DI, una sola DB con FKs cruzadas, y despliegue manual (PM2 + Nginx + EC2, sin Docker ni CI/CD).

Objetivo alcanzado: migración completa (patrón Strangler) a microservicios en un **monorepo Nx**, comunicados vía **Apollo Federation v2**, con **una base de datos por servicio** y un **entorno de desarrollo en Docker Compose**. El monolito (`apps/legacy-api`) fue eliminado en la Fase 7.

**Decisiones confirmadas:**
- Monorepo: **Nx** (con pnpm workspace hoisted)
- Comunicación/API: **Apollo Federation v2** (subgraph por servicio + gateway; el frontend usa un solo `/graphql` en `:4000`)
- Datos: **DB-por-servicio** (5 bases de datos dedicadas)
- Runtime dev: **Docker Compose local** (Postgres + Redis + db-init + 5 servicios + gateway)
- **Sin datos históricos en prod**: las DBs parten vacías

---

## 1. Stack ACTUAL

| Capa | Tecnología | Estado |
|------|-----------|--------|
| Lenguaje | TypeScript (CommonJS, ES2020) | Sin cambios |
| Runtime | Node.js 22 (`.nvmrc` + `engines`) | ✅ Fijado |
| Package manager | pnpm 11 (workspace hoisted) | ✅ Migrado desde npm |
| Monorepo | Nx 22.7.3 | ✅ Configurado |
| HTTP | Express | Sin cambios |
| API | **Apollo Federation v2** (5 subgraphs + gateway) | ✅ Implementado |
| ORM / DB | Prisma 6 + PostgreSQL (per-service schemas) | ✅ DB-por-servicio |
| Auth | JWT/bcrypt/Google OAuth (`@hbs/auth`) | ✅ Extraído a lib |
| Logging | Winston (`@hbs/logging`) | ✅ Extraído a lib |
| Shared types | `@hbs/shared-kernel`, `@hbs/prisma` | ✅ Extraídos a libs |
| Uploads | graphql-upload-cjs + express.static | ✅ Servidos desde media-service |
| Email | Nodemailer (SMTP) | Sin cambios |
| Testing | Jest + ts-jest + supertest | Sin cambios |
| Lint/Format | ESLint 9 (flat config) + Prettier | ✅ Configurado |
| Contenedores | Docker + Docker Compose | ✅ Implementado |
| CI/CD | GitHub Actions CI (pendiente) | ⏳ Fase 6.1 |
| Infra prod | Sin definir | 🔒 Pendiente decisión |

**Servicios y sus bases de datos:**

| Servicio | Puerto | DB | Dominio |
|---|---|---|---|
| gateway | 4000 | — | Composición Federation + auth forwarding |
| category-service | 3002 | `happy_baby_category` | Categorías |
| product-service | 3003 | `happy_baby_product` | Productos, inventario, stock alerts, reviews |
| media-service | 3004 | `happy_baby_media` | Imágenes/SVG, archivos estáticos (`/uploads`) |
| order-service | 3005 | `happy_baby_order` | Órdenes, pagos, cupones, carriers, shipping, carrito, config |
| user-service | 3006 | `happy_baby_user` | Usuarios, auth, sesiones, favoritos, loyalty, notificaciones, newsletter |

---

## 2. Stack DESTINO

**Se conserva:** TypeScript, Apollo Server, GraphQL, Prisma, PostgreSQL, JWT/bcrypt, Winston, Jest.

**Incorporado:** ✅ Nx · ✅ pnpm · ✅ Docker + Docker Compose · ✅ Apollo Federation v2 · ✅ Redis · ✅ ESLint + Prettier · ⏳ GitHub Actions CI · 🔒 CD (bloqueado hasta decidir plataforma prod).

---

## 3. Entorno de desarrollo

- `docker compose up` levanta todo el stack (Postgres + Redis + db-init + 5 servicios + gateway)
- Cada servicio ejecuta `prisma db push --skip-generate` al arrancar para crear sus tablas en su propia DB
- Para desarrollo local sin Docker: `nvm use` aplica Node 22 (`.nvmrc` en raíz)
- `nx run-many --target=lint --all` · `nx run-many --target=build --all` funcionan en todos los proyectos
- Archivos subidos accesibles en `http://localhost:3004/uploads/...` (servidos por media-service)

---

## 4. CHECKLIST DE MIGRACIÓN

> `[x]` = hecho · `[~]` = parcial · `[ ]` = pendiente · `[-]` = no aplica

### FASE 0 — Preparación y seguridad
- [x] **0.1** Credenciales rotadas y fuera del repo. `.env*` en `.gitignore`; solo `.env.template` versionado.
- [x] **0.2** `.gitignore` corregido; `.env.template` versionable.
- [x] **0.3** Node 22 fijado: `.nvmrc` en raíz + `"engines": "node": ">=22 <23"` en package.json.
- [x] **0.4** Baseline de migraciones Prisma (`libs/prisma/migrations/0_init/migration.sql`, 41 tablas). Aplicado en DB local Docker.
- [x] **0.5** ESLint 9 (flat config) + typescript-eslint + Prettier. `nx run-many --target=lint --all` → 0 errores.

### FASE 1 — Fundación del monorepo Nx
- [x] **1.1** Workspace Nx con pnpm inicializado. `pnpm-workspace.yaml`, `nx.json` con caché.
- [x] **1.2** Monolito movido a `apps/legacy-api/` *(posteriormente eliminado en Fase 7)*.
- [x] **1.3** Librerías compartidas extraídas a `libs/`:
  - `libs/shared-kernel` (`@hbs/shared-kernel`): BaseResponse, ResponseCodes, ResponseFactory, UrlBuilder
  - `libs/logging` (`@hbs/logging`): Winston wrapper + `ILogger`
  - `libs/auth` (`@hbs/auth`): tipos de auth + `extractTokenFromAuthHeader`
  - `libs/prisma` (`@hbs/prisma`): PrismaService + schema.prisma canónico + migrations
- [x] **1.4** `tsconfig` paths y `nx graph` correctos.

### FASE 2 — Contenerización (Docker Compose)
- [x] **2.1** Dockerfiles multi-stage por servicio (ahora en `apps/<servicio>/Dockerfile`).
- [x] **2.2** `docker-compose.yml` con postgres, redis, 5 servicios, gateway, healthchecks.
- [x] **2.3** `.dockerignore` y flujo `docker compose up/down` funcional.
- [x] **2.4** Todos los servicios corren dentro de Docker contra sus DBs dedicadas.

### FASE 3 — Gateway de Federation
- [x] **3.1** Subgraphs federados con `buildSubgraphSchema`, directivas `@key`, `@shareable`.
- [x] **3.2** `apps/gateway/` con `ApolloGateway` + `IntrospectAndCompose` — 5 subgraphs.
- [x] **3.3** `supergraph.yaml` + script `rover:compose` para validación offline.
- [x] **3.4** Auth forwarding en gateway (`AuthenticatedDataSource` reenvía `Authorization`).

### FASE 4 — Extracción incremental de servicios (Strangler)
- [x] **4.1** `category-service` extraído: Clean Architecture completa, 6 use-cases, `type Category @key`.
- [x] **4.2** `product-service` extraído: 5 use-cases, `type Product @key`, inventario y variantes.
- [x] **4.3** `media-service` extraído: `type Image @key`, `type Svg @key`, uploads + storage local.
- [x] **4.4** `order-service` extraído: `IProductValidationPort` + `HttpProductValidationAdapter`, `RedisEventPublisher` para pub/sub Order→Product.
- [x] **4.5** `user-service` extraído: 22 use-cases, 4 repositorios Prisma, JWT/Google OAuth, Nodemailer.
- [x] **4.6** Legacy-api limpiado de dominios coupon/carrier/shipping/payment/transaction/inventory/images.

### FASE 5 — Separación de bases de datos
- [x] **5.1** 5 bases de datos creadas: `happy_baby_category/product/order/user/media`. `docker/init-databases.sql` idempotente + servicio `db-init` en compose.
- [x] **5.2** FKs cruzadas eliminadas: `Order` denormalizado, per-service `prisma/schema.prisma`, `prisma db push` al arrancar.
- [~] **5.3** Redis pub/sub implementado para Order→Product (validación de stock). Patrón Outbox formal **no implementado**.
- [-] **5.4** No aplica: sin datos históricos en producción.

### FASE 6 — CI y despliegue
> **Bloque A — CI de calidad (sin dependencias de cloud)**
- [ ] **6.1** Workflow `ci.yml`: lint + type-check + `nx affected --target=build --base=origin/main` en cada PR y push a `main`.
- [ ] **6.2** (opcional) Rover CLI en CI para validar el supergraph schema antes de mergear.

> **Bloque B — CD y despliegue (bloqueado: sin infraestructura prod definida)**
- [🔒] **6.3** Build y push de imágenes Docker a un registry (ECR, Docker Hub o GHCR).
- [🔒] **6.4** Deploy automático al target prod (VPS + Docker Compose, AWS ECS/Fargate, u otro).
- [🔒] **6.5** Gestión de secretos en prod (AWS Secrets Manager, SSM, o equivalente).

### FASE 7 — Eliminación completa de legacy-api
- [x] **7.1** User Favorites migrado a `user-service` (Prisma real: tabla `user_favorites`, `ManageUserFavoritesUseCase`, `PrismaUserFavoritesRepository`).
- [x] **7.2** Shopping Cart migrado a `order-service` (Prisma real: tablas `shopping_carts`, `shopping_cart_items`).
- [x] **7.3** Product Reviews migrado a `product-service` (Prisma real: tablas `product_reviews`, `review_photos`, `review_votes`).
- [x] **7.4** Loyalty & Rewards migrado a `user-service` (Prisma real: tablas `loyalty_programs`, `reward_points`).
- [x] **7.5** Notifications + Email Templates + Newsletter migrado a `user-service` (Prisma real: tablas `push_notifications`, `notification_templates`, `email_templates`, `newsletter_subscriptions`).
- [x] **7.6** Saved Payment Methods migrado a `user-service` (Prisma real: tabla `saved_payment_methods`).
- [x] **7.7** App Events migrado a `user-service` (Prisma real: tabla `app_events`).
- [x] **7.8** Store Settings + Tax Rates migrado a `order-service` (Prisma real: tablas `store_settings`, `tax_rates`).
- [x] **7.9** DashboardMetrics descompuesto en queries individuales por servicio: `orderStats` (con `todayOrders`, `todayRevenue`, `activeCoupons`), `productStats` (con `lowStockCount`, `outOfStockCount`). Tipo `DashboardMetrics` eliminado del supergraph.
- [x] **7.10** `apps/legacy-api/` eliminado del repo. Servicio `legacy-api` y `LEGACY_API_URL` eliminados del `docker-compose.yml`. Gateway actualizado (5 subgraphs, sin `legacy`). `Dockerfile` raíz eliminado.
- [x] **7.11** Dockerfiles movidos de la raíz a `apps/<servicio>/Dockerfile`. `docker-compose.yml` actualizado con `dockerfile: apps/<servicio>/Dockerfile`. Build verificado con nuevo path.
- [ ] **7.12** Limpiar `package.json` raíz: scripts obsoletos eliminados, scripts Nx multi-servicio añadidos. *(Parcialmente hecho: `start`, `build`, `test` actualizados; revisar el resto.)*
- [x] **7.13** Actualizar `libs/prisma/schema.prisma` (schema canónico) para reflejar todas las tablas nuevas añadidas a los servicios en Fase 7.
- [x] **7.14** Verificación final: `docker compose up` → todos los contenedores healthy (sin legacy-api); gateway compone sin errores; `nx run-many --target=lint --all` → 0 errores; `nx run-many --target=build --all` → 0 errores.

---

## 5. Lo que está pendiente (priorizado)

### Inmediato — Fase 7 (cierre)
1. ~~**7.12**~~ ✅ Scripts de `package.json` raíz limpios.
2. ~~**7.13**~~ ✅ `libs/prisma/schema.prisma` sincronizado con Fase 7.
3. ~~**7.14**~~ ✅ Verificación final: 8/8 contenedores healthy, 5 subgraphs resolviendo, lint 0 errores, build 0 errores.

### Siguiente — Fase 6 (CI sin dependencias cloud)
4. **6.1** — Workflow `ci.yml` con lint + type-check + `nx affected` build.

### Bloqueado hasta decidir infraestructura prod
5. **6.3–6.5** — Registry, plataforma de despliegue y gestión de secretos.

### Futuro / opcional
6. **3.4** — Consolidar rate limiting centralizado en el gateway (actualmente no hay rate limiting en ningún servicio).
7. **5.3** — Patrón Outbox formal para consistencia eventual garantizada (at-least-once delivery).

---

## 6. Archivos críticos

| Archivo | Rol |
|---|---|
| `docker-compose.yml` | Orquestación local completa (7 contenedores: postgres + redis + db-init + 5 servicios + gateway) |
| `docker/init-databases.sql` | Creación idempotente de las 5 DBs de servicio |
| `.nvmrc` | Fija Node 22 para desarrollo local sin Docker |
| `eslint.config.js` | Flat config ESLint v9 + typescript-eslint + prettier |
| `.prettierrc` | Configuración Prettier |
| `nx.json` | targetDefaults: build/lint/type-check/test con caché |
| `libs/prisma/schema.prisma` | Schema canónico completo (fuente de tipos TS compartidos) |
| `libs/prisma/migrations/` | Historial de migraciones para `happy_baby_style` (legacy, referencia) |
| `apps/<servicio>/prisma/schema.prisma` | Schema reducido por dominio (para `prisma db push` al arrancar) |
| `apps/<servicio>/Dockerfile` | Build multi-stage con `prisma db push && node dist/index.js` |
| `apps/gateway/src/index.ts` | Composición Federation (5 subgraphs) + auth forwarding |

---

## 7. Verificación por fase

- **Fase 0:** sin secretos versionados; `nx run-many --target=lint --all` → 0 errores; `prettier --check` limpio.
- **Fase 1:** `nx graph` correcto; libs compiladas; paths de workspace resuelven.
- **Fase 2:** `docker compose up` → todos los contenedores `healthy`; `/health` responde en cada servicio.
- **Fase 3:** `POST localhost:4000/graphql { health }` responde a través del gateway; composición sin errores de federation.
- **Fase 4:** cada dominio migrado responde vía gateway desde su subgraph propietario. `{ coupons }`, `{ carriers }`, `{ stockAlerts }` resuelven desde order-service y product-service.
- **Fase 5:** `docker compose up` → 7 contenedores healthy; `prisma db push` crea tablas en cada DB; todas las DBs separadas y funcionales.
- **Fase 7 (parcial):** `apps/legacy-api/` no existe; gateway compone 5 subgraphs sin errores; queries de todos los dominios migrados responden a través del gateway; archivos subidos accesibles en `localhost:3004/uploads`.
- **Fase 6.1 (CI):** un PR que toca `category-service` dispara solo su build/lint/type-check gracias a `nx affected`; el check bloquea el merge si falla.
- **Fase 6.3–6.5 (CD):** imagen Docker publicada al registry al mergear a `main`; deploy al target prod sin intervención manual. *(Pendiente de decidir plataforma.)*
