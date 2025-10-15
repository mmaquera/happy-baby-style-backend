# 🔄 Guía de Sincronización de Base de Datos con Prisma

## 📋 Descripción General

Esta guía explica cómo sincronizar tu schema de Prisma con la base de datos PostgreSQL, resolviendo desajustes de schema y asegurando que tanto los entornos de desarrollo como de producción estén correctamente alineados.

## 🚨 Problemas Comunes

### Detección de Desajuste de Schema
Cuando ves errores como:
```
⚠️ We found changes that cannot be executed:
  • Added the required column `expiry_months` to the `loyalty_programs` table without a default value
  • Added the required column `points_per_dollar` to the `loyalty_programs` table without a default value
  • Changed the type of `type` on the `notification_templates` table
```

Esto indica **desajuste de schema** - tu schema de Prisma no coincide con la estructura real de tu base de datos.

## 🛠️ Configuración del Entorno de Desarrollo

### Prerrequisitos
- Node.js y npm instalados
- Base de datos PostgreSQL accesible
- Prisma CLI instalado: `npm install -g prisma`

### Paso 1: Verificar Estado Actual
```bash
# Verificar estado de migraciones
npx prisma migrate status

# Verificar desajustes de schema
npx prisma db pull
```

### Paso 2: Configuración del Entorno
```bash
# Copiar archivo de entorno de desarrollo
cp .env.development .env

# Verificar que DATABASE_URL esté configurado correctamente
grep DATABASE_URL .env
```

### Paso 3: Sincronización del Schema

#### Opción A: Migración Segura (Recomendado)
```bash
# Crear migración para cambios de schema
npx prisma migrate dev --name sync-schema

# Aplicar migraciones
npx prisma migrate deploy
```

#### Opción B: Reset Forzado (⚠️ PELIGROSO - Pierde todos los datos)
```bash
# ⚠️ ADVERTENCIA: Esto ELIMINARÁ TODOS LOS DATOS
npx prisma migrate reset --force

# Enviar schema a la base de datos
npx prisma db push
```

### Paso 4: Verificar Sincronización
```bash
# Verificar estado de migraciones
npx prisma migrate status

# Verificar conexión a la base de datos
npx prisma db execute --schema prisma/schema.prisma --stdin <<< "SELECT version();"
```

## 🚀 Configuración del Entorno de Producción

### Prerrequisitos
- Respaldo de la base de datos de producción completado
- Ventana de mantenimiento programada
- Plan de rollback preparado

### Paso 1: Respaldo Pre-Despliegue
```bash
# Crear respaldo de la base de datos
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql

# Verificar integridad del respaldo
pg_restore --list backup_*.sql
```

### Paso 2: Configuración del Entorno
```bash
# Establecer entorno de producción
export NODE_ENV=production

# Copiar archivo de entorno de producción
cp .env.production .env

# Verificar DATABASE_URL de producción
grep DATABASE_URL .env
```

### Paso 3: Despliegue del Schema

#### Migración Segura de Producción
```bash
# Generar archivos de migración (si no existen)
npx prisma migrate dev --create-only --name production-sync

# Revisar archivos de migración generados
cat prisma/migrations/*/migration.sql

# Desplegar a producción
npx prisma migrate deploy
```

#### Sincronización Forzada de Producción (⚠️ Usar con extrema precaución)
```bash
# ⚠️ ADVERTENCIA DE PRODUCCIÓN: Esto reseteará toda la base de datos
npx prisma db push --force-reset

# Verificar alineación del schema
npx prisma db pull
```

### Paso 4: Verificación Post-Despliegue
```bash
# Verificar estado de migraciones
npx prisma migrate status

# Verificar que las tablas críticas existan
npx prisma db execute --schema prisma/schema.prisma --stdin <<< "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_sessions', 'user_profiles', 'products');
"

# Probar funcionalidad crítica
curl -X POST $API_URL/graphql -H "Content-Type: application/json" \
  -d '{"query":"query { __schema { types { name } } }"}'
```

## 🔧 Resolución de Problemas

