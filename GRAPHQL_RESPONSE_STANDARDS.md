# 🚀 GraphQL Response Standards - Happy Baby Style Backend

## 📋 Tabla de Contenidos

- [🎯 Objetivo](#-objetivo)
- [🏗️ Estructura Base Universal](#️-estructura-base-universal)
- [📊 Tipos de Respuesta Estandarizados](#-tipos-de-respuesta-estandarizados)
- [🔧 Implementación en Código](#-implementación-en-código)
- [📊 Ejemplos de Respuestas](#-ejemplos-de-respuestas)
- [⚠️ Códigos de Error](#️-códigos-de-error)
- [📋 Plan de Implementación](#-plan-de-implementación)
- [✅ Beneficios](#-beneficios)
- [🔍 Casos de Uso](#-casos-de-uso)

---

## 🎯 Objetivo

Estandarizar todas las respuestas de la API GraphQL para proporcionar:
- **Consistencia** en el formato de respuesta
- **Predictibilidad** para el frontend
- **Trazabilidad** completa de operaciones
- **Mantenibilidad** del código
- **Escalabilidad** del sistema

**Principios base**: Clean Architecture, Clean Code, SOLID, DRY

---

## 🏗️ Estructura Base Universal

Todas las respuestas de la API deben seguir esta estructura base:

```typescript
interface BaseResponse<T = any> {
  success: boolean;           // Estado de la operación
  data?: T;                   // Datos de la respuesta
  message: string;            // Mensaje descriptivo
  code: string;               // Código de respuesta
  timestamp: string;          // Timestamp ISO 8601
  metadata?: {                // Metadatos opcionales
    requestId?: string;       // ID único de la petición
    traceId?: string;         // ID para tracing
    duration?: number;        // Duración en milisegundos
  };
}
```

---

## 📊 Tipos de Respuesta Estandarizados

### A. Respuestas de Consulta (Queries)

#### Simple Query Response
```typescript
type SimpleQueryResponse<T> = BaseResponse<T>;
```

**Ejemplo**: Health check, métricas simples, configuraciones

#### Paginated Response
```typescript
type PaginatedResponse<T> = BaseResponse<{
  items: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    currentPage: number;
    totalPages: number;
  };
}>;
```

**Ejemplo**: Lista de usuarios, productos, pedidos

#### Analytics Response
```typescript
type AnalyticsResponse<T> = BaseResponse<{
  data: T;
  period: {
    start: string;
    end: string;
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  };
}>;
```

**Ejemplo**: Dashboard metrics, reportes, estadísticas

### B. Respuestas de Operaciones (Mutations)

#### Create Response
```typescript
type CreateResponse<T> = BaseResponse<{
  entity: T;
  id: string;
  createdAt: string;
}>;
```

**Ejemplo**: Crear usuario, producto, pedido

#### Update Response
```typescript
type UpdateResponse<T> = BaseResponse<{
  entity: T;
  id: string;
  updatedAt: string;
  changes: string[]; // Campos que se modificaron
}>;
```

**Ejemplo**: Actualizar usuario, producto, pedido

#### Delete Response
```typescript
type DeleteResponse = BaseResponse<{
  id: string;
  deletedAt: string;
  softDelete: boolean;
}>;
```

**Ejemplo**: Eliminar usuario, producto, pedido

#### Auth Response
```typescript
type AuthResponse = BaseResponse<{
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  session: {
    id: string;
    expiresAt: string;
  };
}>;
```

**Ejemplo**: Login, registro, refresh token

---

## 🔧 Implementación en Código

### 1. ResponseFactory (Patrón Factory)

```typescript
// src/shared/factories/ResponseFactory.ts
export class ResponseFactory {
  private static generateMetadata(
    requestId?: string, 
    traceId?: string, 
    duration?: number
  ) {
    return {
      requestId,
      traceId,
      duration,
      timestamp: new Date().toISOString()
    };
  }

  static createSuccessResponse<T>(
    data: T,
    message: string,
    code: string = 'SUCCESS',
    metadata?: Partial<ResponseMetadata>
  ): BaseResponse<T> {
    return {
      success: true,
      data,
      message,
      code,
      timestamp: new Date().toISOString(),
      metadata: {
        ...this.generateMetadata(),
        ...metadata
      }
    };
  }

  static createErrorResponse(
    message: string,
    code: string,
    details?: any,
    metadata?: Partial<ResponseMetadata>
  ): BaseResponse<null> {
    return {
      success: false,
      data: null,
      message,
      code,
      timestamp: new Date().toISOString(),
      metadata: {
        ...this.generateMetadata(),
        ...metadata
      }
    };
  }

  static createPaginatedResponse<T>(
    items: T[],
    pagination: PaginationInfo,
    message: string = 'Data retrieved successfully',
    metadata?: Partial<ResponseMetadata>
  ): BaseResponse<PaginatedData<T>> {
    return this.createSuccessResponse(
      { items, pagination },
      message,
      'PAGINATED_SUCCESS',
      metadata
    );
  }
}
```

### 2. Códigos de Respuesta Estandarizados

```typescript
// src/shared/constants/ResponseCodes.ts
export const RESPONSE_CODES = {
  // Éxitos
  SUCCESS: 'SUCCESS',
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED',
  PAGINATED_SUCCESS: 'PAGINATED_SUCCESS',
  
  // Errores de validación
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Errores de negocio
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Errores del sistema
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR'
} as const;
```

### 3. Resolver Estandarizado

```typescript
// src/graphql/resolvers.ts - Patrón a seguir
createUser: async (_: any, { input }: { input: any }, context: Context) => {
  const startTime = Date.now();
  const traceId = context.traceId;
  
  try {
    const createUserUseCase = container.get<CreateUserUseCase>('createUserUseCase');
    const user = await createUserUseCase.execute({
      email: input.email,
      password: input.password,
      role: input.role,
      isActive: input.isActive !== undefined ? input.isActive : true,
      profile: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        birthDate: input.dateOfBirth
      }
    });

    const duration = Date.now() - startTime;
    
    return ResponseFactory.createSuccessResponse(
      {
        entity: transformUser(user),
        id: user.id,
        createdAt: user.createdAt
      },
      'User created successfully',
      RESPONSE_CODES.CREATED,
      {
        requestId: context.requestId,
        traceId,
        duration
      }
    );

  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorResponse = GraphQLErrorHandler.handleError(error);
    
    // Log del error con contexto completo
    console.error('CreateUser resolver error:', {
      error: errorResponse,
      input,
      context: { requestId: context.requestId, traceId },
      duration,
      timestamp: new Date()
    });
    
    return ResponseFactory.createErrorResponse(
      errorResponse.message,
      errorResponse.code || RESPONSE_CODES.INTERNAL_ERROR,
      errorResponse.details,
      {
        requestId: context.requestId,
        traceId,
        duration
      }
    );
  }
};
```

---

## 📊 Ejemplos de Respuestas

### 1. Respuesta de Consulta Exitosa

```json
{
  "data": {
    "users": {
      "success": true,
      "message": "Users retrieved successfully",
      "code": "PAGINATED_SUCCESS",
      "timestamp": "2025-08-11T04:35:00.000Z",
      "data": {
        "items": [
          {
            "id": "5a1c4809-7e17-4a78-a403-405c8ca32a67",
            "email": "marco.arka@gmail.com",
            "role": "admin",
            "isActive": true
          }
        ],
        "pagination": {
          "total": 1,
          "limit": 10,
          "offset": 0,
          "hasMore": false,
          "currentPage": 1,
          "totalPages": 1
        }
      },
      "metadata": {
        "requestId": "req_123",
        "traceId": "trace_456",
        "duration": 45
      }
    }
  }
}
```

### 2. Respuesta de Creación Exitosa

```json
{
  "data": {
    "createUser": {
      "success": true,
      "message": "User created successfully",
      "code": "CREATED",
      "timestamp": "2025-08-11T04:35:00.000Z",
      "data": {
        "entity": {
          "id": "d8113dbc-1c8f-49a8-802c-bdea84b32ca4",
          "email": "test@test.com",
          "role": "customer"
        },
        "id": "d8113dbc-1c8f-49a8-802c-bdea84b32ca4",
        "createdAt": "2025-08-11T04:35:00.000Z"
      },
      "metadata": {
        "requestId": "req_123",
        "traceId": "trace_456",
        "duration": 120
      }
    }
  }
}
```

### 3. Respuesta de Error Estructurada

```json
{
  "data": {
    "createUser": {
      "success": false,
      "message": "Validation failed: Birth date is invalid",
      "code": "VALIDATION_ERROR",
      "timestamp": "2025-08-11T04:35:00.000Z",
      "data": null,
      "metadata": {
        "requestId": "req_123",
        "traceId": "trace_456",
        "duration": 15
      }
    }
  }
}
```

---

## ⚠️ Códigos de Error

### Códigos de Éxito
- `SUCCESS` - Operación exitosa genérica
- `CREATED` - Recurso creado exitosamente
- `UPDATED` - Recurso actualizado exitosamente
- `DELETED` - Recurso eliminado exitosamente
- `PAGINATED_SUCCESS` - Consulta paginada exitosa

### Códigos de Error de Validación
- `VALIDATION_ERROR` - Error general de validación
- `INVALID_INPUT` - Input inválido
- `MISSING_REQUIRED_FIELD` - Campo requerido faltante
- `INVALID_EMAIL` - Email inválido
- `INVALID_PASSWORD` - Contraseña inválida
- `INVALID_BIRTH_DATE` - Fecha de nacimiento inválida

### Códigos de Error de Negocio
- `USER_NOT_FOUND` - Usuario no encontrado
- `USER_ALREADY_EXISTS` - Usuario ya existe
- `INSUFFICIENT_PERMISSIONS` - Permisos insuficientes
- `RESOURCE_NOT_FOUND` - Recurso no encontrado
- `RESOURCE_ALREADY_EXISTS` - Recurso ya existe

### Códigos de Error del Sistema
- `INTERNAL_ERROR` - Error interno del servidor
- `SERVICE_UNAVAILABLE` - Servicio no disponible
- `DATABASE_ERROR` - Error de base de datos
- `NETWORK_ERROR` - Error de red
- `TIMEOUT_ERROR` - Error de timeout

---

## 📋 Plan de Implementación

### Fase 1: Estructura Base (1-2 días)
- [ ] Crear `ResponseFactory` con métodos base
- [ ] Definir constantes de códigos de respuesta
- [ ] Crear tipos base en schema GraphQL
- [ ] Implementar en un resolver de prueba

### Fase 2: Resolvers Críticos (2-3 días)
- [ ] Estandarizar `createUser`, `updateUser`, `deleteUser`
- [ ] Implementar en queries principales (`users`, `products`)
- [ ] Aplicar a operaciones de autenticación
- [ ] Crear tests unitarios

### Fase 3: Validaciones y Errores (1-2 días)
- [ ] Mejorar `GraphQLErrorHandler` para usar códigos específicos
- [ ] Implementar logging consistente con metadata
- [ ] Crear tests para todos los tipos de respuesta
- [ ] Documentar códigos de error

### Fase 4: Documentación y Testing (1 día)
- [ ] Documentar códigos de respuesta
- [ ] Crear guías de uso para frontend
- [ ] Validar con tests de integración
- [ ] Revisar y optimizar

---

## ✅ Beneficios

### Para Desarrolladores
- **Consistencia**: Todas las respuestas siguen el mismo patrón
- **Predictibilidad**: Siempre sabe qué estructura esperar
- **Debugging**: Metadata completa para troubleshooting
- **Mantenibilidad**: Cambios centralizados en un solo lugar
- **Testing**: Estructura consistente para tests

### Para Frontend
- **UX mejorada**: Mensajes claros y códigos específicos
- **Manejo de errores**: Estructura consistente para mostrar errores
- **Loading states**: Metadata de duración para indicadores
- **Internacionalización**: Códigos para múltiples idiomas
- **Type safety**: Tipos consistentes para TypeScript

### Para Operaciones
- **Monitoreo**: Logs estructurados para análisis
- **Performance**: Métricas de duración por operación
- **Trazabilidad**: RequestId y TraceId para debugging
- **Alertas**: Códigos específicos para sistemas de alerta
- **Métricas**: Conteo de tipos de respuesta por operación

---

## 🔍 Casos de Uso

### 1. Crear Usuario
```typescript
// Input
{
  email: "user@example.com",
  password: "SecurePass123",
  firstName: "John",
  lastName: "Doe"
}

// Respuesta exitosa
{
  success: true,
  code: "CREATED",
  message: "User created successfully",
  data: {
    entity: { /* user data */ },
    id: "uuid",
    createdAt: "2025-08-11T..."
  }
}
```

### 2. Listar Usuarios Paginados
```typescript
// Input
{
  pagination: { limit: 10, offset: 0 }
}

// Respuesta exitosa
{
  success: true,
  code: "PAGINATED_SUCCESS",
  message: "Users retrieved successfully",
  data: {
    items: [ /* users array */ ],
    pagination: {
      total: 100,
      limit: 10,
      offset: 0,
      hasMore: true,
      currentPage: 1,
      totalPages: 10
    }
  }
}
```

### 3. Error de Validación
```typescript
// Input inválido
{
  email: "invalid-email",
  password: "123"
}

// Respuesta de error
{
  success: false,
  code: "VALIDATION_ERROR",
  message: "Validation failed: Invalid email format",
  data: null,
  metadata: {
    requestId: "req_123",
    traceId: "trace_456",
    duration: 15
  }
}
```

---

## 🚀 Próximos Pasos

1. **Revisar** esta documentación con el equipo
2. **Implementar** la estructura base en un resolver de prueba
3. **Validar** que cumple con los requisitos del frontend
4. **Migrar** resolver por resolver siguiendo el plan
5. **Documentar** cualquier ajuste o mejora identificada

---

## 📚 Referencias

- [GraphQL Specification](https://graphql.org/learn/)
- [Clean Architecture Principles](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [REST API Design Best Practices](https://restfulapi.net/)

---

## 👥 Contribución

Para contribuir a este estándar:
1. Revisar la implementación actual
2. Proponer mejoras o ajustes
3. Implementar cambios siguiendo el patrón establecido
4. Actualizar esta documentación
5. Crear tests para validar cambios

---

**Última actualización**: Agosto 2025  
**Versión**: 1.0.0  
**Estado**: Propuesta de implementación
