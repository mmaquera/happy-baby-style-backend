#!/usr/bin/env node

/**
 * Script para probar la validación de imágenes en categorías
 * Verifica que tanto URLs absolutas como rutas relativas sean aceptadas
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuración
const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';
const TEST_CATEGORY_ID = 'cat-test-123'; // ID de prueba

// Colores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeGraphQLRequest(query, variables = {}) {
  try {
    const response = execSync(`curl -s -X POST ${GRAPHQL_ENDPOINT} \\
      -H "Content-Type: application/json" \\
      -d '{"query": "${query.replace(/\n/g, '\\n').replace(/"/g, '\\"')}", "variables": ${JSON.stringify(variables)}}'`, 
      { encoding: 'utf8', timeout: 10000 });
    
    return JSON.parse(response);
  } catch (error) {
    log(`Error en request GraphQL: ${error.message}`, 'red');
    return null;
  }
}

// Casos de prueba para validación de imágenes
const testCases = [
  {
    name: 'Ruta relativa válida (SVG)',
    imageUrl: '/uploads/categorys/temp/category_temp_1760577292932_1760577292932.svg',
    shouldPass: true
  },
  {
    name: 'Ruta relativa válida (JPG)',
    imageUrl: '/uploads/categorys/baby-clothing.jpg',
    shouldPass: true
  },
  {
    name: 'URL absoluta válida (HTTPS)',
    imageUrl: 'https://example.com/images/baby-clothing.jpg',
    shouldPass: true
  },
  {
    name: 'URL absoluta válida (HTTP)',
    imageUrl: 'http://example.com/images/baby-clothing.jpg',
    shouldPass: true
  },
  {
    name: 'Ruta relativa inválida (sin slash inicial)',
    imageUrl: 'uploads/categorys/baby-clothing.jpg',
    shouldPass: false
  },
  {
    name: 'Ruta relativa inválida (caracteres especiales)',
    imageUrl: '/uploads/categorys/baby-clothing@#$%.jpg',
    shouldPass: false
  },
  {
    name: 'URL absoluta inválida',
    imageUrl: 'https://invalid-url-format',
    shouldPass: false
  },
  {
    name: 'String vacío',
    imageUrl: '',
    shouldPass: false
  },
  {
    name: 'Solo espacios',
    imageUrl: '   ',
    shouldPass: false
  }
];

async function testCreateCategory(imageUrl, testName) {
  log(`\n🧪 Probando: ${testName}`, 'blue');
  log(`   URL: ${imageUrl}`, 'yellow');

  const mutation = `
    mutation CreateCategory($input: CreateCategoryInput!) {
      createCategory(input: $input) {
        success
        message
        code
        data {
          entity {
            id
            name
            imageUrl
          }
        }
      }
    }
  `;

  const variables = {
    input: {
      name: `Test Category ${Date.now()}`,
      description: 'Test category for image validation',
      imageUrl: imageUrl,
      isActive: true,
      sortOrder: 1
    }
  };

  const response = makeGraphQLRequest(mutation, variables);
  
  if (!response) {
    log('   ❌ Error en la respuesta', 'red');
    return false;
  }

  const result = response.data?.createCategory;
  
  if (result?.success) {
    log('   ✅ Éxito - Categoría creada', 'green');
    return true;
  } else {
    log(`   ❌ Error: ${result?.message || 'Error desconocido'}`, 'red');
    return false;
  }
}

async function testUpdateCategory(imageUrl, testName) {
  log(`\n🧪 Probando: ${testName}`, 'blue');
  log(`   URL: ${imageUrl}`, 'yellow');

  const mutation = `
    mutation UpdateCategory($id: ID!, $input: UpdateCategoryInput!) {
      updateCategory(id: $id, input: $input) {
        success
        message
        code
        data {
          entity {
            id
            name
            imageUrl
          }
        }
      }
    }
  `;

  const variables = {
    id: TEST_CATEGORY_ID,
    input: {
      imageUrl: imageUrl
    }
  };

  const response = makeGraphQLRequest(mutation, variables);
  
  if (!response) {
    log('   ❌ Error en la respuesta', 'red');
    return false;
  }

  const result = response.data?.updateCategory;
  
  if (result?.success) {
    log('   ✅ Éxito - Categoría actualizada', 'green');
    return true;
  } else {
    log(`   ❌ Error: ${result?.message || 'Error desconocido'}`, 'red');
    return false;
  }
}

async function runTests() {
  log('🚀 Iniciando pruebas de validación de imágenes en categorías', 'green');
  log('=' .repeat(60), 'blue');

  let passedTests = 0;
  let totalTests = 0;

  // Probar creación de categorías
  log('\n📝 PROBANDO CREACIÓN DE CATEGORÍAS', 'blue');
  log('-' .repeat(40), 'blue');

  for (const testCase of testCases) {
    totalTests++;
    const passed = await testCreateCategory(testCase.imageUrl, `Create - ${testCase.name}`);
    
    if (passed === testCase.shouldPass) {
      passedTests++;
    } else {
      log(`   ⚠️  Resultado inesperado: esperaba ${testCase.shouldPass ? 'éxito' : 'error'}`, 'yellow');
    }
  }

  // Probar actualización de categorías
  log('\n📝 PROBANDO ACTUALIZACIÓN DE CATEGORÍAS', 'blue');
  log('-' .repeat(40), 'blue');

  for (const testCase of testCases) {
    totalTests++;
    const passed = await testUpdateCategory(testCase.imageUrl, `Update - ${testCase.name}`);
    
    if (passed === testCase.shouldPass) {
      passedTests++;
    } else {
      log(`   ⚠️  Resultado inesperado: esperaba ${testCase.shouldPass ? 'éxito' : 'error'}`, 'yellow');
    }
  }

  // Resumen
  log('\n📊 RESUMEN DE PRUEBAS', 'blue');
  log('=' .repeat(60), 'blue');
  log(`Total de pruebas: ${totalTests}`, 'blue');
  log(`Pruebas exitosas: ${passedTests}`, passedTests === totalTests ? 'green' : 'red');
  log(`Pruebas fallidas: ${totalTests - passedTests}`, totalTests - passedTests === 0 ? 'green' : 'red');
  
  if (passedTests === totalTests) {
    log('\n🎉 ¡Todas las pruebas pasaron! La validación funciona correctamente.', 'green');
  } else {
    log('\n⚠️  Algunas pruebas fallaron. Revisar la implementación.', 'yellow');
  }
}

// Verificar que el servidor esté corriendo
async function checkServer() {
  log('🔍 Verificando que el servidor GraphQL esté corriendo...', 'blue');
  
  const healthQuery = '{ __schema { types { name } } }';
  const response = makeGraphQLRequest(healthQuery);
  
  if (response && response.data) {
    log('✅ Servidor GraphQL está corriendo', 'green');
    return true;
  } else {
    log('❌ Servidor GraphQL no está disponible', 'red');
    log('   Asegúrate de que el servidor esté corriendo en http://localhost:4000', 'yellow');
    return false;
  }
}

// Ejecutar pruebas
async function main() {
  try {
    const serverRunning = await checkServer();
    if (!serverRunning) {
      process.exit(1);
    }
    
    await runTests();
  } catch (error) {
    log(`\n💥 Error durante las pruebas: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testCreateCategory, testUpdateCategory, testCases };