### Problema: "Environment variable not found: DATABASE_URL"
**Solución:**
```bash
# Verificar si existe el archivo .env
ls -la | grep env

# Crear .env desde la plantilla
cp .env.development .env

# Verificar que DATABASE_URL esté configurado
grep DATABASE_URL .env
```

### Problema: "Database schema is not in sync with migration history"
**Solución:**
```bash
# Verificar estado actual del schema
npx prisma migrate status

# Si no existen migraciones, crear migración inicial
npx prisma migrate dev --name initial-schema

# Si se detecta desajuste, usar enfoque de reset
npx prisma migrate reset --force
```

### Problema: "Cannot execute changes without data loss"
**Solución:**
```bash
# Opción 1: Agregar valores por defecto al schema (recomendado)
# Editar prisma/schema.prisma para agregar @default() a campos requeridos

# Opción 2: Reset forzado (pierde datos)
npx prisma db push --force-reset

# Opción 3: Adición manual de columnas
npx prisma db execute --stdin <<< "
ALTER TABLE table_name 
ADD COLUMN column_name data_type DEFAULT default_value;
"
```

## 📊 Comandos de Verificación

### Verificar Conexión a la Base de Datos
```bash
# Probar conexión
npx prisma db execute --schema prisma/schema.prisma --stdin <<< "SELECT 1;"

# Verificar información de la base de datos
npx prisma db execute --schema prisma/schema.prisma --stdin <<< "
SELECT 
  current_database() as database_name,
  current_user as current_user,
  version() as postgres_version;
"
```

### Verificar Estructura de Tablas
```bash
# Listar todas las tablas
npx prisma db execute --schema prisma/schema.prisma --stdin <<< "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
"

# Verificar columnas de tabla específica
npx prisma db execute --schema prisma/schema.prisma --stdin <<< "
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_sessions'
ORDER BY ordinal_position;
"
```

### Probar Operaciones de Datos
```bash
# Probar inserción
npx prisma db execute --schema prisma/schema.prisma --stdin <<< "
INSERT INTO user_sessions (id, user_id, session_token, access_token, expires_at, is_active)
VALUES (
  gen_random_uuid(),
  'test-user-id',
  gen_random_uuid()::text,
  'test-access-token',
  NOW() + INTERVAL '1 hour',
  true
);
"

# Probar selección
npx prisma db execute --schema prisma/schema.prisma --stdin <<< "
SELECT COUNT(*) as total_sessions FROM user_sessions;
"
```

## 🚨 Advertencias Críticas

### ⚠️ Riesgos de Pérdida de Datos
- **`--force-reset`**: Elimina toda la base de datos
- **`migrate reset`**: Remueve todos los datos y migraciones
- **Cambios de schema**: Pueden requerir migración de datos

### 🔒 Seguridad de Producción
- **Siempre hacer respaldo** antes de cambios de schema
- **Probar migraciones** en desarrollo primero
- **Programar ventanas de mantenimiento** para producción
- **Tener plan de rollback** listo

### 📋 Lista de Verificación Pre-Migración
- [ ] Respaldo de base de datos completado
- [ ] Variables de entorno configuradas
- [ ] Cambios de schema revisados
- [ ] Plan de rollback preparado
- [ ] Ventana de mantenimiento programada
- [ ] Equipo notificado de los cambios

## 📚 Recursos Adicionales

### Documentación de Prisma
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Database Schema Introspection](https://www.prisma.io/docs/concepts/components/prisma-db-push)
- [Production Deployment](https://www.prisma.io/docs/guides/deployment/deployment-guides)

### Comandos de PostgreSQL
- [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
- [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)
- [Information Schema](https://www.postgresql.org/docs/current/information-schema.html)

## 🎯 Referencia Rápida

### Sincronización de Desarrollo
```bash
cp .env.development .env
npx prisma migrate dev --name sync-schema
```

### Sincronización de Producción
```bash
cp .env.production .env
npx prisma migrate deploy
```

### Reset de Emergencia
```bash
npx prisma migrate reset --force
npx prisma db push
```

### Verificar Sincronización
```bash
npx prisma migrate status
npx prisma db execute --stdin <<< "SELECT 1;"
```

---

**Última Actualización:** $(date +%Y-%m-%d)
**Versión:** 1.0.0
**Autor:** Equipo de Desarrollo
