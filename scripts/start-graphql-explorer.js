#!/usr/bin/env node

/**
 * Script para iniciar el servidor GraphQL y abrir el playground
 * Este script facilita la exploración de la API GraphQL
 */

const { spawn } = require('child_process');
const { exec } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 3001;
const GRAPHQL_URL = `http://localhost:${PORT}/graphql`;
const HEALTH_URL = `http://localhost:${PORT}/health`;

console.log('🚀 Iniciando explorador de GraphQL para Happy Baby Style...\n');

// Función para verificar si el puerto está disponible
function checkPort(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

// Función para esperar a que el servidor esté listo
function waitForServer(url, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const checkServer = async () => {
      attempts++;
      
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch (error) {
        // Servidor aún no está listo
      }
      
      if (attempts >= maxAttempts) {
        reject(new Error(`Servidor no respondió después de ${maxAttempts} intentos`));
        return;
      }
      
      setTimeout(checkServer, 1000);
    };
    
    checkServer();
  });
}

// Función para abrir el navegador
function openBrowser(url) {
  const platform = process.platform;
  
  let command;
  switch (platform) {
    case 'darwin':
      command = `open "${url}"`;
      break;
    case 'win32':
      command = `start "${url}"`;
      break;
    default:
      command = `xdg-open "${url}"`;
  }
  
  exec(command, (error) => {
    if (error) {
      console.log(`❌ No se pudo abrir el navegador automáticamente`);
      console.log(`🔗 Abre manualmente: ${url}`);
    } else {
      console.log(`✅ Navegador abierto en: ${url}`);
    }
  });
}

// Función principal
async function startGraphQLExplorer() {
  try {
    // Verificar si el puerto está disponible
    const portAvailable = await checkPort(PORT);
    if (!portAvailable) {
      console.log(`⚠️  El puerto ${PORT} ya está en uso`);
      console.log(`🔄 Intentando iniciar el servidor...`);
    }

    // Iniciar el servidor de desarrollo
    console.log('📡 Iniciando servidor de desarrollo...');
    const serverProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'pipe',
      shell: true,
      cwd: path.join(__dirname, '..')
    });

    // Manejar salida del servidor
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      
      // Detectar cuando el servidor está listo
      if (output.includes('GraphQL Server running') || output.includes('GraphQL API Ready')) {
        console.log('\n✅ Servidor iniciado correctamente!');
        
        // Esperar un poco más para asegurar que esté completamente listo
        setTimeout(async () => {
          try {
            console.log('🔍 Verificando que el servidor esté listo...');
            await waitForServer(HEALTH_URL);
            
            console.log('\n🎉 ¡Servidor GraphQL listo!');
            console.log(`📊 Health Check: ${HEALTH_URL}`);
            console.log(`🔍 GraphQL Playground: ${GRAPHQL_URL}`);
            
            // Abrir el playground en el navegador
            console.log('\n🌐 Abriendo GraphQL Playground...');
            openBrowser(GRAPHQL_URL);
            
            console.log('\n📋 Información útil:');
            console.log('• GraphQL Playground: Interfaz visual para explorar la API');
            console.log('• Schema Explorer: Documentación automática del esquema');
            console.log('• Query Builder: Constructor de consultas interactivo');
            console.log('• Variables: Soporte para variables de consulta');
            console.log('• Headers: Configuración de autenticación');
            
            console.log('\n🔧 Comandos útiles:');
            console.log('• Ctrl+C: Detener el servidor');
            console.log('• npm run test:graphql:complete: Probar la API');
            console.log('• npm run graphql:codegen: Generar tipos TypeScript');
            
          } catch (error) {
            console.error('❌ Error al verificar el servidor:', error.message);
          }
        }, 2000);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('❌ Error del servidor:', data.toString());
    });

    serverProcess.on('error', (error) => {
      console.error('❌ Error al iniciar el servidor:', error);
    });

    serverProcess.on('close', (code) => {
      console.log(`\n🛑 Servidor detenido con código: ${code}`);
    });

    // Manejar interrupción del proceso
    process.on('SIGINT', () => {
      console.log('\n🛑 Deteniendo servidor...');
      serverProcess.kill('SIGINT');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Deteniendo servidor...');
      serverProcess.kill('SIGTERM');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Ejecutar el script
startGraphQLExplorer(); 