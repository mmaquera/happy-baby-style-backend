# syntax=docker/dockerfile:1

# ---- base ----
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11 --activate

# ---- builder ----
FROM base AS builder
WORKDIR /app

# Dummy DATABASE_URL needed by @prisma/client postinstall (schema validation only)
ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc prisma.config.ts tsconfig.base.json ./
COPY libs/auth/package.json          libs/auth/
COPY libs/logging/package.json       libs/logging/
COPY libs/prisma/package.json        libs/prisma/
COPY libs/prisma/schema.prisma       libs/prisma/
COPY libs/shared-kernel/package.json libs/shared-kernel/
RUN pnpm install --frozen-lockfile

# Only copy gateway source — no need to build the monolith
COPY apps/gateway ./apps/gateway
RUN pnpm exec nx build gateway --skip-nx-cache

# ---- runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Gateway imports: @apollo/gateway, @apollo/server, express, cors, helmet, dotenv
# No @hbs/* libs needed — the symlinks exist in node_modules but are never resolved
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "apps/gateway/dist/index.js"]
