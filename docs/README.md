# Happy Baby Style - API Documentation

## 📖 Overview

Esta carpeta contiene la documentación completa de la API del backend de **Happy Baby Style**, una plataforma de e-commerce especializada en productos para bebés. El sistema cuenta con APIs tanto **GraphQL** modernas como **REST** para compatibilidad, implementando Clean Architecture con las mejores prácticas de desarrollo. La documentación está completamente desacoplada de la aplicación principal y puede servirse de forma independiente.

## 🚀 Quick Start

### Option 1: Open directly in browser
Simply open `index.html` in your web browser to view the documentation.

### Option 2: Serve with a local server
```bash
# Using Python 3
python -m http.server 8080

# Using Node.js (if you have http-server installed)
npx http-server -p 8080

# Using PHP
php -S localhost:8080
```

Then visit `http://localhost:8080` in your browser.

## 🎯 Características del Sistema

### 🍼 Dominio de Negocio - Happy Baby Style
- **E-commerce Especializado** - Plataforma dedicada a productos para bebés y niños
- **Gestión de Catálogo** - Sistema completo de productos con variantes, tallas y colores
- **Sistema de Pedidos** - Ciclo completo desde carrito hasta entrega
- **Perfiles de Usuario** - Gestión completa de clientes con direcciones y preferencias
- **Análisis de Ventas** - Estadísticas y métricas para administradores

### 🔥 API GraphQL Moderna
- **Esquema Completo** - Definiciones de tipos y resolvers para todas las entidades
- **Apollo Server** - Implementación moderna con servidor GraphQL optimizado
- **Playground Interactivo** - Disponible en endpoint `/graphql` para testing
- **Type-Safety** - Soporte completo de TypeScript con Prisma ORM
- **Consultas Flexibles** - Solicita exactamente los datos que necesitas
- **DataLoaders** - Optimización N+1 queries con batch loading automático

### 📋 API REST (Compatibilidad)
- **Products API** - CRUD completo para gestión de productos y variantes
- **Orders API** - Creación, seguimiento y gestión de estados de pedidos
- **Users API** - Gestión de usuarios con control de acceso basado en roles
- **Images API** - Upload y gestión de archivos multimedia

### 🏗️ Arquitectura Limpia Implementada
- **Clean Architecture** - Separación clara de capas: Domain, Application, Infrastructure, Presentation
- **Use Cases** - Lógica de negocio encapsulada en casos de uso específicos
- **Repository Pattern** - Abstracción de acceso a datos con interfaces
- **Dependency Injection** - Container IoC para gestión de dependencias
- **Error Handling** - Sistema jerárquico de errores de dominio

### 🔐 Seguridad y Autenticación
- **JWT Authentication** - Autenticación con tokens Bearer seguros
- **Role-Based Access** - Sistema de roles (Admin, Staff, Customer) con permisos granulares
- **GraphQL Context** - Autenticación integrada en resolvers
- **Password Hashing** - Bcrypt con salt rounds configurables
- **Input Validation** - Validación centralizada con esquemas predefinidos

### 🧪 Testing y Calidad
- **Tests Unitarios** - Cobertura completa de use cases con Jest
- **Tests de Integración** - Verificación de APIs y base de datos
- **GraphQL Playground** - Constructor interactivo de queries GraphQL
- **API Testing** - Pruebas en tiempo real desde la documentación
- **Error Handling** - Mensajes claros y códigos de estado HTTP apropriados

### 🎨 Documentación Moderna
- **Diseño Responsivo** - Funciona en desktop y dispositivos móviles
- **Syntax Highlighting** - Ejemplos de código con resaltado sintáctico
- **Navegación Fluida** - Navegación fácil entre secciones
- **Interfaz Profesional** - Diseño limpio y moderno con Tailwind CSS

## 📁 Estructura del Proyecto

