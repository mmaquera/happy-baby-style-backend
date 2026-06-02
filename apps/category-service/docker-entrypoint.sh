#!/bin/sh
set -e

echo "[entrypoint] prisma migrate deploy..."
node_modules/.bin/prisma migrate deploy --schema apps/category-service/prisma/schema.prisma

echo "[entrypoint] starting service..."
exec node apps/category-service/dist/src/index.js
