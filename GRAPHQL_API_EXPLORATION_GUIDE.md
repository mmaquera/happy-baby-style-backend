# Guía de Exploración de la API GraphQL - Happy Baby Style

## 🎯 Descripción General

El proyecto backend expone una **API GraphQL completa** que permite gestionar todos los aspectos del sistema Happy Baby Style, incluyendo productos, usuarios, pedidos, categorías y más.

## 🚀 Endpoints Disponibles

### **Endpoint Principal**
```
http://localhost:3001/graphql
```

### **Endpoints de Información**
- **Health Check**: `http://localhost:3001/health`
- **GraphQL Playground**: `http://localhost:3001/graphql` (solo en desarrollo)

## 🔧 Herramientas de Exploración

### 1. **GraphQL Playground (Recomendado)**

El proyecto incluye **Apollo Server** con **GraphQL Playground** habilitado en desarrollo.

#### **Acceso al Playground:**
```bash
# Iniciar el servidor
npm run dev

# Abrir en el navegador
http://localhost:3001/graphql
```

#### **Características del Playground:**
- ✅ **Schema Explorer**: Exploración visual del esquema
- ✅ **Query Builder**: Constructor de consultas interactivo
- ✅ **Documentation**: Documentación automática
- ✅ **Query History**: Historial de consultas
- ✅ **Variables**: Soporte para variables
- ✅ **Headers**: Configuración de headers de autenticación

### 2. **Scripts de Prueba Integrados**

El proyecto incluye scripts para probar la API:

```bash
# Prueba básica de GraphQL
npm run test:graphql

# Prueba completa de GraphQL
npm run test:graphql:complete

# Abrir Playground automáticamente
npm run graphql:playground
```

### 3. **Generación de Tipos TypeScript**

```bash
# Generar tipos TypeScript del esquema
npm run graphql:codegen
```

## 📊 Esquema GraphQL Disponible

### **Tipos Principales**

#### **🔍 Queries Disponibles**

##### **Health & System**
```graphql
query {
  health
}
```

##### **Usuarios**
```graphql
query {
  users {
    users {
      id
      userId
      firstName
      lastName
      email
      role
      isActive
      createdAt
    }
    total
    hasMore
  }
  
  userProfile(userId: "user-id") {
    id
    firstName
    lastName
    phone
    addresses {
      id
      title
      fullAddress
    }
  }
}
```

##### **Categorías**
```graphql
query {
  categories {
    id
    name
    description
    slug
    imageUrl
    isActive
    sortOrder
    products {
      id
      name
      price
    }
  }
  
  category(id: "category-id") {
    id
    name
    products {
      id
      name
      price
      stockQuantity
    }
  }
}
```

##### **Productos**
```graphql
query {
  products {
    products {
      id
      name
      description
      price
      salePrice
      sku
      images
      stockQuantity
      isActive
      category {
        id
        name
      }
      variants {
        id
        size
        color
        price
        stockQuantity
      }
    }
    total
    hasMore
  }
  
  product(id: "product-id") {
    id
    name
    price
    currentPrice
    hasDiscount
    discountPercentage
    isInStock
    variants {
      id
      size
      color
      price
      isInStock
    }
  }
  
  productsByCategory(categoryId: "category-id") {
    products {
      id
      name
      price
    }
    total
    hasMore
  }
}
```

##### **Pedidos**
```graphql
query {
  orders {
    orders {
      id
      orderNumber
      status
      totalAmount
      createdAt
      user {
        id
        firstName
        lastName
      }
      orderItems {
        id
        quantity
        unitPrice
        totalPrice
        product {
          id
          name
        }
      }
    }
    total
    hasMore
  }
  
  order(id: "order-id") {
    id
    orderNumber
    status
    subtotal
    taxAmount
    shippingCost
    totalAmount
    shippingAddress
    orderItems {
      id
      quantity
      unitPrice
      totalPrice
      product {
        id
        name
        images
      }
    }
  }
}
```

##### **Estadísticas**
```graphql
query {
  productStats
  orderStats
  userStats
}
```

#### **✏️ Mutations Disponibles**

