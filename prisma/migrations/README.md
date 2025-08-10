# 🔄 PLAN DE MIGRACIÓN PRISMA - DESARROLLO A PRODUCCIÓN

## 📋 **ESTRATEGIA DE MIGRACIÓN SEGURA**

### **🎯 OBJETIVO**
Migrar cambios del esquema de desarrollo a producción **sin afectar los datos existentes** y manteniendo la integridad de la base de datos.

## 🏗️ **ARQUITECTURA DE MIGRACIÓN**

### **1️⃣ ENTORNOS DE BASE DE DATOS**
```
Desarrollo (AWS RDS) ←→ Producción (EC2 Local)
     ↓                        ↓
Schema Changes           Data Preservation
```

### **2️⃣ FLUJO DE MIGRACIÓN**
```
1. Desarrollo: Crear migración
2. Desarrollo: Probar migración
3. Staging: Validar migración
4. Producción: Aplicar migración
5. Producción: Verificar integridad
```

## 🛠️ **HERRAMIENTAS Y COMANDOS**

### **📦 Comandos de Migración**
```bash
# Desarrollo - Crear migración
npm run prisma:migrate:dev

# Desarrollo - Aplicar migración
npm run prisma:migrate:deploy

# Generar cliente Prisma
npm run prisma:generate

# Resetear base de datos (SOLO DESARROLLO)
npm run prisma:migrate:reset

# Ver estado de migraciones
npm run prisma:migrate:status

# Crear migración sin aplicar
npm run prisma:migrate:create
```

## 🔄 **PROCESO DE MIGRACIÓN SEGURA**

### **PASO 1: PREPARACIÓN EN DESARROLLO**
```bash
# 1. Crear migración en desarrollo
cd backend
npm run prisma:migrate:dev --name "add_new_feature"

# 2. Verificar migración
npm run prisma:migrate:status

# 3. Probar cambios
npm run test
```

### **PASO 2: VALIDACIÓN EN STAGING**
```bash
# 1. Aplicar migración a staging
NODE_ENV=staging npm run prisma:migrate:deploy

# 2. Ejecutar tests de integración
npm run test:integration

# 3. Verificar integridad de datos
npm run db:verify
```

### **PASO 3: DESPLIEGUE A PRODUCCIÓN**
```bash
# 1. Backup de producción
npm run db:backup:production

# 2. Aplicar migración
NODE_ENV=production npm run prisma:migrate:deploy

# 3. Verificar aplicación
npm run db:verify:production
```

## 📊 **TIPOS DE MIGRACIONES**

### **🟢 MIGRACIONES SEGURAS (Sin pérdida de datos)**
- ✅ Agregar nuevas tablas
- ✅ Agregar nuevas columnas (con valores por defecto)
- ✅ Agregar índices
- ✅ Agregar constraints únicos
- ✅ Modificar tipos de datos compatibles

### **🟡 MIGRACIONES RIESGOSAS (Requieren atención)**
- ⚠️ Eliminar columnas
- ⚠️ Modificar tipos de datos incompatibles
- ⚠️ Agregar constraints NOT NULL sin valor por defecto
- ⚠️ Cambiar nombres de columnas
- ⚠️ Modificar relaciones

### **🔴 MIGRACIONES PELIGROSAS (Requieren planificación)**
- ❌ Eliminar tablas
- ❌ Cambiar claves primarias
- ❌ Modificar relaciones complejas
- ❌ Cambios estructurales mayores

## 🛡️ **ESTRATEGIAS DE PROTECCIÓN**

### **1️⃣ BACKUP AUTOMÁTICO**
```bash
# Script de backup antes de migración
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_${DATE}.sql
```

### **2️⃣ MIGRACIÓN REVERSIBLE**
```sql
-- Ejemplo: Agregar columna con rollback
-- Forward
ALTER TABLE users ADD COLUMN new_field VARCHAR(255) DEFAULT 'default_value';

-- Rollback
ALTER TABLE users DROP COLUMN new_field;
```

### **3️⃣ VALIDACIÓN DE DATOS**
```typescript
// Verificar integridad post-migración
async function verifyDataIntegrity() {
  const userCount = await prisma.userProfile.count();
  const orderCount = await prisma.order.count();
  
  console.log(`Users: ${userCount}, Orders: ${orderCount}`);
  
  // Verificar relaciones
  const orphanedOrders = await prisma.order.findMany({
    where: { user: null }
  });
  
  if (orphanedOrders.length > 0) {
    throw new Error('Found orphaned orders');
  }
}
```

