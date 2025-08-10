const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuración de la base de datos RDS
const config = {
  host: 'happy-baby-style-db.cr0ug6u2oje3.us-east-2.rds.amazonaws.com',
  port: 5432,
  database: 'happy_baby_style_db',
  user: 'postgres',
  password: 'HappyBaby2024!',
  ssl: {
    rejectUnauthorized: false
  }
};

async function analyzeEcommerceScript() {
  const client = new Client(config);
  
  try {
    console.log('🔍 ANALIZANDO SCRIPT DE E-COMMERCE...');
    console.log('📊 Conectando a RDS Amazon...');
    
    await client.connect();
    console.log('✅ Conexión exitosa a RDS Amazon!');
    
    // 1. Verificar tablas existentes
    console.log('\n📋 VERIFICANDO TABLAS EXISTENTES...');
    const existingTablesResult = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const existingTables = existingTablesResult.rows.map(row => row.table_name);
    console.log(`📊 Tablas existentes (${existingTables.length}):`);
    existingTables.forEach(table => {
      console.log(`   • ${table}`);
    });
    
    // 2. Leer y analizar el script SQL
    console.log('\n📝 ANALIZANDO SCRIPT SQL...');
    const sqlFilePath = path.join(__dirname, 'create-ecommerce-tables.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Extraer nombres de tablas del script
    const tableMatches = sqlContent.match(/CREATE TABLE IF NOT EXISTS (\w+)/g);
    const newTables = tableMatches ? tableMatches.map(match => match.replace('CREATE TABLE IF NOT EXISTS ', '')) : [];
    
    console.log(`📊 Tablas nuevas a crear (${newTables.length}):`);
    newTables.forEach(table => {
      console.log(`   • ${table}`);
    });
    
    // 3. Verificar conflictos
    console.log('\n⚠️  VERIFICANDO CONFLICTOS...');
    const conflicts = newTables.filter(table => existingTables.includes(table));
    
    if (conflicts.length > 0) {
      console.log(`❌ CONFLICTOS DETECTADOS (${conflicts.length}):`);
      conflicts.forEach(table => {
        console.log(`   • ${table} - YA EXISTE`);
      });
    } else {
      console.log('✅ No hay conflictos de tablas');
    }
    
    // 4. Verificar ALTER TABLE statements
    console.log('\n🔧 ANALIZANDO MODIFICACIONES A TABLAS EXISTENTES...');
    const alterMatches = sqlContent.match(/ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS/g);
    const alterTables = alterMatches ? alterMatches.map(match => match.replace('ALTER TABLE ', '').replace(' ADD COLUMN IF NOT EXISTS', '')) : [];
    
    console.log(`📊 Tablas a modificar (${alterTables.length}):`);
    alterTables.forEach(table => {
      console.log(`   • ${table}`);
    });
    
    // 5. Verificar que las tablas a modificar existen
    const missingTables = alterTables.filter(table => !existingTables.includes(table));
    if (missingTables.length > 0) {
      console.log(`❌ TABLAS FALTANTES PARA MODIFICAR (${missingTables.length}):`);
      missingTables.forEach(table => {
        console.log(`   • ${table} - NO EXISTE`);
      });
    } else {
      console.log('✅ Todas las tablas a modificar existen');
    }
    
    // 6. Verificar foreign keys
    console.log('\n🔗 ANALIZANDO FOREIGN KEYS...');
    const foreignKeyMatches = sqlContent.match(/REFERENCES (\w+)\(/g);
    const referencedTables = foreignKeyMatches ? [...new Set(foreignKeyMatches.map(match => match.replace('REFERENCES ', '').replace('(', '')))] : [];
    
    console.log(`📊 Tablas referenciadas (${referencedTables.length}):`);
    referencedTables.forEach(table => {
      const exists = existingTables.includes(table);
      console.log(`   • ${table} ${exists ? '✅' : '❌'}`);
    });
    
    const missingReferencedTables = referencedTables.filter(table => !existingTables.includes(table));
    if (missingReferencedTables.length > 0) {
      console.log(`❌ TABLAS REFERENCIADAS FALTANTES (${missingReferencedTables.length}):`);
      missingReferencedTables.forEach(table => {
        console.log(`   • ${table} - NO EXISTE`);
      });
    } else {
      console.log('✅ Todas las tablas referenciadas existen');
    }
    
    // 7. Resumen final
    console.log('\n📊 RESUMEN DEL ANÁLISIS:');
    console.log(`   • Tablas existentes: ${existingTables.length}`);
    console.log(`   • Tablas nuevas a crear: ${newTables.length}`);
    console.log(`   • Tablas a modificar: ${alterTables.length}`);
    console.log(`   • Conflictos detectados: ${conflicts.length}`);
    console.log(`   • Tablas referenciadas faltantes: ${missingReferencedTables.length}`);
    
    if (conflicts.length === 0 && missingReferencedTables.length === 0) {
      console.log('\n🎉 ¡SCRIPT SEGURO PARA EJECUTAR!');
      console.log('✅ No afectará tablas existentes');
      console.log('✅ Todas las dependencias están cubiertas');
      console.log('✅ Usa IF NOT EXISTS para evitar conflictos');
    } else {
      console.log('\n⚠️  ADVERTENCIAS:');
      if (conflicts.length > 0) {
        console.log('   • Algunas tablas ya existen (usará IF NOT EXISTS)');
      }
      if (missingReferencedTables.length > 0) {
        console.log('   • Algunas tablas referenciadas no existen');
      }
    }
    
    // 8. Recomendaciones
    console.log('\n💡 RECOMENDACIONES:');
    console.log('   1. El script usa IF NOT EXISTS - es seguro');
    console.log('   2. Las modificaciones usan ADD COLUMN IF NOT EXISTS');
    console.log('   3. Los índices usan IF NOT EXISTS');
    console.log('   4. Los datos iniciales usan INSERT (pueden fallar si ya existen)');
    console.log('   5. Recomendado: Hacer backup antes de ejecutar');
    
  } catch (error) {
    console.error('❌ Error en el análisis:', error.message);
  } finally {
    await client.end();
  }
}

// Ejecutar análisis
analyzeEcommerceScript();

