# 🚀 Guía Rápida - Exploración de GraphQL API

## ⚡ Inicio Rápido

### **Opción 1: Explorador Automático (Recomendado)**
```bash
cd backend
npm run explore:graphql
```
Este comando:
- ✅ Inicia el servidor automáticamente
- ✅ Abre el GraphQL Playground en tu navegador
- ✅ Verifica que todo esté funcionando

### **Opción 2: Manual**
```bash
cd backend
npm run dev
# Luego abre: http://localhost:3001/graphql
```

## 🎯 Endpoints Principales

| Endpoint | Descripción | Acceso |
|----------|-------------|---------|
| `http://localhost:3001/graphql` | **GraphQL Playground** | Interfaz visual para explorar la API |
| `http://localhost:3001/health` | **Health Check** | Estado del servidor |
| `http://localhost:3001/graphql` | **GraphQL API** | Endpoint para requests |

## 🔍 Qué Puedes Explorar

### **📊 Tipos de Datos Disponibles**
- **Users**: Perfiles de usuario, direcciones, roles
- **Products**: Productos, variantes, categorías, imágenes
- **Orders**: Pedidos, items, estados, tracking
- **Categories**: Categorías de productos
- **Cart**: Carrito de compras
- **Favorites**: Productos favoritos
- **Payment Methods**: Métodos de pago
- **Stats**: Estadísticas del sistema

### **🔍 Queries Principales**
```graphql
# Health check
{ health }

# Productos
{ 
  products { 
    products { id name price } 
    total 
  } 
}

# Categorías
{ 
  categories { 
    id name products { id name } 
  } 
}

# Usuarios
{ 
  users { 
    users { id firstName lastName } 
    total 
  } 
}

# Pedidos
{ 
  orders { 
    orders { id orderNumber status totalAmount } 
    total 
  } 
}

# Estadísticas
{ 
  productStats
  orderStats 
  userStats 
}
```

### **✏️ Mutations Principales**
```graphql
# Crear producto
mutation {
  createProduct(input: {
    name: "Test Product"
    price: "99.99"
    sku: "TEST-001"
  }) {
    id name price
  }
}

# Crear categoría
mutation {
  createCategory(input: {
    name: "Test Category"
    slug: "test-category"
  }) {
    id name slug
  }
}
```

## 🛠️ Herramientas de Exploración

### **1. GraphQL Playground (Recomendado)**
- **Schema Explorer**: Exploración visual del esquema
- **Query Builder**: Constructor de consultas interactivo
- **Documentation**: Documentación automática
- **Variables**: Soporte para variables
- **Headers**: Configuración de autenticación

### **2. Scripts de Prueba**
```bash
# Prueba básica
npm run test:graphql

# Prueba completa
npm run test:graphql:complete
```

### **3. Generación de Tipos**
```bash
# Generar tipos TypeScript
npm run graphql:codegen
```

## 📋 Ejemplos Prácticos

### **Ejemplo 1: Obtener Productos con Filtros**
```graphql
query {
  products(
    filter: {
      isActive: true
      minPrice: "10.00"
      maxPrice: "100.00"
      inStock: true
    }
    pagination: { limit: 10, offset: 0 }
  ) {
    products {
      id
      name
      price
      currentPrice
      hasDiscount
      isInStock
      category { id name }
    }
    total
    hasMore
  }
}
```

### **Ejemplo 2: Dashboard Completo**
```graphql
query Dashboard {
  productStats
  orderStats
  userStats
  categories {
    id
    name
    products { id name stockQuantity }
  }
  orders(
    filter: { status: PAID }
    pagination: { limit: 5 }
  ) {
    orders {
      id
      orderNumber
      totalAmount
      user { firstName lastName }
    }
  }
}
```

## 🔐 Autenticación

Para requests autenticados, agrega en Headers:
```json
{
  "Authorization": "Bearer your-jwt-token"
}
```

## 📊 Monitoreo

- **Logs**: `backend/logs/`
- **Health Check**: `http://localhost:3001/health`
- **Performance**: Monitoreo automático de queries

## 🚀 Comandos Útiles

```bash
# Explorador automático
npm run explore:graphql

# Iniciar servidor
npm run dev

# Probar API
npm run test:graphql:complete

# Generar tipos
npm run graphql:codegen

# Abrir playground
npm run graphql:playground
```

## 🎯 Próximos Pasos

1. **Ejecuta** `npm run explore:graphql`
2. **Explora** el Schema Explorer en el Playground
3. **Prueba** las queries básicas
4. **Experimenta** con filtros y paginación
5. **Crea** mutations para gestionar datos

## 📚 Documentación Completa

Para más detalles, consulta:
- `GRAPHQL_API_EXPLORATION_GUIDE.md` - Guía completa
- `LOGGING_SYSTEM.md` - Sistema de logging
- GraphQL Playground - Documentación automática 