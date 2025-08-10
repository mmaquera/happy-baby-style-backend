#!/usr/bin/env node

/**
 * Test script for the logging system
 * This script tests all components of the logging system
 */

const path = require('path');
require('dotenv').config();

// Add the src directory to the module path
require('tsconfig-paths').register({
  baseUrl: path.join(__dirname, '..'),
  paths: {
    '@domain/*': ['src/domain/*'],
    '@application/*': ['src/application/*'],
    '@infrastructure/*': ['src/infrastructure/*'],
    '@shared/*': ['src/shared/*'],
    '@graphql/*': ['src/graphql/*']
  }
});

async function testLoggingSystem() {
  console.log('🧪 Testing Logging System...\n');

  try {
    // Import logging components
    const { LoggerFactory } = require('../src/infrastructure/logging/LoggerFactory');
    const { WinstonLogger } = require('../src/infrastructure/logging/WinstonLogger');
    const { RequestLogger } = require('../src/infrastructure/logging/RequestLogger');
    const { PerformanceLogger } = require('../src/infrastructure/logging/PerformanceLogger');
    const { LoggingDecorator } = require('../src/infrastructure/logging/LoggingDecorator');
    const { LoggerConfigManager } = require('../src/infrastructure/logging/LoggerConfig');

    console.log('✅ Logging components imported successfully');

    // Test 1: Logger Configuration
    console.log('\n📋 Test 1: Logger Configuration');
    const configManager = LoggerConfigManager.getInstance();
    const config = configManager.getConfig();
    console.log('Configuration loaded:', {
      level: config.level,
      enableConsole: config.enableConsole,
      enableFile: config.enableFile,
      logDirectory: config.logDirectory
    });

    // Test 2: Logger Factory
    console.log('\n🏭 Test 2: Logger Factory');
    const loggerFactory = LoggerFactory.getInstance();
    const defaultLogger = loggerFactory.getDefaultLogger();
    const useCaseLogger = loggerFactory.createUseCaseLogger('TestUseCase');
    const repositoryLogger = loggerFactory.createRepositoryLogger('TestRepository');
    
    console.log('Loggers created successfully');

    // Test 3: Basic Logging
    console.log('\n📝 Test 3: Basic Logging');
    defaultLogger.info('Test info message', { test: true, timestamp: new Date().toISOString() });
    defaultLogger.warn('Test warning message', { warning: 'test' });
    defaultLogger.debug('Test debug message', { debug: 'info' });
    
    console.log('Basic logging completed');

    // Test 4: Context Logging
    console.log('\n🔗 Test 4: Context Logging');
    const contextLogger = loggerFactory.createLoggerWithContext({
      module: 'TestModule',
      operation: 'test',
      userId: 'test-user-123'
    });
    
    contextLogger.info('Context test message', { additional: 'data' });
    console.log('Context logging completed');

    // Test 5: Error Logging
    console.log('\n❌ Test 5: Error Logging');
    const testError = new Error('Test error for logging');
    testError.name = 'TestError';
    testError.code = 'TEST_ERROR';
    
    defaultLogger.error('Test error occurred', testError, { 
      operation: 'testOperation',
      userId: 'test-user'
    });
    console.log('Error logging completed');

    // Test 6: Performance Logging
    console.log('\n⏱️ Test 6: Performance Logging');
    const perfLogger = new PerformanceLogger();
    
    // Test timing with callback
    const { result, measurement } = await perfLogger.timeOperation(
      'testOperation',
      async () => {
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, data: 'test data' };
      },
      { test: true }
    );
    
    console.log('Performance measurement:', {
      operation: measurement.operation,
      duration: measurement.duration,
      result: result
    });

    // Test 7: Request Logging
    console.log('\n🌐 Test 7: Request Logging');
    const requestLogger = new RequestLogger();
    
    // Simulate GraphQL request logging
    requestLogger.logGraphQLRequest(
      'TestQuery',
      'query { test { id name } }',
      { id: 123 },
      'test-user',
      'test-trace-id'
    );
    
    requestLogger.logGraphQLResponse(
      'TestQuery',
      150,
      true,
      undefined,
      'test-user',
      'test-trace-id'
    );
    
    console.log('Request logging completed');

    // Test 8: Database Query Logging
    console.log('\n🗄️ Test 8: Database Query Logging');
    requestLogger.logDatabaseQuery(
      'SELECT * FROM products WHERE category = $1',
      ['electronics'],
      75,
      true,
      undefined,
      'test-trace-id'
    );
    
    console.log('Database logging completed');

    // Test 9: Authentication Logging
    console.log('\n🔐 Test 9: Authentication Logging');
    requestLogger.logAuthEvent(
      'login',
      'test-user',
      true,
      undefined,
      'test-trace-id'
    );
    
    console.log('Authentication logging completed');

    // Test 10: Log Summary
    console.log('\n📊 Test 10: Performance Summary');
    const summary = perfLogger.getSummary();
    console.log('Performance summary:', {
      totalOperations: summary.totalOperations,
      averageDuration: summary.averageDuration,
      minDuration: summary.minDuration,
      maxDuration: summary.maxDuration,
      slowOperations: summary.slowOperations.length
    });

    // Test 11: Child Logger
    console.log('\n👶 Test 11: Child Logger');
    const childLogger = defaultLogger.child({ 
      parent: 'defaultLogger',
      child: 'testChild' 
    });
    childLogger.info('Child logger test message');
    console.log('Child logger test completed');

    // Test 12: Trace ID
    console.log('\n🔍 Test 12: Trace ID');
    const traceLogger = defaultLogger.setTraceId('test-trace-123');
    traceLogger.info('Message with trace ID');
    console.log('Trace ID test completed');

    console.log('\n🎉 All logging tests completed successfully!');
    console.log('\n📁 Check the logs directory for generated log files:');
    console.log('   - application-YYYY-MM-DD.log');
    console.log('   - error-YYYY-MM-DD.log');
    
    // Wait a bit for logs to be written
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('\n✅ Logging system is working correctly!');

  } catch (error) {
    console.error('❌ Error testing logging system:', error);
    process.exit(1);
  }
}

// Run the test
testLoggingSystem().catch(console.error); 