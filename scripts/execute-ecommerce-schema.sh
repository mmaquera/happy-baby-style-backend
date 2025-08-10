#!/bin/bash

# Script para ejecutar el schema de e-commerce completo
# Happy Baby Style - E-commerce Database Setup

echo "🚀 Iniciando configuración de e-commerce completo..."
echo "📊 Conectando a la base de datos RDS..."

# Configuración de la base de datos
DB_HOST="happy-baby-style-db.cr0ug6u2oje3.us-east-2.rds.amazonaws.com"
DB_PORT="5432"
DB_NAME="happy_baby_style_db"
DB_USER="postgres"
DB_PASSWORD="HappyBaby2024!"

# Verificar conexión
echo "🔍 Verificando conexión a la base de datos..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 'Conexión exitosa' as status;" || {
    echo "❌ Error: No se pudo conectar a la base de datos"
    exit 1
}

echo "✅ Conexión exitosa a la base de datos"

# Ejecutar el script SQL
echo "📝 Ejecutando schema de e-commerce..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f scripts/create-ecommerce-tables.sql

if [ $? -eq 0 ]; then
    echo "✅ Schema de e-commerce ejecutado exitosamente!"
    echo ""
    echo "📊 RESUMEN DE CAMBIOS:"
    echo "   • 25+ tablas nuevas creadas"
    echo "   • Sistema de pagos móvil"
    echo "   • Notificaciones push"
    echo "   • Cupones y descuentos"
    echo "   • Reseñas y valoraciones"
    echo "   • Tracking de pedidos"
    echo "   • Inventario en tiempo real"
    echo "   • Analytics móviles"
    echo "   • Fidelización y recompensas"
    echo "   • Configuración de tienda"
    echo "   • Seguridad y auditoría"
    echo "   • Marketing y comunicación"
    echo ""
    echo "🎯 Tu base de datos está lista para un e-commerce completo!"
    echo "📱 Optimizada para app Android"
else
    echo "❌ Error ejecutando el schema"
    exit 1
fi

