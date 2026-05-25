# syntax=docker/dockerfile:1

# ---- base ----
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11 --activate

# ---- builder ----
FROM base AS builder
WORKDIR /app

# Prisma generate needs DATABASE_URL at build time for schema validation
# (it does NOT connect to the DB; the real URL is injected at runtime)
ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"

# Layer-cache: only re-runs when manifests / lockfile / schema change.
# The schema must be present BEFORE pnpm install so that @prisma/client
# postinstall (prisma generate) produces the correct typed client.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc prisma.config.ts ./
COPY libs/auth/package.json          libs/auth/
COPY libs/logging/package.json       libs/logging/
COPY libs/prisma/package.json        libs/prisma/
COPY libs/prisma/schema.prisma       libs/prisma/
COPY libs/shared-kernel/package.json libs/shared-kernel/
RUN pnpm install --frozen-lockfile

# Copy full source and build all libs + app
COPY . .
RUN pnpm exec nx build legacy-api --skip-nx-cache

# ---- runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    TS_NODE_PROJECT=apps/legacy-api/tsconfig.production.json

# Workspace lib dist dirs — must be present BEFORE node_modules so that
# the symlinks node_modules/@hbs/* → ../../libs/* resolve correctly.
COPY --from=builder /app/libs/auth/package.json          ./libs/auth/package.json
COPY --from=builder /app/libs/auth/dist                  ./libs/auth/dist
COPY --from=builder /app/libs/logging/package.json       ./libs/logging/package.json
COPY --from=builder /app/libs/logging/dist               ./libs/logging/dist
COPY --from=builder /app/libs/prisma/package.json        ./libs/prisma/package.json
COPY --from=builder /app/libs/prisma/dist                ./libs/prisma/dist
COPY --from=builder /app/libs/shared-kernel/package.json ./libs/shared-kernel/package.json
COPY --from=builder /app/libs/shared-kernel/dist         ./libs/shared-kernel/dist

# node_modules (symlinks @hbs/* → ../../libs/* are preserved; targets now exist above)
COPY --from=builder /app/node_modules ./node_modules

# Compiled app
COPY --from=builder /app/apps/legacy-api/dist \
                    ./apps/legacy-api/dist
COPY --from=builder /app/apps/legacy-api/tsconfig.production.json \
                    ./apps/legacy-api/tsconfig.production.json

# Writable directories (bind-mounted in compose for dev)
RUN mkdir -p uploads logs

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "-r", "tsconfig-paths/register", "apps/legacy-api/dist/src/index.js"]