## 📝 **SCRIPTS DE MIGRACIÓN**

### **1️⃣ Script de Migración Segura**
```bash
#!/bin/bash
# scripts/safe-migration.sh

set -e

echo "🔄 Iniciando migración segura..."

# 1. Backup
echo "📦 Creando backup..."
npm run db:backup

# 2. Validar migración
echo "🔍 Validando migración..."
npm run prisma:migrate:status

# 3. Aplicar migración
echo "🚀 Aplicando migración..."
npm run prisma:migrate:deploy

# 4. Verificar integridad
echo "✅ Verificando integridad..."
npm run db:verify

echo "🎉 Migración completada exitosamente!"
```

### **2️⃣ Script de Rollback**
```bash
#!/bin/bash
# scripts/rollback-migration.sh

set -e

echo "🔄 Iniciando rollback..."

# 1. Restaurar backup
echo "📦 Restaurando backup..."
npm run db:restore

# 2. Verificar restauración
echo "✅ Verificando restauración..."
npm run db:verify

echo "🎉 Rollback completado exitosamente!"
```

## 🔍 **MONITOREO Y VERIFICACIÓN**

### **1️⃣ Health Checks Post-Migración**
```typescript
// Verificar conectividad y esquema
async function postMigrationHealthCheck() {
  // 1. Verificar conexión
  await prisma.$connect();
  
  // 2. Verificar esquema
  const tables = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `;
  
  // 3. Verificar datos críticos
  const userCount = await prisma.userProfile.count();
  const orderCount = await prisma.order.count();
  
  return {
    status: 'healthy',
    tables: tables.length,
    users: userCount,
    orders: orderCount
  };
}
```

### **2️⃣ Logs de Migración**
```typescript
// Logging detallado de migraciones
const migrationLogger = {
  info: (message: string, data?: any) => {
    console.log(`[MIGRATION] ${message}`, data);
  },
  error: (message: string, error?: any) => {
    console.error(`[MIGRATION ERROR] ${message}`, error);
  }
};
```

## 🎯 **MEJORES PRÁCTICAS**

### **1️⃣ ANTES DE LA MIGRACIÓN**
- ✅ Crear backup completo
- ✅ Probar en entorno de staging
- ✅ Documentar cambios
- ✅ Planificar ventana de mantenimiento
- ✅ Preparar rollback plan

### **2️⃣ DURANTE LA MIGRACIÓN**
- ✅ Ejecutar en horario de bajo tráfico
- ✅ Monitorear logs en tiempo real
- ✅ Tener equipo de soporte disponible
- ✅ Mantener comunicación con stakeholders

### **3️⃣ DESPUÉS DE LA MIGRACIÓN**
- ✅ Verificar integridad de datos
- ✅ Ejecutar tests de regresión
- ✅ Monitorear performance
- ✅ Documentar lecciones aprendidas

## 🚨 **CASOS DE EMERGENCIA**

### **1️⃣ MIGRACIÓN FALLIDA**
```bash
# 1. Detener aplicación
pm2 stop happy-baby-style-backend

# 2. Restaurar backup
npm run db:restore

# 3. Reiniciar aplicación
pm2 start happy-baby-style-backend

# 4. Verificar estado
npm run health:check
```

### **2️⃣ DATOS CORRUPTOS**
```bash
# 1. Identificar problema
npm run db:diagnose

# 2. Restaurar punto de control
npm run db:restore:checkpoint

# 3. Reparar datos si es posible
npm run db:repair
```

## 📊 **MÉTRICAS DE ÉXITO**

### **1️⃣ TIEMPO DE MIGRACIÓN**
- Objetivo: < 5 minutos para migraciones simples
- Objetivo: < 30 minutos para migraciones complejas

### **2️⃣ DISPONIBILIDAD**
- Objetivo: 99.9% uptime durante migraciones
- Tolerancia: Máximo 5 minutos de downtime

### **3️⃣ INTEGRIDAD DE DATOS**
- Objetivo: 100% de datos preservados
- Verificación: Tests automatizados post-migración

## 🎉 **CONCLUSIÓN**

Con este plan de migración, puedes:

1. ✅ **Migrar con confianza** entre entornos
2. ✅ **Preservar datos** de producción
3. ✅ **Mantener disponibilidad** del servicio
4. ✅ **Recuperar rápidamente** en caso de problemas
5. ✅ **Escalar** el proceso según necesidades

**¡La migración segura es posible!** 🚀 