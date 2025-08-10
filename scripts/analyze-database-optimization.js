const { Client } = require('pg');

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

async function analyzeDatabaseOptimization() {
  const client = new Client(config);
  
  try {
    console.log('🔍 ANALIZANDO BASE DE DATOS PARA OPTIMIZACIÓN...');
    console.log('📊 Conectando a RDS Amazon...');
    
    await client.connect();
    console.log('✅ Conexión exitosa a RDS Amazon!');
    
    // 1. ANÁLISIS DE TABLAS Y ESTRUCTURA
    console.log('\n📋 ANÁLISIS DE TABLAS Y ESTRUCTURA');
    console.log('=====================================');
    
    const tablesResult = await client.query(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count,
        (SELECT COUNT(*) FROM pg_indexes WHERE tablename = t.table_name) as index_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(`📊 Total de tablas: ${tablesResult.rows.length}`);
    tablesResult.rows.forEach(row => {
      console.log(`   • ${row.table_name}: ${row.column_count} columnas, ${row.index_count} índices`);
    });
    
    // 2. ANÁLISIS DE ÍNDICES
    console.log('\n📈 ANÁLISIS DE ÍNDICES');
    console.log('=======================');
    
    const indexesResult = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);
    
    console.log(`📊 Total de índices: ${indexesResult.rows.length}`);
    indexesResult.rows.forEach(row => {
      console.log(`   • ${row.tablename}.${row.indexname}`);
    });
    
    // 3. ANÁLISIS DE DATOS
    console.log('\n📊 ANÁLISIS DE DATOS');
    console.log('=====================');
    
    const dataAnalysisResult = await client.query(`
      SELECT 
        'user_profiles' as table_name, COUNT(*) as record_count FROM user_profiles
      UNION ALL SELECT 'products', COUNT(*) FROM products
      UNION ALL SELECT 'orders', COUNT(*) FROM orders
      UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
      UNION ALL SELECT 'categories', COUNT(*) FROM categories
      UNION ALL SELECT 'user_favorites', COUNT(*) FROM user_favorites
      UNION ALL SELECT 'shopping_carts', COUNT(*) FROM shopping_carts
      UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
      UNION ALL SELECT 'product_reviews', COUNT(*) FROM product_reviews
      UNION ALL SELECT 'app_events', COUNT(*) FROM app_events
      ORDER BY record_count DESC
    `);
    
    console.log('📊 Registros por tabla:');
    dataAnalysisResult.rows.forEach(row => {
      console.log(`   • ${row.table_name}: ${row.record_count} registros`);
    });
    
    // 4. ANÁLISIS DE RENDIMIENTO
    console.log('\n⚡ ANÁLISIS DE RENDIMIENTO');
    console.log('===========================');
    
    const performanceResult = await client.query(`
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
      FROM pg_stats 
      WHERE schemaname = 'public'
      AND tablename IN ('orders', 'products', 'user_profiles', 'app_events')
      ORDER BY tablename, attname
    `);
    
    console.log('📊 Estadísticas de columnas:');
    performanceResult.rows.forEach(row => {
      console.log(`   • ${row.tablename}.${row.attname}: ${row.n_distinct} valores únicos, correlación: ${row.correlation}`);
    });
    
    // 5. ANÁLISIS DE FRAGMENTACIÓN
    console.log('\n🧩 ANÁLISIS DE FRAGMENTACIÓN');
    console.log('=============================');
    
    const fragmentationResult = await client.query(`
      SELECT 
        schemaname,
        tablename,
        attname,
        n_dead_tup,
        n_live_tup,
        ROUND((n_dead_tup::float / (n_live_tup + n_dead_tup) * 100), 2) as dead_percentage
      FROM pg_stat_user_tables 
      JOIN pg_attribute ON pg_stat_user_tables.relid = pg_attribute.attrelid
      WHERE schemaname = 'public'
      AND n_dead_tup > 0
      ORDER BY dead_percentage DESC
    `);
    
    if (fragmentationResult.rows.length > 0) {
      console.log('⚠️  Tablas con fragmentación:');
      fragmentationResult.rows.forEach(row => {
        console.log(`   • ${row.tablename}: ${row.dead_percentage}% fragmentación`);
      });
    } else {
      console.log('✅ No se detectó fragmentación significativa');
    }
    
    // 6. ANÁLISIS DE CONSULTAS LENTAS
    console.log('\n🐌 ANÁLISIS DE CONSULTAS LENTAS');
    console.log('===============================');
    
    const slowQueriesResult = await client.query(`
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        rows
      FROM pg_stat_statements 
      WHERE mean_time > 100
      ORDER BY mean_time DESC
      LIMIT 5
    `);
    
    if (slowQueriesResult.rows.length > 0) {
      console.log('⚠️  Consultas lentas detectadas:');
      slowQueriesResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. Tiempo promedio: ${row.mean_time}ms, Llamadas: ${row.calls}`);
      });
    } else {
      console.log('✅ No se detectaron consultas lentas');
    }
    
    // 7. ANÁLISIS DE CONFIGURACIÓN
    console.log('\n⚙️  ANÁLISIS DE CONFIGURACIÓN');
    console.log('==============================');
    
    const configResult = await client.query(`
      SELECT name, setting, unit, context
      FROM pg_settings 
      WHERE name IN (
        'shared_buffers', 'effective_cache_size', 'work_mem', 
        'maintenance_work_mem', 'checkpoint_completion_target',
        'wal_buffers', 'default_statistics_target', 'random_page_cost'
      )
      ORDER BY name
    `);
    
    console.log('📊 Configuración actual:');
    configResult.rows.forEach(row => {
      console.log(`   • ${row.name}: ${row.setting} ${row.unit || ''} (${row.context})`);
    });
    
  } catch (error) {
    console.error('❌ Error en el análisis:', error.message);
  } finally {
    await client.end();
  }
}

// Ejecutar análisis
analyzeDatabaseOptimization();
