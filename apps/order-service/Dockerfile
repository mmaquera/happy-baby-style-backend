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
COPY apps/order-service/package.json apps/order-service/
RUN echo "shamefully-hoist=true" >> .npmrc && pnpm install --frozen-lockfile

COPY libs/ libs/
COPY apps/order-service ./apps/order-service

RUN pnpm exec prisma generate --schema apps/order-service/prisma/schema.prisma
RUN pnpm exec nx build order-service --skip-nx-cache
RUN pnpm exec nx build authz --skip-nx-cache
# Prisma generated client is plain JS — tsc does not copy it; place it where the compiled code requires it.
RUN cp -r apps/order-service/src/generated apps/order-service/dist/src/

# ---- runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

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
COPY --from=builder /app/apps/order-service/node_modules ./apps/order-service/node_modules
COPY --from=builder /app/apps/order-service/dist ./apps/order-service/dist
COPY --from=builder /app/apps/order-service/prisma/schema.prisma ./apps/order-service/prisma/schema.prisma
COPY --from=builder /app/apps/order-service/prisma/migrations ./apps/order-service/prisma/migrations

COPY apps/order-service/docker-entrypoint.sh ./apps/order-service/docker-entrypoint.sh
RUN chmod +x apps/order-service/docker-entrypoint.sh

EXPOSE 3005

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3005/health || exit 1

ENTRYPOINT ["apps/order-service/docker-entrypoint.sh"]
