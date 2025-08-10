# Sistema de Logging - Happy Baby Style Backend

## 📋 Descripción General

El sistema de logging implementado sigue los principios de **Clean Architecture** y **Clean Code**, proporcionando un sistema robusto, escalable y configurable para el registro de eventos, errores y métricas de rendimiento.

## 🏗️ Arquitectura del Sistema

### Estructura de Capas

```
┌─────────────────────────────────────┐
│           Domain Layer              │
│  ┌─────────────────────────────┐    │
│  │      ILogger Interface      │    │
│  │   LogLevel, LogContext      │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
                    │
┌─────────────────────────────────────┐
│        Infrastructure Layer         │
│  ┌─────────────────────────────┐    │
│  │     WinstonLogger          │    │
│  │   LoggerConfigManager      │    │
│  │   LoggerFactory            │    │
│  │   RequestLogger            │    │
│  │   PerformanceLogger        │    │
│  │   LoggingDecorator         │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

## 🔧 Componentes Principales

### 1. **ILogger Interface** (`@domain/interfaces/ILogger.ts`)
- Define el contrato para todas las operaciones de logging
- Incluye métodos para diferentes niveles de log
- Soporte para contexto y trace ID
- Capacidad de crear loggers hijos

### 2. **WinstonLogger** (`@infrastructure/logging/WinstonLogger.ts`)
- Implementación concreta usando Winston
- Soporte para múltiples transportes (consola, archivo, rotación diaria)
- Formateo configurable (JSON, simple)
- Manejo especializado de errores de dominio

### 3. **LoggerConfigManager** (`@infrastructure/logging/LoggerConfig.ts`)
- Gestión centralizada de configuración
- Carga desde variables de entorno
- Configuración por defecto sensible
- Patrón Singleton para configuración global

### 4. **LoggerFactory** (`@infrastructure/logging/LoggerFactory.ts`)
- Factory pattern para creación de loggers
- Loggers especializados por módulo/servicio
- Logger de rendimiento configurable
- Logger no-op para cuando el logging está deshabilitado

### 5. **RequestLogger** (`@infrastructure/logging/RequestLogger.ts`)
- Middleware para logging de requests HTTP
- Logging de GraphQL requests/responses
- Logging de operaciones de base de datos
- Logging de eventos de autenticación
- Sanitización automática de datos sensibles

### 6. **PerformanceLogger** (`@infrastructure/logging/PerformanceLogger.ts`)
- Medición de rendimiento de operaciones
- Timing automático con callbacks
- Métricas de rendimiento
- Detección de operaciones lentas

### 7. **LoggingDecorator** (`@infrastructure/logging/LoggingDecorator.ts`)
- Decoradores para logging automático
- Soporte para casos de uso, repositorios y servicios
- Medición automática de rendimiento
- Sanitización automática de datos

## ⚙️ Configuración

### Variables de Entorno

```bash
# Nivel de logging
LOG_LEVEL=info                    # debug, info, warn, error, fatal

# Transportes
LOG_ENABLE_CONSOLE=true           # Habilitar logging en consola
LOG_ENABLE_FILE=true              # Habilitar logging en archivo
LOG_ENABLE_DAILY_ROTATE=true      # Rotación diaria de archivos

# Configuración de archivos
LOG_DIRECTORY=./logs              # Directorio de logs
LOG_MAX_FILES=14d                 # Retención de archivos (14 días)
LOG_MAX_SIZE=20m                  # Tamaño máximo por archivo

# Formato
LOG_FORMAT=json                   # json o simple
LOG_INCLUDE_TIMESTAMP=true        # Incluir timestamp
LOG_INCLUDE_TRACE_ID=true         # Incluir trace ID
LOG_INCLUDE_REQUEST_ID=true       # Incluir request ID
LOG_INCLUDE_USER_ID=true          # Incluir user ID

# Opciones avanzadas
LOG_ENABLE_ERROR_STACK=true       # Incluir stack trace en errores
LOG_ENABLE_PERFORMANCE=true       # Habilitar logging de rendimiento
```

## 📝 Uso del Sistema

### 1. **Logging Básico**

```typescript
import { LoggerFactory } from '@infrastructure/logging/LoggerFactory';

const logger = LoggerFactory.getInstance().getDefaultLogger();

logger.info('Mensaje informativo', { context: 'valor' });
logger.error('Error ocurrido', error, { operation: 'createUser' });
```

### 2. **Loggers Especializados**

```typescript
// Logger para casos de uso
const useCaseLogger = LoggerFactory.getInstance().createUseCaseLogger('CreateProductUseCase');

// Logger para repositorios
const repositoryLogger = LoggerFactory.getInstance().createRepositoryLogger('ProductRepository');

// Logger para servicios
const serviceLogger = LoggerFactory.getInstance().createServiceLogger('AuthService');
```

### 3. **Logging con Contexto**

```typescript
const logger = LoggerFactory.getInstance().createLoggerWithContext({
  module: 'Product',
  operation: 'create',
  userId: 'user123'
});

logger.info('Producto creado exitosamente', { productId: 'prod456' });
```

### 4. **Decoradores Automáticos**

```typescript
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';

