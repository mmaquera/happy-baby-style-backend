# 🚀 Plan de Migración Completa a GraphQL

## 📋 **Estado Actual**

### ✅ **Completado**
- **GraphQL Schema**: Definido completo con 20+ queries y 30+ mutations
- **Resolvers Básicos**: Implementados con inyección de dependencias
- **Conexión a BD**: Prisma + Supabase funcionando
- **Clean Architecture**: Respetada en GraphQL resolvers

### ❌ **Pendiente**
- **Funcionalidades de Imágenes**: Upload/Delete en GraphQL
- **Estadísticas Avanzadas**: orderStats, userStats completos
- **Eliminación de REST API**: Remover completamente

## 🎯 **Plan de Migración**

### **Fase 1: Completar Funcionalidades Faltantes** 🔧

#### **1.1 Funcionalidades de Imágenes**
```graphql
# Agregar al schema
type Mutation {
  uploadImage(file: Upload!, entityType: String!, entityId: String!): Image!
  deleteImage(id: ID!): SuccessResponse!
}

type Query {
  images(entityType: String!, entityId: String!): [Image!]!
}
```

#### **1.2 Estadísticas Completas**
```graphql
# Implementar en resolvers
orderStats: async () => {
  const getOrderStatsUseCase = container.get('getOrderStatsUseCase');
  return await getOrderStatsUseCase.execute();
},

userStats: async () => {
  const getUserStatsUseCase = container.get('getUserStatsUseCase');
  return await getUserStatsUseCase.execute();
}
```

### **Fase 2: Eliminación Gradual de REST API** 🗑️

#### **2.1 Archivos a Eliminar**
```
src/presentation/routes/
├── productRoutes.ts ❌
├── userRoutes.ts ❌
├── orderRoutes.ts ❌
└── imageRoutes.ts ❌

src/presentation/controllers/
├── ProductController.ts ❌
├── UserController.ts ❌
├── OrderController.ts ❌
└── ImageController.ts ❌

src/presentation/middleware/
└── validateRequest.ts ❌ (reemplazar con GraphQL validation)
```

#### **2.2 Actualizar index.ts**
```typescript
// REMOVER
import { createProductRoutes } from '@presentation/routes/productRoutes';
import { createImageRoutes } from '@presentation/routes/imageRoutes';
import { createOrderRoutes } from '@presentation/routes/orderRoutes';
import { createUserRoutes } from '@presentation/routes/userRoutes';

// REMOVER
app.use('/api/products', createProductRoutes(productController));
app.use('/api/images', createImageRoutes(imageController));
app.use('/api/orders', createOrderRoutes(orderController));
app.use('/api/users', createUserRoutes(userController));

// MANTENER SOLO
app.get('/health', (req, res) => { /* ... */ });
// GraphQL endpoint
```

### **Fase 3: Optimización de Clean Architecture** 🏗️

#### **3.1 Mantener Capas**
```
src/
├── domain/ ✅ (mantener)
├── application/ ✅ (mantener)
├── infrastructure/ ✅ (mantener)
├── presentation/ ❌ (eliminar REST, mantener GraphQL)
└── graphql/ ✅ (mantener y expandir)
```

#### **3.2 GraphQL Validation**
```typescript
// Crear src/graphql/validation.ts
export const validateGraphQLInput = (input: any, rules: ValidationRule[]) => {
  // Implementar validación similar a express-validator
};
```

### **Fase 4: Testing y Documentación** 📚

#### **4.1 Scripts de Testing**
```bash
npm run test:graphql:complete  # ✅ Ya creado
npm run test:graphql:mutations # Crear
npm run test:graphql:images    # Crear
```

#### **4.2 Documentación Actualizada**
- Actualizar README.md
- Documentar solo GraphQL endpoints
- Ejemplos de queries/mutations

## 🛠️ **Implementación**

### **Paso 1: Completar Imágenes en GraphQL**
1. Agregar Upload scalar al schema
2. Implementar resolvers para upload/delete
3. Probar con archivos reales

### **Paso 2: Eliminar REST API**
1. Comentar rutas en index.ts
2. Eliminar archivos de routes y controllers
3. Actualizar container.ts
4. Probar que solo GraphQL funcione

### **Paso 3: Limpiar Dependencias**
```json
// Remover de package.json
"express-validator"
"multer"
```

### **Paso 4: Actualizar Frontend**
1. Migrar todas las llamadas REST a GraphQL
2. Actualizar hooks y servicios
3. Probar funcionalidad completa

## 📊 **Métricas de Éxito**

- ✅ **0 endpoints REST** activos
- ✅ **100% funcionalidad** en GraphQL
- ✅ **Clean Architecture** respetada
- ✅ **Performance** mejorada
- ✅ **Documentación** actualizada

## 🎯 **Resultado Final**

```
Backend GraphQL Puro
├── GraphQL API (único endpoint)
├── Clean Architecture
├── Prisma ORM
├── Supabase Database
└── TypeScript
```

**Sin REST API, solo GraphQL con Clean Architecture completa.** 