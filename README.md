# Happy Baby Style Backend

Backend API GraphQL para el panel de administración de Happy Baby Style, implementado con Clean Architecture, TypeScript, Prisma, y Apollo Server.

## 🚀 Características

- **GraphQL API** con Apollo Server 4
- **Clean Architecture** siguiendo principios SOLID
- **TypeScript** con configuración estricta
- **Prisma ORM** con PostgreSQL
- **Sistema de autenticación** con JWT y Google OAuth
- **Sistema de logging** avanzado con Winston
- **Validación** robusta de datos
- **Tests unitarios** con Jest
- **Docker** ready para despliegue

## 🏗️ Arquitectura

```
src/
├── application/          # Casos de uso y servicios de aplicación
├── domain/              # Entidades, interfaces y reglas de negocio
├── infrastructure/      # Implementaciones concretas (DB, logging, etc.)
├── presentation/        # Controladores y middleware
├── graphql/            # Schema, resolvers y configuración GraphQL
└── shared/             # Utilidades y tipos compartidos
```

## 📋 Prerrequisitos

- Node.js 18+ 
- PostgreSQL 13+
- npm o yarn
- PM2 (para producción)

## 🛠️ Instalación

### Desarrollo

```bash
# Clonar el repositorio
git clone <repository-url>
cd happy-baby-style-backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# Generar cliente Prisma
npm run prisma:generate

# Ejecutar migraciones
npm run prisma:migrate

# Iniciar servidor de desarrollo
npm run dev
```

### Producción

```bash
# Construir el proyecto
npm run build:production

# Iniciar servidor de producción
npm run start:production
```

## 🔧 Scripts Disponibles

### Desarrollo
- `npm run dev` - Servidor de desarrollo
- `npm run dev:development` - Desarrollo con NODE_ENV=development
- `npm run dev:production` - Desarrollo con NODE_ENV=production

### Construcción
- `npm run build` - Construir proyecto
- `npm run build:development` - Construir para desarrollo
- `npm run build:production` - Construir para producción

### Producción
- `npm run start` - Iniciar servidor
- `npm run start:development` - Iniciar con NODE_ENV=development
- `npm run start:production` - Iniciar con NODE_ENV=production

### Base de Datos
- `npm run prisma:generate` - Generar cliente Prisma
- `npm run prisma:migrate` - Ejecutar migraciones
- `npm run prisma:studio` - Abrir Prisma Studio
- `npm run prisma:db:push` - Push directo a la base de datos

### Testing
- `npm run test` - Ejecutar tests
- `npm run test:watch` - Tests en modo watch
- `npm run test:coverage` - Tests con cobertura
- `npm run test:unit` - Solo tests unitarios

### Utilidades
- `npm run type-check` - Verificar tipos TypeScript
- `npm run graphql:codegen` - Generar código GraphQL
- `npm run docs` - Servir documentación

## 🌍 Variables de Entorno

```bash
# Base de datos
DATABASE_URL="postgresql://user:password@localhost:5432/happy_baby_style"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="24h"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Servidor
PORT=3001
NODE_ENV=production

# Logging
LOG_LEVEL=info
LOG_DIRECTORY=./logs
```

## 🚀 Despliegue en Producción

### Requisitos del Servidor

- **Amazon EC2** con Ubuntu 20.04+ o Amazon Linux 2
- **Nginx** como proxy reverso (archivo de configuración: `/etc/nginx/conf.d/app.conf`)
- **PM2** para gestión de procesos Node.js en background
- **PostgreSQL** configurado y accesible

### Información del Servidor

- **Hosting**: Servidor EC2 de Amazon
- **Proxy Reverso**: Nginx
- **Gestor de Procesos**: PM2
- **Dominio**: service.happybabystyle.com

### Pasos de Despliegue

#### 1. Preparar el Proyecto Localmente

```bash
# Construir para producción
npm run build:production

# Verificar que se generó la carpeta dist/
ls -la dist/
```

#### 2. Archivos a Copiar al Servidor

Copiar los siguientes archivos y carpetas al servidor:

```bash
# Estructura de archivos para el servidor
happy-baby-style/
├── dist/                    # Código compilado
├── package.json            # Dependencias del proyecto
├── package-lock.json       # Versiones exactas de dependencias
├── logs/                   # Directorio de logs
├── prisma/                 # Esquemas y migraciones de base de datos
├── uploads/                # Archivos subidos por usuarios
├── tsconfig.json           # Configuración TypeScript principal
├── tsconfig.production.json # Configuración TypeScript para producción
└── .env.production         # Variables de entorno de producción
```

#### 3. Configurar el Servidor EC2

```bash
# Conectarse al servidor
ssh -i your-key.pem ubuntu@your-ec2-ip

# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2 globalmente
sudo npm install -g pm2

# Instalar Nginx
sudo apt install nginx -y
```

#### 4. Desplegar la Aplicación

