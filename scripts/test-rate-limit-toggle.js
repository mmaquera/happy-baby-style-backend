#!/usr/bin/env node

/**
 * Test script to verify rate limiting toggle functionality
 * Run with: node scripts/test-rate-limit-toggle.js
 */

// Simulate different environment configurations
const testConfigs = [
  { ENABLE_RATE_LIMIT: 'true', expected: true, description: 'Rate limit enabled' },
  { ENABLE_RATE_LIMIT: 'false', expected: false, description: 'Rate limit disabled' },
  { ENABLE_RATE_LIMIT: undefined, expected: true, description: 'Rate limit default (enabled)' },
  { ENABLE_RATE_LIMIT: 'invalid', expected: true, description: 'Rate limit invalid value (enabled)' },
];

console.log('🧪 Testing Rate Limit Toggle Configuration\n');

testConfigs.forEach((config, index) => {
  // Simulate environment variable
  if (config.ENABLE_RATE_LIMIT !== undefined) {
    process.env.ENABLE_RATE_LIMIT = config.ENABLE_RATE_LIMIT;
  } else {
    delete process.env.ENABLE_RATE_LIMIT;
  }

  // Simulate the logic from environment.ts
  const enableRateLimit = process.env.ENABLE_RATE_LIMIT !== 'false';
  
  const status = enableRateLimit === config.expected ? '✅ PASS' : '❌ FAIL';
  
  console.log(`${index + 1}. ${config.description}`);
  console.log(`   ENV: ENABLE_RATE_LIMIT=${config.ENABLE_RATE_LIMIT || 'undefined'}`);
  console.log(`   Result: ${enableRateLimit} (Expected: ${config.expected})`);
  console.log(`   Status: ${status}\n`);
});

console.log('📋 Summary:');
console.log('- Set ENABLE_RATE_LIMIT=false to disable rate limiting in development');
console.log('- Set ENABLE_RATE_LIMIT=true or omit to enable rate limiting');
console.log('- Default behavior: rate limiting is ENABLED (secure by default)');
console.log('- Only set to false in development environments');
