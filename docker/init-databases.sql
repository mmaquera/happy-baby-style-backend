-- Creates one database per microservice.
-- The legacy-api continues to use the pre-existing "happy_baby_style" database.
-- Each service runs `prisma migrate deploy` at startup (via docker-entrypoint.sh) to apply migrations.

SELECT 'CREATE DATABASE happy_baby_category'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'happy_baby_category')\gexec

SELECT 'CREATE DATABASE happy_baby_product'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'happy_baby_product')\gexec

SELECT 'CREATE DATABASE happy_baby_order'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'happy_baby_order')\gexec

SELECT 'CREATE DATABASE happy_baby_user'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'happy_baby_user')\gexec

SELECT 'CREATE DATABASE happy_baby_media'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'happy_baby_media')\gexec
