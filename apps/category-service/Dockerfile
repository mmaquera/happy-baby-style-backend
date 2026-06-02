# syntax=docker/dockerfile:1

# ---- base ----
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11 --activate

# ---- builder ----
FROM base AS builder
WORKDIR /app

ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY libs/auth/package.json          libs/auth/
COPY libs/logging/package.json       libs/logging/
COPY libs/prisma/package.json        libs/prisma/
COPY libs/shared-kernel/package.json libs/shared-kernel/
RUN echo "shamefully-hoist=true" >> .npmrc && pnpm install --frozen-lockfile

COPY libs/ libs/
COPY apps/category-service ./apps/category-service

RUN pnpm exec prisma generate --schema apps/category-service/prisma/schema.prisma
RUN pnpm exec nx build category-service --skip-nx-cache
RUN pnpm exec nx build authz --skip-nx-cache
# Prisma generated client is plain JS — tsc does not copy it; place it where the compiled code requires it.
RUN cp -r apps/category-service/src/generated apps/category-service/dist/src/

# ---- runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    TS_NODE_PROJECT=apps/category-service/tsconfig.production.json

# Copy lib dist BEFORE node_modules so symlinks resolve correctly
COPY --from=builder /app/libs/auth/package.json          ./libs/auth/package.json
COPY --from=builder /app/libs/auth/dist                  ./libs/auth/dist
COPY --from=builder /app/libs/authz/package.json         ./libs/authz/package.json
COPY --from=builder /app/libs/authz/dist                 ./libs/authz/dist
COPY --from=builder /app/libs/logging/package.json       ./libs/logging/package.json
COPY --from=builder /app/libs/logging/dist               ./libs/logging/dist
COPY --from=builder /app/libs/prisma/package.json        ./libs/prisma/package.json
COPY --from=builder /app/libs/prisma/dist                ./libs/prisma/dist
COPY --from=builder /app/libs/shared-kernel/package.json ./libs/shared-kernel/package.json
COPY --from=builder /app/libs/shared-kernel/dist         ./libs/shared-kernel/dist

COPY --from=builder /app/node_modules ./node_modules
# Ensure zod is accessible at the hoisted level (authz lib dependency)
RUN ln -sf /app/node_modules/.pnpm/zod@4.4.3/node_modules/zod /app/node_modules/zod
COPY --from=builder /app/apps/category-service/node_modules ./apps/category-service/node_modules
COPY --from=builder /app/apps/category-service/dist ./apps/category-service/dist
COPY --from=builder /app/apps/category-service/tsconfig.production.json ./apps/category-service/tsconfig.production.json
COPY --from=builder /app/apps/category-service/prisma/schema.prisma ./apps/category-service/prisma/schema.prisma
COPY --from=builder /app/apps/category-service/prisma/migrations ./apps/category-service/prisma/migrations

COPY apps/category-service/docker-entrypoint.sh ./apps/category-service/docker-entrypoint.sh
RUN chmod +x apps/category-service/docker-entrypoint.sh

EXPOSE 3002

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1

ENTRYPOINT ["apps/category-service/docker-entrypoint.sh"]
