const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

// Cargar variables de entorno con la misma precedencia que la app
// .env -> .env.{env} -> .env.{env}.local -> .env.local
(function loadEnvFiles() {
  const cwd = process.cwd();
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  console.log(`🔧 NODE_ENV: ${nodeEnv}`);
  
  // Si no hay .env, cargar directamente el archivo de entorno específico
  const envFile = path.join(cwd, `env.${nodeEnv}`);
  console.log(`🔧 Buscando archivo: ${envFile}`);
  console.log(`🔧 Archivo existe: ${fs.existsSync(envFile)}`);
  
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
    console.log(`📁 Cargando configuración desde: .env.${nodeEnv}`);
    console.log(`🔧 DATABASE_URL cargado: ${process.env.DATABASE_URL ? 'SÍ' : 'NO'}`);
    console.log(`🔧 DB_SSL cargado: ${process.env.DB_SSL ? 'SÍ' : 'NO'}`);
  } else {
    // Fallback a la precedencia original
    const files = [
      path.join(cwd, 'env'),
      path.join(cwd, `env.${nodeEnv}`),
      path.join(cwd, `env.${nodeEnv}.local`),
      path.join(cwd, 'env.local'),
    ];
    files.forEach((file, index) => {
      if (fs.existsSync(file)) {
        dotenv.config({ path: file, override: index > 0 });
      }
    });
  }
})();

// Construir configuración de conexión
function buildDbConfigFromEnv() {
  const rawUrl = (process.env.DATABASE_URL || '').trim();
  const dbSslEnv = (process.env.DB_SSL || '').toLowerCase() === 'true';

  let sslOption = false;

  // Derivar SSL desde sslmode del URL si existe
  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      const sslmode = (u.searchParams.get('sslmode') || '').toLowerCase();
      if (dbSslEnv || ['require', 'verify-full', 'prefer', 'allow'].includes(sslmode)) {
        // En desarrollo, probar diferentes configuraciones SSL para RDS
        sslOption = { 
          rejectUnauthorized: false,
          checkServerIdentity: () => undefined, // No verificar hostname
          ca: false, // No verificar CA
          cert: false, // No verificar certificado del cliente
          key: false, // No verificar clave del cliente
        };
      }
    } catch {
      // Si falla el parseo, dejamos sslOption según DB_SSL
      if (dbSslEnv) sslOption = { 
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
        ca: false,
        cert: false,
        key: false,
      };
    }
  } else if (dbSslEnv) {
    sslOption = { 
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
      ca: false,
      cert: false,
      key: false,
    };
  }

  if (rawUrl) {
    return {
      connectionString: rawUrl,
      ssl: sslOption,
    };
  }

  return {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: sslOption,
  };
}

const config = buildDbConfigFromEnv();

async function testConnection() {
  const client = new Client(config);

  // Resumen no sensible para diagnóstico
  const summary = (() => {
    if (config.connectionString) {
      try {
        const u = new URL(config.connectionString);
        return {
          host: u.hostname,
          port: u.port || '5432',
          database: (u.pathname || '').replace(/^\//, ''),
          ssl: !!config.ssl,
          sslMode: new URL(config.connectionString).searchParams.get('sslmode') || undefined,
        };
      } catch {
        return { from: 'DATABASE_URL', ssl: !!config.ssl };
      }
    }
    return {
      host: config.host,
      port: config.port,
      database: config.database,
      ssl: !!config.ssl,
    };
  })();

  try {
    console.log('🔍 Conectando a RDS Amazon...');
    if (config.connectionString) {
      console.log('📍 Usando DATABASE_URL');
    } else {
      console.log(`📍 Host: ${config.host}`);
      console.log(`🗄️  Database: ${config.database}`);
      console.log(`👤 User: ${config.user}`);
    }
    console.log(`🔐 SSL: ${summary.ssl} ${summary.sslMode ? `(sslmode=${summary.sslMode})` : ''}`);
    console.log(`🔧 SSL Config: ${JSON.stringify(config.ssl)}`);

    await client.connect();
    console.log('✅ Conexión exitosa a RDS Amazon!');

    const result = await client.query('SELECT version(), current_database(), current_user, now() as current_time');

    console.log('\n📊 Información de la base de datos:');
    const versionParts = (result.rows[0].version || '').split(' ');
    console.log(`   • PostgreSQL Version: ${versionParts[0]} ${versionParts[1] || ''}`);
    console.log(`   • Database: ${result.rows[0].current_database}`);
    console.log(`   • User: ${result.rows[0].current_user}`);
    console.log(`   • Current Time: ${result.rows[0].current_time}`);

    const tablesResult = await client.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`\n📋 Tablas existentes (${tablesResult.rows.length}):`);
    tablesResult.rows.forEach(row => {
      console.log(`   • ${row.table_name} (${row.table_type})`);
    });

    console.log('\n🎯 Base de datos lista!');
  } catch (error) {
    console.error('❌ Error conectando a RDS:', error.message);
    if (error && error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      console.error('💡 Sugerencia: agrega \'?sslmode=require\' a DATABASE_URL y/o define DB_SSL=true para no validar CA en desarrollo.');
    }
    if (error && error.code === '28000') {
      console.error('💡 Sugerencia: verifica reglas de acceso (pg_hba.conf/Firewall/Security Group) y/o SSL requerido.');
    }
    console.error('🔧 Detalles del error:', error);
    console.log('\nResumen de config de conexión:', summary);
  } finally {
    try { await client.end(); } catch {}
  }
}

// Ejecutar validación
testConnection();

