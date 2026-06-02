# syntax=docker/dockerfile:1

# ---- base ----
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11 --activate

# ---- builder ----
FROM base AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY libs/auth/package.json          libs/auth/
COPY libs/logging/package.json       libs/logging/
COPY libs/logging/tsconfig.json      libs/logging/
COPY libs/logging/src                libs/logging/src
COPY libs/prisma/package.json        libs/prisma/
COPY libs/shared-kernel/package.json libs/shared-kernel/
RUN pnpm install --frozen-lockfile

COPY apps/gateway ./apps/gateway
RUN pnpm exec nx build gateway --skip-nx-cache

# ---- runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/libs/logging/package.json ./libs/logging/package.json
COPY --from=builder /app/libs/logging/dist         ./libs/logging/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "apps/gateway/dist/src/index.js"]
