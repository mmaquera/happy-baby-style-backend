const { Client } = require('pg');

const config = {
  host: 'happy-baby-style-db.cr0ug6u2oje3.us-east-2.rds.amazonaws.com',
  port: 5432,
  database: 'happy_baby_style_db',
  user: 'postgres',
  password: 'HappyBaby2024!',
  ssl: { rejectUnauthorized: false }
};

async function analyzeNewTables() {
  const client = new Client(config);
  
  try {
    await client.connect();
    
    console.log('🔍 ANALIZANDO NUEVAS TABLAS EN LA BASE DE DATOS...');
    
    // Obtener todas las tablas
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('\n📊 TABLAS EXISTENTES:');
    tablesResult.rows.forEach(row => {
      console.log(`   • ${row.table_name}`);
    });
    
    // Identificar tablas que no están en el schema de Prisma actual
    const existingPrismaTables = [
      'user_profiles', 'user_accounts', 'user_sessions', 'user_passwords', 
      'user_addresses', 'categories', 'products', 'product_variants', 
      'shopping_carts', 'shopping_cart_items', 'user_favorites', 
      'orders', 'order_items', 'payment_methods', 'images'
    ];
    
    const newTables = tablesResult.rows
      .map(row => row.table_name)
      .filter(table => !existingPrismaTables.includes(table));
    
    console.log('\n🆕 NUEVAS TABLAS DETECTADAS:');
    newTables.forEach(table => {
      console.log(`   • ${table}`);
    });
    
    // Analizar estructura de algunas tablas nuevas importantes
    if (newTables.length > 0) {
      console.log('\n📋 ANÁLISIS DE ESTRUCTURA DE TABLAS NUEVAS:');
      
      for (const table of newTables.slice(0, 5)) { // Analizar primeras 5
        const columnsResult = await client.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = '${table}'
          ORDER BY ordinal_position
        `);
        
        console.log(`\n   📊 ${table}:`);
        columnsResult.rows.forEach(col => {
          console.log(`      • ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error en análisis:', error.message);
  } finally {
    await client.end();
  }
}

analyzeNewTables();