export class CreateProductUseCase {
  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    context: { useCase: 'CreateProduct' }
  })
  async execute(request: CreateProductRequest): Promise<ProductEntity> {
    // Implementación del caso de uso
  }
}
```

### 5. **Logging de Requests HTTP**

```typescript
import { RequestLogger } from '@infrastructure/logging/RequestLogger';

const requestLogger = new RequestLogger();

// Middleware automático
app.use(requestLogger.middleware());

// Logging manual de GraphQL
requestLogger.logGraphQLRequest('GetProducts', query, variables, userId, traceId);
```

### 6. **Medición de Rendimiento**

```typescript
import { PerformanceLogger } from '@infrastructure/logging/PerformanceLogger';

const perfLogger = new PerformanceLogger();

// Timing manual
const operationId = perfLogger.startTimer('databaseQuery', { table: 'products' });
const result = await database.query('SELECT * FROM products');
perfLogger.endTimer(operationId, { rows: result.length });

// Timing con callback
const { result, measurement } = await perfLogger.timeOperation(
  'createProduct',
  () => productRepository.create(product),
  { category: 'electronics' }
);
```

## 🔒 Seguridad y Privacidad

### Sanitización Automática

El sistema sanitiza automáticamente datos sensibles:

- **Contraseñas**: `[REDACTED]`
- **Tokens**: `[REDACTED]`
- **Claves secretas**: `[REDACTED]`
- **Headers de autorización**: `[REDACTED]`

### Configuración de Sensibilidad

```typescript
// Campos sensibles por defecto
const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];

// Headers sensibles
const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
```

## 📊 Monitoreo y Métricas

### Métricas de Rendimiento

```typescript
const summary = performanceLogger.getSummary();
console.log({
  totalOperations: summary.totalOperations,
  averageDuration: summary.averageDuration,
  slowOperations: summary.slowOperations.length
});
```

### Logs Estructurados

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Product created successfully",
  "context": {
    "traceId": "trace_1705312200000_abc123",
    "requestId": "req_1705312200000_def456",
    "userId": "user123",
    "operation": "CreateProduct",
    "productId": "prod789",
    "duration": 150
  }
}
```

## 🚀 Escalabilidad

### Características de Escalabilidad

1. **Rotación de Archivos**: Evita archivos de log infinitos
2. **Compresión**: Reduce el uso de almacenamiento
3. **Niveles Configurables**: Control granular del verbosity
4. **Loggers Especializados**: Optimización por contexto
5. **Performance Monitoring**: Detección de cuellos de botella
6. **Trace ID**: Seguimiento de requests a través de servicios

### Configuración para Producción

```bash
# Producción - Logging mínimo
LOG_LEVEL=warn
LOG_ENABLE_CONSOLE=false
LOG_ENABLE_FILE=true
LOG_ENABLE_DAILY_ROTATE=true
LOG_MAX_FILES=30d
LOG_MAX_SIZE=100m
LOG_FORMAT=json
LOG_ENABLE_PERFORMANCE=true

# Desarrollo - Logging detallado
LOG_LEVEL=debug
LOG_ENABLE_CONSOLE=true
LOG_ENABLE_FILE=true
LOG_FORMAT=simple
LOG_ENABLE_PERFORMANCE=true
```

## 🧪 Testing

### Logger de Testing

```typescript
// En tests, usar logger no-op
const testLogger = LoggerFactory.getInstance().createNoOpLogger();

// O mockear el logger
jest.mock('@infrastructure/logging/LoggerFactory', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => mockLogger,
      getDefaultLogger: () => mockLogger
    })
  }
}));
```

## 📈 Mejores Prácticas

### 1. **Niveles de Log Apropiados**
- `debug`: Información detallada para desarrollo
- `info`: Eventos normales de la aplicación
- `warn`: Situaciones que requieren atención
- `error`: Errores que afectan funcionalidad
- `fatal`: Errores críticos que requieren acción inmediata

### 2. **Contexto Significativo**
```typescript
// ✅ Bueno
logger.info('User login successful', {
  userId: user.id,
  method: 'email',
  ip: request.ip
});

// ❌ Malo
logger.info('Login successful');
```

### 3. **Performance Logging**
```typescript
// ✅ Medir operaciones costosas
const { result, measurement } = await perfLogger.timeOperation(
  'databaseQuery',
  () => repository.findComplexData(filters)
);

// ✅ Detectar operaciones lentas automáticamente
if (measurement.duration > 1000) {
  logger.warn('Slow operation detected', { duration: measurement.duration });
}
```

### 4. **Error Handling**
```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', error, {
    operation: 'riskyOperation',
    userId: currentUser.id
  });
  throw error; // Re-throw para mantener el flujo
}
```

## 🔧 Mantenimiento

### Limpieza de Logs

```bash
# Script de limpieza automática (cron job)
find ./logs -name "*.log" -mtime +30 -delete
find ./logs -name "*.log.gz" -mtime +90 -delete
```

### Monitoreo de Logs

```bash
# Ver logs en tiempo real
tail -f logs/application-$(date +%Y-%m-%d).log

# Buscar errores
grep '"level":"error"' logs/application-*.log

# Análisis de rendimiento
grep '"duration":[0-9]\{4,\}' logs/application-*.log
```

## 📚 Referencias

- [Winston Documentation](https://github.com/winstonjs/winston)
- [Clean Architecture Principles](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Structured Logging Best Practices](https://www.datadoghq.com/blog/engineering/structured-logging/) 