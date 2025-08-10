#!/usr/bin/env node

const { environment } = require('../dist/config/environment');
const { PrismaService } = require('../dist/infrastructure/database/prisma');

async function validateEnvironment() {
  console.log('🔍 Validating Environment Configuration');
  console.log('=====================================');

  const config = environment.getConfig();
  const dbConfig = environment.getDatabaseConfig();

  let isValid = true;
  const errors = [];
  const warnings = [];

  // Validate required environment variables
  console.log('\n📋 Validating Configuration...');

  // Check environment
  if (!['development', 'production', 'test'].includes(config.nodeEnv)) {
    errors.push(`Invalid NODE_ENV: ${config.nodeEnv}`);
    isValid = false;
  }

  // Check database configuration
  if (!dbConfig.host) {
    errors.push('Database host is not configured');
    isValid = false;
  }

  if (!dbConfig.database) {
    errors.push('Database name is not configured');
    isValid = false;
  }

  if (!dbConfig.user) {
    errors.push('Database user is not configured');
    isValid = false;
  }

  if (!dbConfig.password) {
    errors.push('Database password is not configured');
    isValid = false;
  }

  // Check JWT configuration
  if (!config.jwtSecret || config.jwtSecret === 'your-super-secret-jwt-key-for-production-change-this') {
    warnings.push('JWT secret should be changed in production');
  }

  // Check port
  if (config.port < 1 || config.port > 65535) {
    errors.push(`Invalid port: ${config.port}`);
    isValid = false;
  }

  // Test database connection
  console.log('\n🗄️ Testing Database Connection...');
  try {
    await PrismaService.connect();
    const isHealthy = await PrismaService.healthCheck();
    
    if (isHealthy) {
      console.log('✅ Database connection successful');
    } else {
      errors.push('Database health check failed');
      isValid = false;
    }
    
    await PrismaService.disconnect();
  } catch (error) {
    errors.push(`Database connection failed: ${error.message}`);
    isValid = false;
  }

  // Display results
  console.log('\n📊 Validation Results:');
  console.log('=====================');

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(error => console.log(`   - ${error}`));
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warning => console.log(`   - ${warning}`));
  }

  if (isValid) {
    console.log('\n✅ Environment configuration is valid!');
    console.log('\n🎯 Environment Summary:');
    console.log(`   Mode: ${config.nodeEnv}`);
    console.log(`   Database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    console.log(`   Port: ${config.port}`);
    console.log(`   GraphQL Playground: ${config.enableGraphQLPlayground ? 'Enabled' : 'Disabled'}`);
  } else {
    console.log('\n❌ Environment configuration has errors!');
    process.exit(1);
  }
}

// Run validation
validateEnvironment().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
}); 