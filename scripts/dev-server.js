#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class DevServer {
  constructor() {
    this.serverProcess = null;
    this.port = 3001;
    this.isRunning = false;
  }

  // Función para limpiar procesos existentes
  async cleanupProcesses() {
    console.log('🧹 Limpiando procesos existentes...');
    
    return new Promise((resolve) => {
      // Buscar y matar procesos que usen el puerto 3001
      exec(`lsof -ti:${this.port}`, (error, stdout) => {
        if (stdout.trim()) {
          const pids = stdout.trim().split('\n');
          console.log(`📋 Procesos encontrados en puerto ${this.port}: ${pids.join(', ')}`);
          
          pids.forEach(pid => {
            exec(`kill -9 ${pid}`, (killError) => {
              if (killError) {
                console.log(`⚠️  No se pudo matar proceso ${pid}: ${killError.message}`);
              } else {
                console.log(`✅ Proceso ${pid} terminado`);
              }
            });
          });
        } else {
          console.log(`✅ No hay procesos usando el puerto ${this.port}`);
        }
        
        // Esperar un poco para que los procesos se cierren
        setTimeout(resolve, 2000);
      });
    });
  }

  // Función para verificar si el puerto está libre
  async checkPort() {
    return new Promise((resolve) => {
      exec(`lsof -i:${this.port}`, (error) => {
        resolve(!error); // Si hay error, el puerto está libre
      });
    });
  }

  // Función para iniciar el servidor
  startServer() {
    console.log('🚀 Iniciando servidor de desarrollo...');
    
    // Configurar el proceso del servidor
    this.serverProcess = spawn('npx', [
      'ts-node-dev',
      '-r', 'tsconfig-paths/register',
      '--respawn',
      '--transpile-only',
      'apps/legacy-api/src/index.ts'
    ], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, TS_NODE_PROJECT: 'apps/legacy-api/tsconfig.json' }
    });

    this.isRunning = true;

    // Manejar eventos del proceso
    this.serverProcess.on('error', (error) => {
      console.error('❌ Error al iniciar el servidor:', error.message);
      this.isRunning = false;
    });

    this.serverProcess.on('exit', (code) => {
      console.log(`📤 Servidor terminado con código: ${code}`);
      this.isRunning = false;
    });

    // Manejar señales de terminación
    process.on('SIGINT', () => this.stopServer());
    process.on('SIGTERM', () => this.stopServer());
    process.on('SIGQUIT', () => this.stopServer());

    console.log('✅ Servidor iniciado correctamente');
    console.log(`🌐 Servidor disponible en: http://localhost:${this.port}`);
    console.log('📝 Presiona Ctrl+C para detener el servidor');
  }

  // Función para detener el servidor
  async stopServer() {
    if (this.serverProcess && this.isRunning) {
      console.log('\n🛑 Deteniendo servidor...');
      this.serverProcess.kill('SIGTERM');
      this.isRunning = false;
      
      // Esperar a que el proceso termine
      await new Promise(resolve => {
        this.serverProcess.on('exit', resolve);
        setTimeout(resolve, 3000); // Timeout de 3 segundos
      });
    }
    
    console.log('👋 Servidor detenido. ¡Hasta luego!');
    process.exit(0);
  }

  // Función principal
  async run() {
    try {
      console.log('🎯 Iniciando servidor de desarrollo con gestión automática de puertos...\n');
      
      // Limpiar procesos existentes
      await this.cleanupProcesses();
      
      // Verificar que el puerto esté libre
      const portInUse = await this.checkPort();
      if (portInUse) {
        console.log(`⚠️  El puerto ${this.port} aún está en uso. Intentando limpiar nuevamente...`);
        await this.cleanupProcesses();
        
        const stillInUse = await this.checkPort();
        if (stillInUse) {
          console.error(`❌ No se pudo liberar el puerto ${this.port}. Por favor, verifica manualmente.`);
          process.exit(1);
        }
      }
      
      // Iniciar el servidor
      this.startServer();
      
    } catch (error) {
      console.error('❌ Error en el servidor de desarrollo:', error.message);
      process.exit(1);
    }
  }
}

// Ejecutar el servidor
const devServer = new DevServer();
devServer.run(); 