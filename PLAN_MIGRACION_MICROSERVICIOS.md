# Plan de Migración a Microservicios (Monorepo) — Happy Baby Style Backend

> Documento vivo. Marcamos cada item del checklist a medida que avanzamos.
> Última actualización: 2026-05-24

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
  - [ ] `libs/auth` (utilidades JWT).
  - [ ] `libs/prisma` (PrismaService + mover schema desde la raíz).
- [ ] **1.4** Configurar `tsconfig` paths y validar `nx graph`.

### FASE 2 — Contenerización (Docker Compose)
- [ ] **2.1** Dockerfile base multi-stage para apps Node/TS.
- [ ] **2.2** `docker-compose.yml` con `postgres`, `redis`, `legacy-api` (healthchecks + env por servicio).
- [ ] **2.3** `.dockerignore` y scripts up/down/logs.
- [ ] **2.4** Validar que el monolito corre idéntico dentro de Docker.

### FASE 3 — Gateway de Federation
- [ ] **3.1** Convertir `legacy-api` en subgraph federado (`@apollo/subgraph`).
- [ ] **3.2** Crear `apps/gateway/` (Apollo Gateway/Router) que componga el supergraph.
- [ ] **3.3** Composición del supergraph con Rover, validada en CI local.
- [ ] **3.4** Mover auth/rate-limit/logging a nivel gateway donde aplique.

### FASE 4 — Extracción incremental de servicios (Strangler)
- [ ] **4.1** `category-service` (piloto end-to-end).
- [ ] **4.2** `product-service`.
- [ ] **4.3** `media-service` (Image/SVG).
- [ ] **4.4** `order-service` — comunicación async (Redis/broker) para validación de stock Order→Product.
- [ ] **4.5** `user-service` (auth, addresses, sessions, analytics) — el hub, al final.
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
