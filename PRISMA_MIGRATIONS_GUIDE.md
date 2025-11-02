# 🔄 Guía Completa de Migraciones de Prisma - Happy Baby Style Backend

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Conceptos Básicos](#conceptos-básicos)
3. [Comandos Disponibles](#comandos-disponibles)
4. [Flujo de Trabajo Completo](#flujo-de-trabajo-completo)
5. [Ejemplos Prácticos](#ejemplos-prácticos)
6. [Despliegue en Producción](#despliegue-en-producción)
7. [Resolución de Problemas](#resolución-de-problemas)
8. [Mejores Prácticas](#mejores-prácticas)
9. [Casos Especiales](#casos-especiales)
10. [Referencia Rápida](#referencia-rápida)

---

## 🎯 Introducción

Esta guía explica paso a paso cómo trabajar con migraciones de Prisma en el proyecto **Happy Baby Style Backend**. Las migraciones permiten versionar los cambios en el esquema de base de datos de forma controlada y segura.

### ¿Por qué usar Migraciones en lugar de `db push`?

| Aspecto | `db push` | `migrate` |
|---------|-----------|-----------|
| **Historial** | ❌ No guarda historial | ✅ Historial completo |
| **Rollback** | ❌ No reversible | ✅ Reversible |
| **Producción** | ❌ No recomendado | ✅ Diseñado para producción |
| **Colaboración** | ❌ Difícil de compartir | ✅ Fácil de compartir |
| **Control** | ❌ Automático sin control | ✅ Control total |
| **Datos** | ⚠️ Puede perder datos | ✅ Preserva datos |

### ⚠️ Importante: Nunca uses `db push --force-reset` en producción

El comando `db push --force-reset` **elimina todos los datos** de la base de datos. Solo úsalo en desarrollo cuando estés prototipando y no te importe perder datos.

---

## 📚 Conceptos Básicos

### ¿Qué es una Migración?

Una migración es un archivo SQL que describe cómo transformar el esquema de la base de datos de un estado a otro. Prisma guarda estas migraciones en `prisma/migrations/`.

### Estructura de Migraciones

```
prisma/
├── migrations/
│   ├── 20250101000000_add_phone_to_users/
│   │   └── migration.sql
│   ├── 20250102000000_add_orders_table/
│   │   └── migration.sql
│   └── migration_lock.toml
└── schema.prisma
```

Cada migración tiene:
- **Nombre único**: Timestamp + nombre descriptivo
- **Archivo SQL**: Los comandos SQL a ejecutar
- **Historial**: Prisma rastrea qué migraciones se han aplicado

---

## 🛠️ Comandos Disponibles

### Comandos en el Proyecto

El proyecto incluye los siguientes comandos npm para trabajar con migraciones:

```bash
# Crear y aplicar migración en desarrollo
npm run prisma:migrate -- --name "nombre_descriptivo"

# Aplicar migraciones pendientes (producción)
npm run prisma:migrate:deploy

# Ver estado de migraciones
npm run prisma:migrate:status

# Crear migración sin aplicar
npm run prisma:migrate:create -- --name "nombre_descriptivo"

# Resetear base de datos (SOLO desarrollo)
npm run prisma:migrate:reset

# Generar cliente Prisma
npm run prisma:generate

# Verificar conexión a base de datos
npm run test:db

# Validar configuración del entorno
npm run env:validate
```

### Comandos Directos de Prisma

Si prefieres usar Prisma directamente:

```bash
# Desarrollo
npx prisma migrate dev --name "nombre_descriptivo"

# Producción
npx prisma migrate deploy

# Estado
npx prisma migrate status

# Generar cliente
npx prisma generate
```

---

## 🔄 Flujo de Trabajo Completo

### Escenario Típico: Agregar un Nuevo Campo

Imaginemos que quieres agregar el campo `phone` a la tabla `UserProfile`.

#### **PASO 1: Modificar el Schema (Desarrollo Local)**

1. Abre `prisma/schema.prisma`
2. Encuentra el modelo `UserProfile`
3. Agrega el nuevo campo:

```prisma
model UserProfile {
  id            String         @id @default(uuid())
  email         String         @unique
  firstName     String         @map("first_name")
  lastName      String         @map("last_name")
  phone         String?        // ← Nuevo campo agregado
  // ... resto de campos
}
```

**Nota**: El `?` hace que el campo sea opcional (nullable). Si es requerido y hay datos existentes, necesitarás un valor por defecto.

#### **PASO 2: Crear la Migración**

```bash
# Desde el directorio raíz del proyecto
npm run prisma:migrate -- --name "add_phone_to_user_profile"
```

Este comando:
1. ✅ Detecta los cambios en el schema
2. ✅ Genera el archivo SQL de migración
3. ✅ Aplica la migración a tu base de datos local
4. ✅ Regenera el cliente Prisma automáticamente

**Salida esperada:**
```
Prisma Migrate applied the following migration(s):
  migrations/
    └── 20250123120000_add_phone_to_user_profile/
        └── migration.sql

✔ Generated Prisma Client
```

#### **PASO 3: Verificar la Migración**

```bash
# Ver el archivo SQL generado
cat prisma/migrations/20250123120000_add_phone_to_user_profile/migration.sql
```

Deberías ver algo como:
```sql
-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN "phone" TEXT;
```

#### **PASO 4: Verificar Estado**

```bash
npm run prisma:migrate:status
```

**Salida esperada:**
```
Database schema is up to date!
All migrations have been applied.
```

#### **PASO 5: Probar los Cambios**

```bash
# Verificar conexión
npm run test:db

# Ejecutar tests
npm run test
```

#### **PASO 6: Commit al Repositorio**

```bash
# Agregar archivos de migración
git add prisma/schema.prisma
git add prisma/migrations/

# Commit
git commit -m "feat: add phone field to user profile"

# Push
git push origin main
```

**⚠️ IMPORTANTE**: Siempre sube las migraciones al repositorio. El equipo y el servidor necesitan estos archivos.

---

## 🚀 Despliegue en Producción

### Proceso Completo de Despliegue

Una vez que has creado y probado tu migración localmente, sigue estos pasos para aplicarla en producción:

#### **PASO 1: Preparación (Máquina Local)**

```bash
# 1. Asegúrate de que todo está commiteado
git status

# 2. Verifica que la migración esté en el repositorio
git log --oneline | head -5

# 3. Haz push de tus cambios
git push origin main
```

#### **PASO 2: Conectarte al Servidor**

```bash
# Conectarte al servidor EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Ir al directorio del proyecto
cd /opt/happy-baby-style
```

#### **PASO 3: Actualizar Código en el Servidor**

```bash
# Hacer pull de los cambios
git pull origin main

# Verificar que las nuevas migraciones estén presentes
ls -la prisma/migrations/
```

#### **PASO 4: Verificar Estado Antes de Aplicar**

```bash
# Ver qué migraciones están pendientes
npm run prisma:migrate:status
```

**Salida esperada si hay migraciones pendientes:**
```
The following migration(s) have not yet been applied:
  20250123120000_add_phone_to_user_profile

To apply migrations in development: npx prisma migrate dev
To apply migrations in production/staging: npx prisma migrate deploy
```

#### **PASO 5: Hacer Backup (MUY IMPORTANTE)**

```bash
# Backup de la base de datos
# Opción 1: Usando el script del proyecto (si existe)
npm run db:backup:production

# Opción 2: Manualmente
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U postgres -d happybabystyle > backup_${DATE}.sql

# Verificar que el backup se creó
ls -lh backup_*.sql
```

#### **PASO 6: Aplicar la Migración**

```bash
# Aplicar migraciones pendientes
npm run prisma:migrate:deploy
```

**Salida esperada:**
```
Prisma Migrate applied the following migration(s):
  20250123120000_add_phone_to_user_profile

✔ All migrations have been successfully applied.
```

#### **PASO 7: Regenerar Cliente Prisma**

```bash
# Generar el cliente Prisma con los nuevos tipos
npm run prisma:generate
```

#### **PASO 8: Verificar Estado Final**

```bash
# Verificar que todo está sincronizado
npm run prisma:migrate:status

# Verificar conexión
npm run test:db
```

#### **PASO 9: Reiniciar la Aplicación**

```bash
# Reiniciar con PM2
pm2 restart happy-baby-style

# Ver logs para verificar que todo está bien
pm2 logs happy-baby-style --lines 50
```

#### **PASO 10: Verificación Post-Despliegue**

```bash
# Verificar logs de errores
pm2 logs happy-baby-style --err --lines 20

# Verificar health check
curl http://localhost:3001/health

# Si está configurado, verificar GraphQL
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ health }"}'
```

---

## 📖 Ejemplos Prácticos

### Ejemplo 1: Agregar Campo Opcional

**Objetivo**: Agregar `phone` (opcional) a `UserProfile`

```prisma
model UserProfile {
  // ... campos existentes
  phone String?  // Campo opcional
}
```

**Comando:**
```bash
npm run prisma:migrate -- --name "add_phone_to_user_profile"
```

✅ **Seguro**: No requiere valores por defecto si es opcional.

---

### Ejemplo 2: Agregar Campo Requerido con Valor por Defecto

**Objetivo**: Agregar `status` requerido con valor por defecto

```prisma
model UserProfile {
  // ... campos existentes
  status String @default("active")
}
```

**Comando:**
```bash
npm run prisma:migrate -- --name "add_status_to_user_profile"
```

✅ **Seguro**: El valor por defecto se aplica a filas existentes.

---

### Ejemplo 3: Agregar Campo Requerido SIN Valor por Defecto

**Objetivo**: Agregar `phone` requerido, pero hay datos existentes

**Problema**: Esto fallará si hay datos sin valor.

**Solución A - Agregar valor por defecto temporal:**
```prisma
model UserProfile {
  phone String @default("")  // Valor por defecto temporal
}
```

1. Crear migración:
```bash
npm run prisma:migrate -- --name "add_phone_with_default"
```

2. Actualizar datos existentes (manual o script):
```sql
UPDATE user_profiles SET phone = 'actual_value' WHERE phone = '';
```

3. Modificar schema para quitar default:
```prisma
model UserProfile {
  phone String  // Sin default
}
```

4. Crear segunda migración:
```bash
npm run prisma:migrate -- --name "remove_phone_default"
```

**Solución B - Migración SQL personalizada:**
```bash
# Crear migración sin aplicar
npm run prisma:migrate:create -- --name "add_phone_custom"

# Editar el archivo SQL generado
nano prisma/migrations/XXXXX_add_phone_custom/migration.sql
```

Agregar lógica personalizada:
```sql
-- Agregar columna con valor por defecto temporal
ALTER TABLE "user_profiles" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';

-- Actualizar valores existentes (ejemplo)
UPDATE "user_profiles" 
SET "phone" = COALESCE("email", '') 
WHERE "phone" = '';

-- Quitar el default
ALTER TABLE "user_profiles" ALTER COLUMN "phone" DROP DEFAULT;
```

Luego aplicar:
```bash
npm run prisma:migrate:deploy
```

---

### Ejemplo 4: Crear Nueva Tabla

**Objetivo**: Crear tabla `ProductReviews`

```prisma
model ProductReview {
  id        String   @id @default(uuid())
  productId String   @map("product_id")
  userId    String   @map("user_id")
  rating    Int
  comment   String?
  createdAt DateTime @default(now()) @map("created_at")
  
  product   Product  @relation(fields: [productId], references: [id])
  user      UserProfile @relation(fields: [userId], references: [id])
  
  @@map("product_reviews")
}
```

**Comando:**
```bash
npm run prisma:migrate -- --name "create_product_reviews_table"
```

✅ **Seguro**: Nueva tabla, no afecta datos existentes.

---

### Ejemplo 5: Cambiar Tipo de Columna

**Objetivo**: Cambiar `price` de `Float` a `Decimal`

```prisma
model Product {
  price Decimal @db.Decimal(10, 2)  // Era Float antes
}
```

**Comando:**
```bash
npm run prisma:migrate -- --name "change_price_to_decimal"
```

⚠️ **Riesgoso**: Asegúrate de que los valores existentes sean compatibles.

---

### Ejemplo 6: Eliminar Campo

**Objetivo**: Eliminar campo `oldField`

```prisma
model UserProfile {
  // oldField String  ← Eliminar esta línea
}
```

**Comando:**
```bash
npm run prisma:migrate -- --name "remove_old_field"
```

⚠️ **Riesgoso**: Los datos se perderán. Asegúrate de hacer backup primero.

---

## 🚨 Resolución de Problemas

### Problema 1: "Migration failed to apply"

**Error:**
```
Error: Migration failed to apply
```

**Soluciones:**

1. **Verificar logs detallados:**
```bash
npx prisma migrate deploy --preview-feature
```

2. **Verificar conexión:**
```bash
npm run test:db
```

3. **Revisar el archivo SQL manualmente:**
```bash
cat prisma/migrations/XXXXX_nombre/migration.sql
```

4. **Intentar aplicar manualmente (si es necesario):**
```bash
# Conectarse a PostgreSQL
psql -h localhost -U postgres -d happybabystyle

# Ejecutar el SQL manualmente
\i prisma/migrations/XXXXX_nombre/migration.sql
```

---

### Problema 2: "Database schema is not in sync"

**Error:**
```
Database schema is not in sync with migration history
```

**Causa**: Alguien modificó la base de datos directamente o hay un desajuste.

**Solución:**

1. **Verificar diferencias:**
```bash
npx prisma db pull --print
```

2. **Opciones:**
   - Si es desarrollo: Resetear y recrear
   - Si es producción: Crear migración de ajuste manual

**Para desarrollo:**
```bash
npm run prisma:migrate:reset
npm run prisma:migrate -- --name "sync_schema"
```

**Para producción:**
```bash
# Crear migración de sincronización
npm run prisma:migrate:create -- --name "sync_schema"

# Editar manualmente el SQL para alinear
# Luego aplicar
npm run prisma:migrate:deploy
```

---

### Problema 3: "Cannot add required column without default value"

**Error:**
```
Added the required column `phone` to the `user_profiles` table without a default value. 
There are 5 rows in this table, it is not possible to execute this step.
```

**Solución:**

1. **Hacer el campo opcional temporalmente:**
```prisma
phone String?  // Con ?
```

2. **Crear migración:**
```bash
npm run prisma:migrate -- --name "add_phone_optional"
```

3. **Actualizar datos existentes:**
```sql
UPDATE user_profiles SET phone = 'default_value' WHERE phone IS NULL;
```

4. **Hacer el campo requerido después:**
```prisma
phone String  // Sin ?
```

5. **Segunda migración:**
```bash
npm run prisma:migrate -- --name "make_phone_required"
```

---

### Problema 4: "Permission denied" al generar cliente

**Error:**
```
EACCES: permission denied, unlink '/opt/happy-baby-style/node_modules/.prisma/client/index.js'
```

**Solución:**

```bash
# Detener PM2
pm2 stop happy-baby-style

# Corregir permisos
sudo chown -R ec2-user:ec2-user /opt/happy-baby-style/node_modules/.prisma/

# Regenerar cliente
npm run prisma:generate

# Reiniciar
pm2 restart happy-baby-style
```

---

### Problema 5: Migración parcialmente aplicada

**Error:** Migración falló a mitad de camino.

**Solución:**

1. **Verificar estado:**
```bash
npm run prisma:migrate:status
```

2. **Resolver manualmente:**
```bash
# Si la migración falló, puede estar marcada como aplicada
# pero los cambios no se ejecutaron completamente

# Opción A: Revertir manualmente y volver a aplicar
psql -h localhost -U postgres -d happybabystyle
# Ejecutar comandos de rollback manualmente

# Opción B: Marcar migración como revertida y recrear
# (Requiere acceso directo a la tabla _prisma_migrations)
```

---

## ✅ Mejores Prácticas

### 1. Nombres Descriptivos

✅ **Buenos nombres:**
```bash
npm run prisma:migrate -- --name "add_phone_to_user_profile"
npm run prisma:migrate -- --name "create_product_reviews_table"
npm run prisma:migrate -- --name "add_index_on_user_email"
```

❌ **Nombres malos:**
```bash
npm run prisma:migrate -- --name "update"
npm run prisma:migrate -- --name "changes"
npm run prisma:migrate -- --name "fix"
```

### 2. Migraciones Pequeñas y Atómicas

✅ **Bueno**: Una migración por cambio lógico
```bash
# Migración 1: Agregar campo
npm run prisma:migrate -- --name "add_phone_to_users"

# Migración 2: Agregar índice
npm run prisma:migrate -- --name "add_index_on_phone"
```

❌ **Malo**: Muchos cambios en una sola migración
```bash
# Demasiado en una sola migración
npm run prisma:migrate -- --name "big_update"
```

### 3. Siempre Hacer Backup en Producción

✅ **Antes de cada migración en producción:**
```bash
npm run db:backup:production
# O manualmente
pg_dump -h localhost -U postgres -d happybabystyle > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 4. Probar en Desarrollo Primero

✅ **Workflow:**
1. Desarrollo local → Crear migración
2. Desarrollo local → Probar cambios
3. Desarrollo local → Ejecutar tests
4. Git → Commit y push
5. Producción → Pull, backup, deploy

### 5. Revisar el SQL Generado

✅ **Siempre revisa el SQL antes de aplicar en producción:**
```bash
cat prisma/migrations/XXXXX_nombre/migration.sql
```

### 6. No Modificar Migraciones Aplicadas

⚠️ **Nunca modifiques migraciones que ya se aplicaron en producción.**

Si necesitas corregir algo, crea una nueva migración.

### 7. Commitear Migraciones al Repositorio

✅ **Siempre incluye en git:**
```bash
git add prisma/schema.prisma
git add prisma/migrations/
git commit -m "feat: add phone field to user profile"
```

### 8. Documentar Cambios Importantes

✅ **Si la migración es compleja, documenta en el commit:**
```bash
git commit -m "feat: add phone to user profile

- Add optional phone field to UserProfile model
- Includes migration to add column with nullable constraint
- Updates GraphQL schema to include phone field"
```

---

## 🎯 Casos Especiales

### Caso 1: Migración con Datos Existentes

Cuando tienes datos en producción y necesitas agregar campos requeridos:

```prisma
// Schema original
model Product {
  id    String @id
  name  String
  price Float
}

// Schema nuevo (agregar stock requerido)
model Product {
  id    String @id
  name  String
  price Float
  stock Int    @default(0)  // ✅ Con default
}
```

**Migración automática funciona** porque tiene valor por defecto.

---

### Caso 2: Cambiar Relaciones

**Antes:**
```prisma
model Order {
  userId String
  user   UserProfile @relation(fields: [userId], references: [id])
}
```

**Después (cambiar a One-to-Many):**
```prisma
model UserProfile {
  orders Order[]
}

model Order {
  userId String @map("user_id")
  user   UserProfile @relation(fields: [userId], references: [id])
}
```

**Pasos:**
1. Crear migración
2. Prisma detectará el cambio y ajustará las foreign keys

---

### Caso 3: Migración con Transformación de Datos

**Necesidad**: Renombrar valores de un ENUM

**Solución**: Migración personalizada

```bash
npm run prisma:migrate:create -- --name "update_order_status_enum"
```

Editar `migration.sql`:
```sql
-- Crear nuevo tipo
CREATE TYPE "OrderStatusNew" AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');

-- Actualizar columna
ALTER TABLE "orders" 
  ALTER COLUMN "status" TYPE "OrderStatusNew" 
  USING CASE 
    WHEN "status"::text = 'pending' THEN 'pending'::"OrderStatusNew"
    WHEN "status"::text = 'processing' THEN 'processing'::"OrderStatusNew"
    -- ... más casos
  END;

-- Eliminar tipo viejo
DROP TYPE "OrderStatus";

-- Renombrar tipo nuevo
ALTER TYPE "OrderStatusNew" RENAME TO "OrderStatus";
```

---

## 📋 Referencia Rápida

### Comandos Más Usados

```bash
# Desarrollo: Crear y aplicar migración
npm run prisma:migrate -- --name "nombre_descriptivo"

# Producción: Aplicar migraciones pendientes
npm run prisma:migrate:deploy

# Ver estado
npm run prisma:migrate:status

# Generar cliente
npm run prisma:generate

# Verificar conexión
npm run test:db
```

### Checklist de Migración en Producción

```
[ ] Backup de base de datos creado
[ ] Código actualizado en servidor (git pull)
[ ] Migraciones presentes en prisma/migrations/
[ ] Estado verificado (migrate status)
[ ] Migración aplicada (migrate deploy)
[ ] Cliente Prisma regenerado (prisma generate)
[ ] Aplicación reiniciada (pm2 restart)
[ ] Logs verificados (pm2 logs)
[ ] Health check funcionando (curl /health)
```

### Estructura de Archivos

```
happy-baby-style-backend/
├── prisma/
│   ├── schema.prisma           # Schema principal
│   └── migrations/
│       ├── migration_lock.toml # Lock file
│       └── YYYYMMDDHHMMSS_nombre/
│           └── migration.sql   # SQL de migración
├── .env                        # Variables de entorno
└── package.json               # Scripts npm
```

---

## 🎓 Resumen del Workflow

### Desarrollo
```
1. Modificar schema.prisma
2. npm run prisma:migrate -- --name "descripcion"
3. Probar cambios localmente
4. git add prisma/ && git commit && git push
```

### Producción
```
1. ssh al servidor
2. cd /opt/happy-baby-style
3. git pull
4. npm run db:backup:production
5. npm run prisma:migrate:deploy
6. npm run prisma:generate
7. pm2 restart happy-baby-style
8. Verificar logs y health check
```

---

## 📞 Soporte

Si encuentras problemas:

1. **Revisa esta guía** primero
2. **Revisa los logs**: `pm2 logs happy-baby-style`
3. **Verifica estado**: `npm run prisma:migrate:status`
4. **Consulta documentación de Prisma**: https://www.prisma.io/docs/concepts/components/prisma-migrate

---

**Última actualización**: Enero 2025  
**Versión**: 1.0.0  
**Proyecto**: Happy Baby Style Backend