##### **Gestión de Usuarios**
```graphql
mutation {
  createUserProfile(input: {
    userId: "new-user-id"
    firstName: "John"
    lastName: "Doe"
    phone: "+1234567890"
  }) {
    id
    userId
    firstName
    lastName
  }
}

mutation {
  updateUserProfile(userId: "user-id", input: {
    firstName: "Jane"
    lastName: "Smith"
  }) {
    id
    firstName
    lastName
  }
}
```

##### **Gestión de Categorías**
```graphql
mutation {
  createCategory(input: {
    name: "Nueva Categoría"
    description: "Descripción de la categoría"
    slug: "nueva-categoria"
    isActive: true
    sortOrder: 1
  }) {
    id
    name
    slug
  }
}

mutation {
  updateCategory(id: "category-id", input: {
    name: "Categoría Actualizada"
    isActive: false
  }) {
    id
    name
    isActive
  }
}
```

##### **Gestión de Productos**
```graphql
mutation {
  createProduct(input: {
    categoryId: "category-id"
    name: "Nuevo Producto"
    description: "Descripción del producto"
    price: "99.99"
    sku: "PROD-001"
    images: ["image1.jpg", "image2.jpg"]
    isActive: true
    stockQuantity: 100
    tags: ["nuevo", "destacado"]
  }) {
    id
    name
    price
    sku
    currentPrice
    hasDiscount
    isInStock
  }
}

mutation {
  updateProduct(id: "product-id", input: {
    price: "89.99"
    stockQuantity: 50
    isActive: false
  }) {
    id
    name
    price
    stockQuantity
    isActive
  }
}
```

##### **Gestión de Pedidos**
```graphql
mutation {
  createOrder(input: {
    userId: "user-id"
    orderNumber: "ORD-2024-001"
    subtotal: "199.98"
    taxAmount: "19.99"
    shippingCost: "9.99"
    totalAmount: "229.96"
    shippingAddress: {
      firstName: "John"
      lastName: "Doe"
      addressLine1: "123 Main St"
      city: "New York"
      state: "NY"
      postalCode: "10001"
      country: "USA"
    }
  }) {
    id
    orderNumber
    status
    totalAmount
  }
}

mutation {
  updateOrderStatus(id: "order-id", status: SHIPPED) {
    id
    status
    shippedAt
  }
}
```

##### **Carrito de Compras**
```graphql
mutation {
  addToCart(input: {
    userId: "user-id"
    productId: "product-id"
    quantity: 2
  }) {
    id
    quantity
    product {
      id
      name
      price
    }
  }
}

mutation {
  updateCartItem(id: "cart-item-id", input: {
    quantity: 3
  }) {
    id
    quantity
  }
}
```

##### **Favoritos**
```graphql
mutation {
  addToFavorites(input: {
    userId: "user-id"
    productId: "product-id"
  }) {
    id
    product {
      id
      name
    }
  }
}
```

##### **Subida de Imágenes**
```graphql
mutation {
  uploadImage(
    file: "file-upload"
    entityType: "product"
    entityId: "product-id"
  ) {
    success
    url
    filename
    message
  }
}
```

## 🔍 Filtros y Paginación

### **Filtros de Productos**
```graphql
query {
  products(
    filter: {
      categoryId: "category-id"
      isActive: true
      minPrice: "10.00"
      maxPrice: "100.00"
      inStock: true
      search: "bebé"
      tags: ["nuevo", "destacado"]
    }
    pagination: {
      limit: 20
      offset: 0
    }
  ) {
    products {
      id
      name
      price
    }
    total
    hasMore
  }
}
```

### **Filtros de Pedidos**
```graphql
query {
  orders(
    filter: {
      userId: "user-id"
      status: PAID
      startDate: "2024-01-01T00:00:00Z"
      endDate: "2024-12-31T23:59:59Z"
    }
    pagination: {
      limit: 10
      offset: 0
    }
  ) {
    orders {
      id
      orderNumber
      status
      totalAmount
    }
    total
    hasMore
  }
}
```

## 🛠️ Herramientas de Desarrollo

### **1. Insomnia / Postman**

Puedes usar Insomnia o Postman para probar la API:

```bash
# URL
POST http://localhost:3001/graphql

# Headers
Content-Type: application/json

# Body (JSON)
{
  "query": "{ health }"
}
```

### **2. curl**