```
backend/
├── src/
│   ├── application/             # 📋 Capa de Aplicación
│   │   ├── use-cases/          # Casos de uso por dominio
│   │   │   ├── product/        # Gestión de productos
│   │   │   ├── order/          # Gestión de pedidos  
│   │   │   ├── user/           # Gestión de usuarios
│   │   │   └── image/          # Gestión de imágenes
│   │   ├── auth/               # Servicios de autenticación
│   │   └── validation/         # Validación centralizada
│   ├── domain/                 # 🎯 Capa de Dominio
│   │   ├── entities/           # Entidades de negocio
│   │   ├── repositories/       # Interfaces de repositorios
│   │   └── errors/             # Errores de dominio
│   ├── infrastructure/         # 🔧 Capa de Infraestructura
│   │   ├── repositories/       # Implementaciones de repositorios
│   │   ├── database/           # Configuración de Prisma
│   │   ├── loaders/            # DataLoaders para GraphQL
│   │   └── config/             # Configuraciones externas
│   ├── presentation/           # 📡 Capa de Presentación
│   │   ├── controllers/        # Controladores REST
│   │   ├── middleware/         # Middleware de autenticación
│   │   └── routes/             # Definición de rutas
│   ├── graphql/                # 🎮 GraphQL Layer
│   │   ├── schema.ts           # Esquema GraphQL
│   │   ├── resolvers.ts        # Resolvers con Clean Architecture
│   │   └── server.ts           # Configuración Apollo Server
│   └── shared/                 # 🛠️ Utilidades Compartidas
│       └── container.ts        # Container de dependencias
├── docs/                       # 📖 Documentación
│   ├── index.html              # Documentación principal HTML
│   ├── README.md               # Este archivo
│   ├── QUICK_START.md          # Guía de inicio rápido
│   └── API_REFERENCE.md        # Referencia completa de API
├── prisma/
│   └── schema.prisma           # Esquema de base de datos
└── tests/                      # 🧪 Tests
    ├── unit/                   # Tests unitarios
    └── integration/            # Tests de integración
```

## 🔧 Configuration

### Base URL
The default base URL is set to `http://localhost:3001`. You can change this in the Authentication settings modal.

### Authentication
1. Click the "Authentication" button in the header
2. Enter your JWT token and/or API key
3. Set your base URL
4. Click "Save" to persist the settings

### Testing Endpoints
1. Click the "Test API" button to open the testing panel
2. Enter the endpoint path (e.g., `/api/products`)
3. Select the HTTP method
4. Add request body if needed (JSON format)
5. Click "Send Request" to test the endpoint

## 📚 Funcionalidades del Sistema

### 🛒 Gestión de E-commerce
- **Catálogo de Productos** - Sistema completo con variantes, tallas, colores y atributos personalizados
- **Categorías** - Organización jerárquica con slugs, imágenes y orden personalizable
- **Inventario** - Control de stock por producto y variante con alertas de disponibilidad
- **Precios y Descuentos** - Gestión de precios regulares, ofertas y cálculo automático de descuentos

### 🛍️ Gestión de Pedidos
- **Ciclo Completo** - Desde carrito de compras hasta entrega con tracking
- **Estados de Pedido** - Pending, Paid, Processing, Shipped, Delivered, Cancelled, Refunded
- **Direcciones** - Gestión de direcciones de envío y facturación por usuario
- **Cálculos** - Subtotal, impuestos, costos de envío y descuentos automáticos

### 👥 Gestión de Usuarios
- **Perfiles Completos** - Información personal, teléfono, fecha de nacimiento, avatar
- **Múltiples Direcciones** - Gestión de direcciones con dirección por defecto
- **Favoritos** - Sistema de productos favoritos por usuario
- **Carritos Persistentes** - Carritos de compra que persisten entre sesiones
- **Métodos de Pago** - Gestión de tarjetas y métodos de pago preferidos

### 🎮 API GraphQL Moderna (`/graphql`)
- **Queries Avanzadas** - Consultas optimizadas con DataLoaders
- **Mutations Completas** - Operaciones CRUD para todas las entidades
- **Filtering y Pagination** - Filtros avanzados y paginación eficiente
- **Introspección** - Exploración completa del esquema

#### Entidades Principales:
- **Products & Variants** - Gestión completa de productos con variantes
- **Categories** - Categorías con relaciones y organización
- **Orders & OrderItems** - Gestión completa del ciclo de pedidos
- **Users & UserProfiles** - Perfiles de usuario con información extendida
- **Shopping Cart** - Carritos de compra con persistencia
- **Analytics** - Estadísticas en tiempo real para administradores

### 📡 API REST de Compatibilidad (`/api/*`)
- **Products API** - CRUD completo para gestión de productos
- **Orders API** - Creación, consulta y actualización de pedidos
- **Users API** - Gestión de usuarios con control de acceso
- **Images API** - Upload y gestión de archivos multimedia

## 🗄️ Integración de Base de Datos

### Prisma ORM
- **Operaciones Type-Safe** - Soporte completo de TypeScript con tipado estricto
- **Migraciones Automáticas** - Gestión y versionado de esquemas de base de datos
- **Manejo de Relaciones** - Joins eficientes y consultas optimizadas
- **Connection Pooling** - Conexiones optimizadas con pooling automático
- **Schema Introspection** - Generación automática de tipos desde la base de datos

