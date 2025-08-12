#!/usr/bin/env node

/**
 * Test Script for Category Mutations
 * Tests the complete CRUD operations for categories using GraphQL
 */

const { ApolloClient, InMemoryCache, gql, createHttpLink } = require('@apollo/client/core');
const fetch = require('cross-fetch');

// GraphQL endpoint
const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

// Apollo Client setup
const client = new ApolloClient({
  link: createHttpLink({
    uri: GRAPHQL_ENDPOINT,
    fetch
  }),
  cache: new InMemoryCache()
});

// GraphQL mutations and queries
const CREATE_CATEGORY = gql`
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      success
      message
      code
      timestamp
      data {
        entity {
          id
          name
          description
          slug
          imageUrl
          isActive
          sortOrder
          createdAt
          updatedAt
        }
        id
        createdAt
      }
      metadata {
        requestId
        traceId
        duration
      }
    }
  }
`;

const UPDATE_CATEGORY = gql`
  mutation UpdateCategory($id: ID!, $input: UpdateCategoryInput!) {
    updateCategory(id: $id, input: $input) {
      success
      message
      code
      timestamp
      data {
        entity {
          id
          name
          description
          slug
          imageUrl
          isActive
          sortOrder
          createdAt
          updatedAt
        }
        id
        updatedAt
        changes
      }
      metadata {
        requestId
        traceId
        duration
      }
    }
  }
`;

const DELETE_CATEGORY = gql`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id) {
      success
      message
      code
      timestamp
      data {
        id
        deletedAt
        softDelete
      }
      metadata {
        requestId
        traceId
        duration
      }
    }
  }
`;

const GET_CATEGORIES = gql`
  query GetCategories {
    categories {
      success
      message
      code
      timestamp
      data {
        items {
          id
          name
          description
          slug
          imageUrl
          isActive
          sortOrder
          createdAt
          updatedAt
        }
        pagination {
          total
          limit
          offset
          hasMore
          currentPage
          totalPages
        }
      }
      metadata {
        requestId
        traceId
        duration
      }
    }
  }
`;

/**
 * Test functions
 */
async function testCreateCategory() {
  console.log('\n🧪 Testing Create Category...');
  
  try {
    const input = {
      name: 'Test Category ' + Date.now(),
      description: 'A test category for testing purposes',
      slug: 'test-category-' + Date.now(),
      imageUrl: 'https://example.com/test-image.jpg',
      isActive: true,
      sortOrder: 1
    };

    const result = await client.mutate({
      mutation: CREATE_CATEGORY,
      variables: { input }
    });

    const response = result.data.createCategory;
    
    if (response.success) {
      console.log('✅ Create Category: SUCCESS');
      console.log(`   ID: ${response.data.id}`);
      console.log(`   Name: ${response.data.entity.name}`);
      console.log(`   Code: ${response.code}`);
      console.log(`   Duration: ${response.metadata.duration}ms`);
      return response.data.id;
    } else {
      console.log('❌ Create Category: FAILED');
      console.log(`   Error: ${response.message}`);
      return null;
    }
  } catch (error) {
    console.log('❌ Create Category: ERROR');
    console.log(`   ${error.message}`);
    return null;
  }
}

async function testUpdateCategory(categoryId) {
  if (!categoryId) {
    console.log('⏭️  Skipping Update Category (no category ID)');
    return;
  }

  console.log('\n🧪 Testing Update Category...');
  
  try {
    const input = {
      name: 'Updated Test Category ' + Date.now(),
      description: 'Updated description for testing',
      isActive: false,
      sortOrder: 5
    };

    const result = await client.mutate({
      mutation: UPDATE_CATEGORY,
      variables: { id: categoryId, input }
    });

    const response = result.data.updateCategory;
    
    if (response.success) {
      console.log('✅ Update Category: SUCCESS');
      console.log(`   ID: ${response.data.id}`);
      console.log(`   Updated Name: ${response.data.entity.name}`);
      console.log(`   Changes: ${response.data.changes.join(', ')}`);
      console.log(`   Code: ${response.code}`);
      console.log(`   Duration: ${response.metadata.duration}ms`);
    } else {
      console.log('❌ Update Category: FAILED');
      console.log(`   Error: ${response.message}`);
    }
  } catch (error) {
    console.log('❌ Update Category: ERROR');
    console.log(`   ${error.message}`);
  }
}

async function testDeleteCategory(categoryId) {
  if (!categoryId) {
    console.log('⏭️  Skipping Delete Category (no category ID)');
    return;
  }

  console.log('\n🧪 Testing Delete Category...');
  
  try {
    const result = await client.mutate({
      mutation: DELETE_CATEGORY,
      variables: { id: categoryId }
    });

    const response = result.data.deleteCategory;
    
    if (response.success) {
      console.log('✅ Delete Category: SUCCESS');
      console.log(`   ID: ${response.data.id}`);
      console.log(`   Soft Delete: ${response.data.softDelete}`);
      console.log(`   Deleted At: ${response.data.deletedAt}`);
      console.log(`   Code: ${response.code}`);
      console.log(`   Duration: ${response.metadata.duration}ms`);
    } else {
      console.log('❌ Delete Category: FAILED');
      console.log(`   Error: ${response.message}`);
    }
  } catch (error) {
    console.log('❌ Delete Category: ERROR');
    console.log(`   ${error.message}`);
  }
}

async function testGetCategories() {
  console.log('\n🧪 Testing Get Categories...');
  
  try {
    const result = await client.query({
      query: GET_CATEGORIES
    });

    const response = result.data.categories;
    
    if (response.success) {
      console.log('✅ Get Categories: SUCCESS');
      console.log(`   Total Categories: ${response.data.pagination.total}`);
      console.log(`   Items Returned: ${response.data.items.length}`);
      console.log(`   Code: ${response.code}`);
      console.log(`   Duration: ${response.metadata.duration}ms`);
      
      if (response.data.items.length > 0) {
        console.log('   Sample Categories:');
        response.data.items.slice(0, 3).forEach((cat, index) => {
          console.log(`     ${index + 1}. ${cat.name} (${cat.slug}) - Active: ${cat.isActive}`);
        });
      }
    } else {
      console.log('❌ Get Categories: FAILED');
      console.log(`   Error: ${response.message}`);
    }
  } catch (error) {
    console.log('❌ Get Categories: ERROR');
    console.log(`   ${error.message}`);
  }
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🚀 Starting Category Mutations Test Suite');
  console.log('==========================================');
  console.log(`📡 GraphQL Endpoint: ${GRAPHQL_ENDPOINT}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);

  try {
    // Test sequence
    const categoryId = await testCreateCategory();
    await testUpdateCategory(categoryId);
    await testDeleteCategory(categoryId);
    await testGetCategories();

    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.log('\n💥 Test suite failed with error:');
    console.log(`   ${error.message}`);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testCreateCategory,
  testUpdateCategory,
  testDeleteCategory,
  testGetCategories,
  runTests
};
