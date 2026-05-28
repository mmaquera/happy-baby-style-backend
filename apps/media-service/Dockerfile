# syntax=docker/dockerfile:1

# ---- base ----
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11 --activate

# ---- builder ----
FROM base AS builder
WORKDIR /app

ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc prisma.config.ts tsconfig.base.json ./
COPY libs/auth/package.json          libs/auth/
COPY libs/logging/package.json       libs/logging/
COPY libs/prisma/package.json        libs/prisma/
COPY libs/prisma/schema.prisma       libs/prisma/
COPY libs/shared-kernel/package.json libs/shared-kernel/
COPY apps/media-service/package.json apps/media-service/
RUN echo "shamefully-hoist=true" >> .npmrc && pnpm install --frozen-lockfile

COPY libs/ libs/
COPY apps/media-service ./apps/media-service

RUN pnpm exec nx build media-service --skip-nx-cache

# ---- runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/libs/auth/package.json          ./libs/auth/package.json
COPY --from=builder /app/libs/auth/dist                  ./libs/auth/dist
COPY --from=builder /app/libs/logging/package.json       ./libs/logging/package.json
COPY --from=builder /app/libs/logging/dist               ./libs/logging/dist
COPY --from=builder /app/libs/prisma/package.json        ./libs/prisma/package.json
COPY --from=builder /app/libs/prisma/dist                ./libs/prisma/dist
COPY --from=builder /app/libs/shared-kernel/package.json ./libs/shared-kernel/package.json
COPY --from=builder /app/libs/shared-kernel/dist         ./libs/shared-kernel/dist

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/media-service/node_modules ./apps/media-service/node_modules
COPY --from=builder /app/apps/media-service/dist ./apps/media-service/dist
COPY --from=builder /app/apps/media-service/prisma/schema.prisma ./apps/media-service/prisma/schema.prisma

RUN mkdir -p uploads

EXPOSE 3004

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3004/health || exit 1

CMD ["sh", "-c", "node_modules/.bin/prisma db push --schema apps/media-service/prisma/schema.prisma --skip-generate && node apps/media-service/dist/src/index.js"]
