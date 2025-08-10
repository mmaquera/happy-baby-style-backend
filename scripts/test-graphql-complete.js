#!/usr/bin/env node

const fetch = require('node-fetch');

const GRAPHQL_URL = 'http://localhost:3001/graphql';

async function testGraphQL() {
  console.log('🧪 Probando funcionalidades GraphQL completas...\n');

  const tests = [
    // Queries básicas
    {
      name: 'Health Check',
      query: '{ health }',
      expected: 'OK'
    },
    {
      name: 'Categories',
      query: '{ categories { id name slug isActive } }',
      expected: 'data'
    },
    {
      name: 'Products',
      query: '{ products { products { id name price } total hasMore } }',
      expected: 'data'
    },
    {
      name: 'Product Stats',
      query: '{ productStats }',
      expected: 'data'
    },
    {
      name: 'Order Stats',
      query: '{ orderStats }',
      expected: 'data'
    },
    {
      name: 'User Stats',
      query: '{ userStats }',
      expected: 'data'
    },
    // Mutations básicas
    {
      name: 'Create Category',
      query: `
        mutation {
          createCategory(input: {
            name: "Test Category GraphQL"
            description: "Category created via GraphQL"
            slug: "test-category-graphql"
            isActive: true
            sortOrder: 1
          }) {
            id
            name
            slug
          }
        }
      `,
      expected: 'data'
    },
    {
      name: 'Create Product',
      query: `
        mutation {
          createProduct(input: {
            name: "Test Product GraphQL"
            description: "Product created via GraphQL"
            price: "99.99"
            sku: "TEST-GQL-001"
            isActive: true
            stockQuantity: 10
          }) {
            id
            name
            price
            sku
          }
        }
      `,
      expected: 'data'
    },
    {
      name: 'Create User Profile',
      query: `
        mutation {
          createUserProfile(input: {
            userId: "test-user-gql"
            firstName: "Test"
            lastName: "User"
            phone: "+1234567890"
          }) {
            id
            userId
            firstName
            lastName
          }
        }
      `,
      expected: 'data'
    },
    {
      name: 'Create Order',
      query: `
        mutation {
          createOrder(input: {
            userId: "test-user-gql"
            status: "pending"
            totalAmount: "99.99"
            items: []
          }) {
            id
            status
            totalAmount
          }
        }
      `,
      expected: 'data'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`📋 Probando: ${test.name}`);
      
      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: test.query
        })
      });

      const result = await response.json();

      if (result.errors) {
        console.log(`❌ Error: ${result.errors[0].message}`);
        failed++;
      } else if (result.data) {
        console.log(`✅ Éxito: ${test.name}`);
        if (test.expected === 'data') {
          console.log(`   📊 Datos recibidos: ${JSON.stringify(result.data).substring(0, 100)}...`);
        } else {
          console.log(`   📊 Resultado: ${result.data.health || result.data}`);
        }
        passed++;
      } else {
        console.log(`❌ Respuesta inesperada: ${JSON.stringify(result)}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ Error de conexión: ${error.message}`);
      failed++;
    }
    
    console.log(''); // Línea en blanco
  }

  console.log('📊 Resumen de pruebas:');
  console.log(`✅ Exitosas: ${passed}`);
  console.log(`❌ Fallidas: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 ¡Todas las pruebas pasaron! GraphQL está funcionando correctamente.');
  } else {
    console.log('\n⚠️  Algunas pruebas fallaron. Revisa los errores arriba.');
  }
}

// Ejecutar pruebas
testGraphQL().catch(console.error); 