### Supabase Integration
- **PostgreSQL Robusto** - Base de datos escalable con características empresariales
- **Row Level Security** - Control de acceso granular a nivel de fila
- **Backup Automático** - Protección de datos con respaldo automatizado
- **Multi-Schema Support** - Soporte para esquemas `auth` y `public`
- **Real-time Capabilities** - Capacidades en tiempo real para futuras funcionalidades

## 🛠️ Herramientas de Desarrollo

### Desarrollo GraphQL
- **Apollo Server** - Servidor GraphQL moderno con optimizaciones avanzadas
- **GraphQL Playground** - Testing interactivo de queries y mutations
- **Code Generation** - Generación automática de tipos TypeScript desde schema
- **DataLoaders** - Optimización automática de consultas N+1
- **Schema Validation** - Validación en tiempo real del esquema GraphQL

### Gestión de Base de Datos
- **Prisma Studio** - Navegador visual de base de datos con interfaz web
- **Migration Management** - Control de versiones de esquemas con migraciones
- **Query Optimization** - Monitoreo y optimización de performance
- **Seed Scripts** - Scripts para poblar datos de desarrollo

### Testing y Calidad
- **Jest Framework** - Tests unitarios y de integración con TypeScript
- **Test Coverage** - Reportes de cobertura de código automatizados
- **API Testing** - Tests automáticos de endpoints REST y GraphQL
- **Mock Repositories** - Mocks tipados para testing aislado

## 🔒 Notas de Seguridad

### Implementaciones de Seguridad
- **JWT Authentication** - Tokens seguros con expiración configurable
- **Password Hashing** - Bcrypt con salt rounds para protección de contraseñas
- **Role-Based Access** - Sistema de roles (Admin, Staff, Customer) con permisos granulares
- **Input Validation** - Validación centralizada para prevenir inyecciones
- **Error Sanitization** - Sanitización de errores para no exponer información sensible

### Consideraciones de la Documentación
- Los tokens de autenticación se almacenan en localStorage (lado cliente)
- No se envían datos sensibles a servicios externos
- La documentación es estática y no requiere procesamiento del servidor
- Las pruebas de API se realizan directamente desde el navegador
- Las queries GraphQL son validadas y sanitizadas automáticamente

## 🌐 Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 📝 License

This documentation is part of the Happy Baby Style project and follows the same license terms.

## 🤝 Contributing

To contribute to the API documentation:

1. Follow the existing code style and structure
2. Test all examples and ensure they work correctly
3. Update the README if adding new features
4. Ensure responsive design works on mobile devices
5. Keep GraphQL and REST documentation in sync

## 🚀 Ruta de Migración y Adopción

### Para Nuevos Proyectos
- **Comenzar con GraphQL** - Utilizar la API GraphQL moderna como principal
- **Aprovechar Prisma** - Disfrutar de operaciones type-safe en base de datos
- **Apollo Client** - Cliente GraphQL moderno para desarrollo frontend
- **Clean Architecture** - Implementar desde el inicio con separación clara de capas

### Para Proyectos Existentes
- **Migración Gradual** - APIs REST y GraphQL coexisten sin conflictos
- **Feature-by-Feature** - Migrar una funcionalidad a la vez
- **Compatibilidad Hacia Atrás** - API REST mantenida durante la transición
- **Testing Paralelo** - Validar funcionalidades en ambas APIs durante migración

### Recomendaciones de Implementación
- **Priorizar GraphQL** - Para nuevas funcionalidades usar GraphQL
- **Mantener REST** - Para integraciones legacy y compatibilidad
- **Optimizar Gradualmente** - Implementar DataLoaders y optimizaciones progresivamente

## 📖 Recursos Adicionales

- **[Guía de Inicio Rápido](QUICK_START.md)** - Configuración y primeros pasos
- **[Referencia de API](API_REFERENCE.md)** - Documentación completa de endpoints
- **[Análisis de Arquitectura](../CLEAN_ARCHITECTURE_IMPLEMENTATION.md)** - Detalles de implementación Clean Architecture
- **[GraphQL Playground](http://localhost:3001/graphql)** - Explorador interactivo de API

### Comandos Útiles de Desarrollo
```bash
# Servidor de desarrollo
npm run dev

# Documentación local
npm run docs

# Tests completos
npm test

# Prisma Studio
npm run prisma:studio

# Generación de tipos
npm run graphql:codegen
```

### Enlaces de Interés
- **Health Check**: `http://localhost:3001/health`
- **GraphQL Endpoint**: `http://localhost:3001/graphql`
- **REST API Base**: `http://localhost:3001/api`

---

**Happy Baby Style API Documentation** - Construido con ❤️ para desarrolladores

*🍼 Plataforma E-commerce especializada en productos para bebés*  
*🚀 Featuring GraphQL, Clean Architecture, Apollo Server & Prisma ORM!* 