#!/usr/bin/env node

const GRAPHQL_URL = 'http://localhost:3001/graphql';

async function testGraphQL() {
  console.log('🧪 Probando consultas GraphQL...\n');

  const queries = [
    {
      name: 'Health Check',
      query: '{ health }'
    },
    {
      name: 'Categories',
      query: '{ categories { id name slug } }'
    },
    {
      name: 'Products',
      query: '{ products { products { id name price } total hasMore } }'
    },
    {
      name: 'Product Stats',
      query: '{ productStats }'
    }
  ];

  for (const test of queries) {
    try {
      console.log(`📋 Probando: ${test.name}`);
      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: test.query
        })
      });

      const data = await response.json();

      if (data.errors) {
        console.log(`❌ Error: ${data.errors[0].message}`);
      } else {
        console.log(`✅ Éxito: ${JSON.stringify(data.data).substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`❌ Error de conexión: ${error.message}`);
    }
    console.log('');
  }
}

testGraphQL().catch(console.error); 