#!/usr/bin/env node

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function testPrismaConnection() {
  console.log('🧪 Probando conexión de Prisma a la base de datos...\n');
  
  const prisma = new PrismaClient();
  
  try {
    // Probar conexión
    await prisma.$connect();
    console.log('✅ Conexión a la base de datos exitosa!');
    
    // Contar registros en las tablas principales
    console.log('\n📊 Datos en la base de datos:');
    
    const [categories, products, users, variants] = await Promise.all([
      prisma.categories.count(),
      prisma.products.count(),
      prisma.user_profiles.count(),
      prisma.product_variants.count()
    ]);
    
    console.log(`   - Categorías: ${categories}`);
    console.log(`   - Productos: ${products}`);
    console.log(`   - Usuarios: ${users}`);
    console.log(`   - Variantes de productos: ${variants}`);
    
    // Mostrar algunas categorías de ejemplo
    console.log('\n📋 Categorías disponibles:');
    const sampleCategories = await prisma.categories.findMany({
      take: 3,
      select: {
        id: true,
        name: true,
        slug: true,
        is_active: true
      }
    });
    
    sampleCategories.forEach(category => {
      console.log(`   - ${category.name} (${category.slug}) - Activo: ${category.is_active}`);
    });
    
    await prisma.$disconnect();
    console.log('\n🎉 ¡Todas las pruebas exitosas!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('🔍 Detalles:', error);
    await prisma.$disconnect();
  }
}

testPrismaConnection(); 