# Happy Baby Style Backend

Backend en arquitectura de **microservicios** con **Apollo Federation v2** sobre un **monorepo Nx**. Cinco servicios autónomos (cada uno con su propia base de datos PostgreSQL) componen un supergraph único expuesto al frontend a través de un gateway en `:4000`.

## Stack

| Capa | Tecnología |
|---|---|
| Lenguaje / runtime | TypeScript · Node.js 22 (fijado en `.nvmrc`) |
| Package manager | pnpm 11 (workspace hoisted) |
| Monorepo | Nx 22 |
| API | Apollo Federation v2 (5 subgraphs + gateway) |
| HTTP | Express |
| ORM / DB | Prisma 6 · PostgreSQL 16 (1 DB por servicio) |
| Mensajería | Redis 7 (pub/sub para validación de stock Order→Product) |
| Auth | JWT · bcrypt · Google OAuth |
| Logging | Winston (`@hbs/logging`) |
| Contenedores | Docker · Docker Compose |
| Lint / format | ESLint 9 (flat config) · Prettier |
| CI | GitHub Actions (`nx affected` lint + type-check + build) |

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│              Apollo Gateway (Federation v2)                 │
│                  :4000 /graphql, /health                    │
└──────┬──────┬──────┬──────┬──────┬──────────────────────────┘
       │      │      │      │      │
   ┌───▼──┐ ┌─▼───┐ ┌▼────┐ ┌▼───┐ ┌▼─────┐
   │ cat. │ │prod.│ │media│ │ord.│ │ user │
   │ :3002│ │:3003│ │:3004│ │:3005│ │:3006│
   └──┬───┘ └──┬──┘ └──┬──┘ └─┬──┘ └─┬───┘
      │        │       │      │      │
      ▼        ▼       ▼      ▼      ▼
  ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐
  │  cat   ││  prod  ││ media  ││ order  ││  user  │
  │  DB    ││  DB    ││  DB    ││  DB    ││  DB    │
  └────────┘└────────┘└────────┘└────────┘└────────┘
                          │
                          └── /uploads servido por media-service
```

### Servicios

| Servicio | Puerto | DB | Dominio |
|---|---|---|---|
| **gateway** | 4000 | — | Composición Federation (5 subgraphs) + forwarding de `Authorization` |
| **category-service** | 3002 | `happy_baby_category` | Categorías |
| **product-service** | 3003 | `happy_baby_product` | Productos, variantes, inventario, stock alerts, reviews |
| **media-service** | 3004 | `happy_baby_media` | Imágenes/SVG + archivos estáticos (`/uploads`) |
| **order-service** | 3005 | `happy_baby_order` | Órdenes, cupones, carriers, shipping, carrito, store config |
| **user-service** | 3006 | `happy_baby_user` | Auth, usuarios, favoritos, loyalty, notificaciones, newsletter, sesiones |

### Librerías compartidas (`libs/`)

- **`@hbs/shared-kernel`** — `BaseResponse`, `ResponseCodes`, `ResponseFactory`, `UrlBuilder`
- **`@hbs/logging`** — wrapper de Winston con `ILogger`
- **`@hbs/auth`** — tipos de auth + `extractTokenFromAuthHeader`
- **`@hbs/prisma`** — schema canónico de referencia + `PrismaService`

### Decisiones arquitecturales clave

- **DB-por-servicio:** cada microservicio tiene su propia PostgreSQL; al arrancar ejecuta `prisma db push --skip-generate` contra su DB. Sin FKs cross-domain.
- **Denormalización en Order:** `customerEmail`, `customerName` y dirección de envío inline evitan FKs hacia `user-service`.
- **Redis pub/sub:** Order publica eventos de creación → Product valida stock async (patrón Outbox formal pendiente — ver Fase 5.3 del plan).
- **Auth forwarding:** el gateway reenvía el header `Authorization` a cada subgraph (`AuthenticatedDataSource`).
- **Archivos estáticos:** `media-service` sirve `/uploads` con `express.static` (`STORAGE_BASE_URL=http://localhost:3004`).

## Quick start (Docker)

```bash
# 1. Clonar y entrar al repo
git clone <repository-url>
cd happy-baby-style-backend

# 2. Copiar variables de entorno
cp .env.template .env
# Editar .env con tus credenciales (DOCKER_DB_PASSWORD, JWT_SECRET, etc.)

# 3. Levantar el stack completo
pnpm start          # docker compose up -d (atajo)
# o:
docker compose up -d

# 4. Verificar
curl http://localhost:4000/health
# {"status":"OK","service":"Apollo Federation Gateway","port":4000}
```

`docker compose up -d` levanta 8 contenedores: postgres + redis + db-init + 5 servicios + gateway. Cada servicio aplica `prisma db push` a su DB al arrancar.

