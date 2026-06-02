#!/bin/sh
set -e

echo "[entrypoint] prisma migrate deploy..."
node_modules/.bin/prisma migrate deploy --schema apps/user-service/prisma/schema.prisma

echo "[entrypoint] starting service..."
exec node -r tsconfig-paths/register apps/user-service/dist/src/index.js
