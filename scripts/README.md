# 📁 Scripts del Proyecto

Este directorio contiene los scripts esenciales para el desarrollo y mantenimiento del proyecto.

## 🚀 Scripts Disponibles

### `dev-server.js`
**Propósito**: Servidor de desarrollo con gestión automática de puertos
**Uso**: `npm run dev`
**Funcionalidades**:
- Limpia procesos existentes en el puerto 3001
- Inicia el servidor con ts-node-dev
- Maneja señales de terminación (Ctrl+C)
- Reinicio automático en cambios de archivos

### `test-prisma-connection.js`
**Propósito**: Prueba la conexión a la base de datos con Prisma
**Uso**: `npm run test:db`
**Funcionalidades**:
- Verifica conexión a Supabase
- Cuenta registros en tablas principales
- Muestra categorías de ejemplo
- Valida que Prisma funcione correctamente

### `test-graphql.js`
**Propósito**: Prueba las consultas GraphQL principales
**Uso**: `npm run test:graphql`
**Funcionalidades**:
- Prueba health check
- Prueba consulta de categorías
- Prueba consulta de productos
- Prueba estadísticas de productos

## 📋 Comandos NPM Disponibles

```bash
# Desarrollo
npm run dev                    # Inicia servidor de desarrollo
npm run test:db               # Prueba conexión a base de datos
npm run test:graphql          # Prueba consultas GraphQL

# Prisma
npm run prisma:generate       # Genera cliente de Prisma
npm run prisma:studio         # Abre Prisma Studio
npm run prisma:migrate        # Ejecuta migraciones

# GraphQL
npm run graphql:codegen       # Genera tipos TypeScript

# Testing
npm run test                  # Ejecuta tests
npm run test:watch           # Tests en modo watch
npm run test:coverage        # Tests con cobertura
```

## 🔧 Configuración

Los scripts utilizan las siguientes configuraciones:
- **Puerto del servidor**: 3001
- **URL GraphQL**: http://localhost:3001/graphql
- **Base de datos**: Supabase (configurada en .env)

## 📝 Notas

- Todos los scripts están optimizados para el entorno de desarrollo actual
- Los scripts de prueba de conexión están configurados para Supabase
- El servidor de desarrollo incluye hot-reload automático 