**Explorar la API:** abrir [`http://localhost:4000/graphql`](http://localhost:4000/graphql) en el navegador para Apollo Sandbox (introspección, autocompletado y exploración del supergraph).

## Desarrollo local sin Docker

```bash
nvm use                        # aplica Node 22 desde .nvmrc
pnpm install --frozen-lockfile

# Levantar un servicio puntual (ejemplo)
pnpm exec nx serve gateway
pnpm exec nx serve category-service
```

Requiere PostgreSQL local con las 5 DBs creadas (ver `docker/init-databases.sql`) o usar Docker solo para postgres + redis.

## Scripts disponibles

### Stack Docker
- `pnpm start` — `docker compose up -d`
- `pnpm stop` — `docker compose down`
- `pnpm docker:reset` — destruye volúmenes (purga DBs)
- `pnpm docker:logs` — sigue logs de todos los servicios
- `pnpm docker:build` — rebuild de imágenes

### Calidad
- `pnpm lint` — `nx run-many --target=lint --all`
- `pnpm lint:fix` — ESLint con `--fix` sobre apps/ y libs/
- `pnpm format` / `pnpm format:check` — Prettier
- `pnpm type-check` — TypeScript sin emit en todos los proyectos

### Build
- `pnpm build` — `nx run-many --target=build --all`
- `pnpm build:affected` — solo proyectos tocados respecto a `origin/main`

### Federation
- `pnpm gateway:serve` — corre el gateway en modo Nx
- `pnpm gateway:build` — build del gateway
- `pnpm rover:compose` — compone el supergraph offline con Rover CLI (requiere Rover instalado)

### Tests
- `pnpm test` — `nx run-many --target=test --all`

## Variables de entorno

Ver `.env.template` para la lista completa. Las críticas:

```bash
# Postgres (compartido por las 5 DBs en una instancia local)
DOCKER_DB_USER=postgres
DOCKER_DB_PASSWORD=<requerido>
DOCKER_DB_PORT=5432

# Puertos por servicio (opcional, defaults arriba)
GATEWAY_PORT=4000
CATEGORY_SERVICE_PORT=3002
PRODUCT_SERVICE_PORT=3003
MEDIA_SERVICE_PORT=3004
ORDER_SERVICE_PORT=3005
USER_SERVICE_PORT=3006

# Auth (user-service)
JWT_SECRET=<requerido>
GOOGLE_CLIENT_ID=<opcional>
GOOGLE_CLIENT_SECRET=<opcional>

# SMTP (user-service — emails de welcome / reset password)
SMTP_HOST=<opcional>
SMTP_PORT=587
SMTP_USER=<opcional>
SMTP_PASSWORD=<opcional>
SMTP_FROM_EMAIL=noreply@happybabystyle.com

# CORS / frontends permitidos
FRONTEND_URL=http://localhost:3000
FRONTEND_URLS=http://localhost:3000
RESET_PASSWORD_URL=http://localhost:3000/reset-password

# Storage (media-service)
STORAGE_BASE_URL=http://localhost:3004
```

## Endpoints útiles

| URL | Propósito |
|---|---|
| `http://localhost:4000/graphql` | Apollo Sandbox + endpoint federado |
| `http://localhost:4000/health` | Health del gateway |
| `http://localhost:3002/health` … `http://localhost:3006/health` | Health por servicio |
| `http://localhost:3004/uploads/...` | Archivos subidos (servidos por media-service) |

## CI

`.github/workflows/ci.yml` corre en cada PR y push a `main`:

1. Instala dependencias con cache de pnpm store
2. Calcula `NX_BASE`/`NX_HEAD` según el evento
3. Ejecuta `nx affected` para `lint`, `type-check` y `build` — solo los proyectos tocados

Un PR que solo modifica `category-service` solo dispara el pipeline de ese servicio.

## Documentación interna

- **[`PLAN_MIGRACION_MICROSERVICIOS.md`](./PLAN_MIGRACION_MICROSERVICIOS.md)** — plan vivo de la migración monolito→microservicios. Fases 0–7 y 6.1 completadas.
- **[`PRISMA_MIGRATIONS_GUIDE.md`](./PRISMA_MIGRATIONS_GUIDE.md)** — workflow de migrations Prisma y schema canónico (`libs/prisma/`).
- **[`LOGGING_SYSTEM.md`](./LOGGING_SYSTEM.md)** — sistema de logging (`@hbs/logging`) usado por los 5 servicios.
- **[`RENEW_CERTIFICATE.md`](./RENEW_CERTIFICATE.md)** — runbook para renovar el certificado TLS de producción.

## Despliegue en producción

> **Estado:** plataforma de despliegue prod **pendiente de decidir** (Fase 6.3–6.5 del plan de migración, bloqueada).
>
> Opciones evaluadas: VPS + Docker Compose, AWS ECS/Fargate, Railway, Render. Una vez decidida se añadirá el workflow de CD a `.github/workflows/`, junto con el registry (ECR/GHCR/Docker Hub) y la gestión de secretos.

Para el dominio actual (`service.happybabystyle.com`) y renovación de certificados, ver [`RENEW_CERTIFICATE.md`](./RENEW_CERTIFICATE.md).

## Contribuir

1. Crear branch desde `main` (`git checkout -b feat/<scope>`)
2. Hacer cambios + `pnpm lint && pnpm build`
3. PR — la CI bloquea el merge si lint/type-check/build fallan
4. Mantener PRs pequeños y enfocados en un solo servicio cuando sea posible (`nx affected` premia eso con builds más rápidos)

## Licencia

MIT. Ver `LICENSE`.
