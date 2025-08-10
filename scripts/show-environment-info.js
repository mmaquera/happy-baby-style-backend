#!/usr/bin/env node

const { environment } = require('../dist/config/environment');

console.log('🔍 Environment Information');
console.log('========================');

const config = environment.getConfig();
const dbConfig = environment.getDatabaseConfig();

console.log('\n📊 Server Configuration:');
console.log(`   Environment: ${config.nodeEnv}`);
console.log(`   Port: ${config.port}`);
console.log(`   Frontend URL: ${config.frontendUrl}`);

console.log('\n🗄️ Database Configuration:');
console.log(`   Host: ${dbConfig.host}`);
console.log(`   Port: ${dbConfig.port}`);
console.log(`   Database: ${dbConfig.database}`);
console.log(`   User: ${dbConfig.user}`);
console.log(`   SSL: ${dbConfig.ssl ? 'Enabled' : 'Disabled'}`);

console.log('\n🔧 Feature Flags:');
console.log(`   GraphQL Playground: ${config.enableGraphQLPlayground ? 'Enabled' : 'Disabled'}`);
console.log(`   CORS: ${config.enableCors ? 'Enabled' : 'Disabled'}`);
console.log(`   Compression: ${config.enableCompression ? 'Enabled' : 'Disabled'}`);
console.log(`   Helmet: ${config.enableHelmet ? 'Enabled' : 'Disabled'}`);

console.log('\n📝 Logging Configuration:');
console.log(`   Level: ${config.logLevel}`);
console.log(`   Console: ${config.logEnableConsole ? 'Enabled' : 'Disabled'}`);
console.log(`   File: ${config.logEnableFile ? 'Enabled' : 'Disabled'}`);
console.log(`   Directory: ${config.logDirectory}`);

console.log('\n🔐 Security Configuration:');
console.log(`   JWT Expires In: ${config.jwtExpiresIn}`);
console.log(`   JWT Refresh Expires In: ${config.jwtRefreshExpiresIn}`);

console.log('\n📁 File Upload Configuration:');
console.log(`   Max File Size: ${config.maxFileSize} bytes (${(config.maxFileSize / 1024 / 1024).toFixed(2)} MB)`);
console.log(`   Upload Path: ${config.uploadPath}`);

console.log('\n🎯 Environment Summary:');
if (config.nodeEnv === 'development') {
  console.log('   🟢 Development Mode - Using AWS RDS');
  console.log('   📍 Database: AWS RDS PostgreSQL');
  console.log('   🔍 GraphQL Playground: Available');
  console.log('   📊 Logging: Debug level');
} else if (config.nodeEnv === 'production') {
  console.log('   🔴 Production Mode - Using Local PostgreSQL');
  console.log('   📍 Database: Local PostgreSQL');
  console.log('   🔍 GraphQL Playground: Disabled');
  console.log('   📊 Logging: Info level');
}

console.log('\n✅ Environment configuration loaded successfully!'); 