```bash
# Crear directorio de la aplicación
sudo mkdir -p /opt/happy-baby-style
sudo chown $USER:$USER /opt/happy-baby-style

# Copiar archivos (desde tu máquina local)
scp -i your-key.pem -r dist/ ubuntu@your-ec2-ip:/opt/happy-baby-style/
scp -i your-key.pem package*.json ubuntu@your-ec2-ip:/opt/happy-baby-style/
scp -i your-key.pem -r logs/ ubuntu@your-ec2-ip:/opt/happy-baby-style/
scp -i your-key.pem -r prisma/ ubuntu@your-ec2-ip:/opt/happy-baby-style/
scp -i your-key.pem -r uploads/ ubuntu@your-ec2-ip:/opt/happy-baby-style/
scp -i your-key.pem tsconfig*.json ubuntu@your-ec2-ip:/opt/happy-baby-style/
scp -i your-key.pem .env.production ubuntu@your-ec2-ip:/opt/happy-baby-style/

# En el servidor, navegar al directorio
cd /opt/happy-baby-style

# Instalar dependencias de producción
npm ci --only=production

# Verificar la configuración
ls -la
```

#### 5. Configurar PM2

```bash
# Iniciar la aplicación con PM2
pm2 start "npm run start:production" --name "happy-baby-style"

# Guardar configuración PM2
pm2 save
```

#### 6. Configurar Nginx

```bash
# Crear configuración del sitio en /etc/nginx/conf.d/app.conf
sudo tee /etc/nginx/conf.d/app.conf << 'EOF'
server {
    listen 80;
    server_name service.happybabystyle.com;

    # Redirigir HTTP a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name service.happybabystyle.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/service.happybabystyle.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/service.happybabystyle.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Logs
    access_log /var/log/nginx/happy-baby-style.access.log;
    error_log /var/log/nginx/happy-baby-style.error.log;

    # GraphQL API
    location /graphql {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Health Check
    location /health {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # GraphQL Playground (solo en desarrollo)
    location /playground {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Archivos estáticos (uploads)
    location /uploads/ {
        alias /opt/happy-baby-style/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
}
EOF

# Verificar configuración Nginx
sudo nginx -t

# Recargar Nginx
sudo systemctl reload nginx
```



#### 7. Configurar SSL con Let's Encrypt

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Detener Nginx para obtener certificados
sudo systemctl stop nginx

# Obtener certificados SSL usando standalone
sudo certbot certonly --standalone -d service.happybabystyle.com

# Reiniciar Nginx
sudo systemctl start nginx
```

### Comandos de Gestión PM2

#### Iniciar la Aplicación
```bash
# Iniciar con PM2
pm2 start "npm run start:production" --name "happy-baby-style"
```

#### Detener la Aplicación
```bash
# Detener la aplicación
pm2 stop happy-baby-style

# O detener todas las aplicaciones
pm2 stop all
```

#### Reiniciar la Aplicación
```bash
# Reiniciar la aplicación
pm2 restart happy-baby-style

# Reiniciar todas las aplicaciones
pm2 restart all
```

#### Ver Estado y Logs
```bash
# Ver estado de las aplicaciones
pm2 status

# Ver logs en tiempo real
pm2 logs happy-baby-style

# Ver logs específicos
pm2 logs happy-baby-style --lines 100
```

#### Actualizar la Aplicación
```bash
# Detener la aplicación
pm2 stop happy-baby-style

# Copiar nuevos archivos
# ... (copiar dist/, package.json, etc.)

# Reiniciar la aplicación
pm2 start "npm run start:production" --name "happy-baby-style"
```

### Monitoreo y Mantenimiento

#### Verificar Logs
```bash
# Logs de PM2
pm2 logs happy-baby-style

# Logs de Nginx
sudo tail -f /var/log/nginx/happy-baby-style.access.log
sudo tail -f /var/log/nginx/happy-baby-style.error.log
```

#### Verificar Estado del Servicio
```bash
# Estado de PM2
pm2 status

# Estado de Nginx
sudo systemctl status nginx

# Verificar puertos abiertos
sudo netstat -tlnp | grep :3001
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443
```

### Comandos de Gestión Nginx

```bash
# Ver estado del servicio
sudo systemctl status nginx

# Iniciar Nginx
sudo systemctl start nginx

# Detener Nginx
sudo systemctl stop nginx

# Reiniciar Nginx
sudo systemctl restart nginx

# Recargar configuración (sin detener)
sudo systemctl reload nginx

# Verificar configuración
sudo nginx -t

# Ver logs en tiempo real
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```



## 🧪 Testing

```bash
# Ejecutar todos los tests
npm run test

# Tests con cobertura
npm run test:coverage

# Tests unitarios
npm run test:unit

# Tests en modo watch
npm run test:watch
```

## 📚 Documentación

- **GraphQL API**: Disponible en `/graphql` cuando el servidor esté corriendo
- **GraphQL Playground**: Disponible en `/playground` (solo en desarrollo)
- **Health Check**: Disponible en `/health`

## 🔧 Troubleshooting

### Problemas Comunes

#### Error de Resolución de Módulos
```bash
# Verificar que tsconfig.production.json esté presente
ls -la tsconfig.production.json

# Verificar que la variable TS_NODE_PROJECT esté configurada
echo $TS_NODE_PROJECT
```



#### Error de Permisos
```bash
# Verificar permisos de archivos
ls -la /opt/happy-baby-style/

# Corregir permisos si es necesario
sudo chown -R $USER:$USER /opt/happy-baby-style/
```

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📞 Soporte

Para soporte técnico o preguntas sobre el despliegue, contacta al equipo de desarrollo.

---

**Happy Baby Style Backend** - Desarrollado con ❤️ siguiendo principios de Clean Architecture