```bash
# Health check
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ health }"}'

# Query de productos
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ products { products { id name price } total } }"}'
```

### **3. GraphQL Code Generator**

```bash
# Generar tipos TypeScript
npm run graphql:codegen

# Los tipos se generan en: src/generated/graphql.ts
```

## 📋 Ejemplos de Consultas Completas

### **Ejemplo 1: Obtener Productos con Filtros**
```graphql
query GetProducts($filter: ProductFilterInput, $pagination: PaginationInput) {
  products(filter: $filter, pagination: $pagination) {
    products {
      id
      name
      description
      price
      salePrice
      currentPrice
      hasDiscount
      discountPercentage
      sku
      images
      stockQuantity
      isInStock
      rating
      reviewCount
      category {
        id
        name
        slug
      }
      variants {
        id
        size
        color
        price
        stockQuantity
        isInStock
      }
      tags
      createdAt
    }
    total
    hasMore
  }
}

# Variables:
{
  "filter": {
    "categoryId": "category-id",
    "isActive": true,
    "minPrice": "10.00",
    "maxPrice": "200.00",
    "inStock": true,
    "search": "ropa bebé"
  },
  "pagination": {
    "limit": 20,
    "offset": 0
  }
}
```

### **Ejemplo 2: Crear Producto Completo**
```graphql
mutation CreateProduct($input: CreateProductInput!) {
  createProduct(input: $input) {
    id
    name
    description
    price
    salePrice
    currentPrice
    hasDiscount
    discountPercentage
    sku
    images
    stockQuantity
    isInStock
    category {
      id
      name
    }
    tags
    createdAt
  }
}

# Variables:
{
  "input": {
    "categoryId": "category-id",
    "name": "Conjunto de Ropa para Bebé",
    "description": "Conjunto cómodo y suave para bebés de 0-6 meses",
    "price": "29.99",
    "salePrice": "24.99",
    "sku": "BABY-001",
    "images": ["image1.jpg", "image2.jpg"],
    "attributes": {
      "material": "Algodón 100%",
      "edad": "0-6 meses",
      "temporada": "Verano"
    },
    "isActive": true,
    "stockQuantity": 50,
    "tags": ["ropa", "bebé", "algodón", "verano"]
  }
}
```

### **Ejemplo 3: Dashboard de Estadísticas**
```graphql
query DashboardStats {
  productStats
  orderStats
  userStats
  categories {
    id
    name
    products {
      id
      name
      stockQuantity
    }
  }
  orders(
    filter: { status: PAID }
    pagination: { limit: 5, offset: 0 }
  ) {
    orders {
      id
      orderNumber
      totalAmount
      status
      createdAt
      user {
        firstName
        lastName
      }
    }
    total
  }
}
```

## 🔐 Autenticación

La API incluye middleware de autenticación. Para requests autenticados:

```bash
# Headers adicionales
Authorization: Bearer your-jwt-token
```

## 📊 Monitoreo y Logs

El sistema incluye logging completo de todas las operaciones GraphQL:

- **Request/Response logging**
- **Performance monitoring**
- **Error tracking**
- **Query analysis**

Los logs se pueden encontrar en:
```
backend/logs/
├── application-YYYY-MM-DD.log
└── error-YYYY-MM-DD.log
```

## 🚀 Comandos Útiles

```bash
# Iniciar servidor de desarrollo
npm run dev

# Probar API GraphQL
npm run test:graphql:complete

# Generar tipos TypeScript
npm run graphql:codegen

# Abrir Playground
npm run graphql:playground

# Verificar salud de la API
curl http://localhost:3001/health
```

## 📚 Recursos Adicionales

- **Documentación del Esquema**: Disponible en GraphQL Playground
- **Logs del Sistema**: `backend/logs/`
- **Tipos TypeScript**: `src/generated/graphql.ts`
- **Scripts de Prueba**: `scripts/test-graphql-*.js`

## 🎯 Próximos Pasos

1. **Explorar el GraphQL Playground** en `http://localhost:3001/graphql`
2. **Probar las queries básicas** usando los ejemplos proporcionados
3. **Experimentar con filtros y paginación**
4. **Crear mutations** para gestionar datos
5. **Integrar con el frontend** usando los tipos generados 