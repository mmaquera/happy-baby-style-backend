#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class MigrationUtils {
  constructor() {
    this.backupDir = path.join(__dirname, '../backups');
    this.ensureBackupDir();
  }

  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // Crear backup de la base de datos
  async createBackup(environment = 'production') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `backup_${environment}_${timestamp}.sql`);
    
    console.log(`📦 Creando backup de ${environment}...`);
    
    try {
      // Usar DATABASE_URL del entorno actual
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL no está configurado');
      }

      // Crear backup usando pg_dump
      const command = `pg_dump "${databaseUrl}" > "${backupFile}"`;
      execSync(command, { stdio: 'inherit' });
      
      console.log(`✅ Backup creado: ${backupFile}`);
      return backupFile;
    } catch (error) {
      console.error('❌ Error creando backup:', error.message);
      throw error;
    }
  }

  // Restaurar backup
  async restoreBackup(backupFile) {
    console.log(`🔄 Restaurando backup: ${backupFile}`);
    
    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL no está configurado');
      }

      const command = `psql "${databaseUrl}" < "${backupFile}"`;
      execSync(command, { stdio: 'inherit' });
      
      console.log('✅ Backup restaurado exitosamente');
    } catch (error) {
      console.error('❌ Error restaurando backup:', error.message);
      throw error;
    }
  }

  // Verificar integridad de datos
  async verifyDataIntegrity() {
    console.log('🔍 Verificando integridad de datos...');
    
    try {
      // Ejecutar script de verificación
      const { PrismaService } = require('../dist/infrastructure/database/prisma');
      
      await PrismaService.connect();
      
      // Verificar conteos básicos
      const userCount = await PrismaService.getInstance().userProfile.count();
      const orderCount = await PrismaService.getInstance().order.count();
      const productCount = await PrismaService.getInstance().product.count();
      
      console.log(`📊 Conteos de datos:`);
      console.log(`   Usuarios: ${userCount}`);
      console.log(`   Órdenes: ${orderCount}`);
      console.log(`   Productos: ${productCount}`);
      
      // Verificar relaciones críticas
      const orphanedOrders = await PrismaService.getInstance().order.findMany({
        where: { user: null }
      });
      
      if (orphanedOrders.length > 0) {
        throw new Error(`Encontradas ${orphanedOrders.length} órdenes huérfanas`);
      }
      
      await PrismaService.disconnect();
      
      console.log('✅ Integridad de datos verificada');
      return true;
    } catch (error) {
      console.error('❌ Error verificando integridad:', error.message);
      throw error;
    }
  }

  // Ejecutar migración segura
  async safeMigration(migrationName) {
    console.log(`🔄 Iniciando migración segura: ${migrationName}`);
    
    try {
      // 1. Crear backup
      const backupFile = await this.createBackup();
      
      // 2. Verificar estado actual
      console.log('📋 Verificando estado de migraciones...');
      execSync('npx prisma migrate status', { stdio: 'inherit' });
      
      // 3. Aplicar migración
      console.log('🚀 Aplicando migración...');
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      
      // 4. Verificar integridad
      await this.verifyDataIntegrity();
      
      console.log('🎉 Migración completada exitosamente');
      return { success: true, backupFile };
    } catch (error) {
      console.error('❌ Error en migración:', error.message);
      
      // Intentar rollback si hay backup
      if (error.backupFile) {
        console.log('🔄 Intentando rollback...');
        try {
          await this.restoreBackup(error.backupFile);
          console.log('✅ Rollback completado');
        } catch (rollbackError) {
          console.error('❌ Error en rollback:', rollbackError.message);
        }
      }
      
      throw error;
    }
  }

  // Listar backups disponibles
  listBackups() {
    const files = fs.readdirSync(this.backupDir)
      .filter(file => file.endsWith('.sql'))
      .sort()
      .reverse();
    
    console.log('📦 Backups disponibles:');
    files.forEach(file => {
      const stats = fs.statSync(path.join(this.backupDir, file));
      console.log(`   ${file} (${new Date(stats.mtime).toLocaleString()})`);
    });
    
    return files;
  }

  // Limpiar backups antiguos (mantener últimos 10)
  cleanOldBackups() {
    const files = fs.readdirSync(this.backupDir)
      .filter(file => file.endsWith('.sql'))
      .map(file => ({
        name: file,
        path: path.join(this.backupDir, file),
        mtime: fs.statSync(path.join(this.backupDir, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    if (files.length > 10) {
      const toDelete = files.slice(10);
      console.log(`🗑️ Eliminando ${toDelete.length} backups antiguos...`);
      
      toDelete.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`   Eliminado: ${file.name}`);
      });
    }
  }
}

// CLI Interface
if (require.main === module) {
  const utils = new MigrationUtils();
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'backup':
      utils.createBackup(arg || 'production');
      break;
      
    case 'restore':
      if (!arg) {
        console.error('❌ Debes especificar el archivo de backup');
        process.exit(1);
      }
      utils.restoreBackup(arg);
      break;
      
    case 'verify':
      utils.verifyDataIntegrity();
      break;
      
    case 'migrate':
      utils.safeMigration(arg || 'migration');
      break;
      
    case 'list':
      utils.listBackups();
      break;
      
    case 'clean':
      utils.cleanOldBackups();
      break;
      
    default:
      console.log(`
🔄 Utilidades de Migración

Uso: node scripts/migration-utils.js <comando> [argumento]

Comandos:
  backup [env]     Crear backup de la base de datos
  restore <file>   Restaurar backup desde archivo
  verify           Verificar integridad de datos
  migrate [name]   Ejecutar migración segura
  list             Listar backups disponibles
  clean            Limpiar backups antiguos

Ejemplos:
  node scripts/migration-utils.js backup production
  node scripts/migration-utils.js restore backup_production_2024-01-15.sql
  node scripts/migration-utils.js migrate add_user_fields
      `);
  }
}

module.exports = MigrationUtils; 