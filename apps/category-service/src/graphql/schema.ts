import { gql } from 'graphql-tag';

export const typeDefs = gql`
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

  scalar DateTime

  type Category @key(fields: "id") {
    id: ID!
    name: String!
    description: String
    slug: String!
    image: String
    isActive: Boolean!
    sortOrder: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
    parentCategoryId: ID
    parent: Category
    children: [Category!]!
  }

  type ResponseMetadata @shareable {
    requestId: String
    traceId: String
    duration: Int
    timestamp: String!
  }

  input PaginationInput {
    limit: Int = 10
    offset: Int = 0
  }

  input CategoryFilterInput {
    isActive: Boolean
    search: String
  }

  type GetCategoriesResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: GetCategoriesData
    metadata: ResponseMetadata
  }

  type GetCategoriesData {
    items: [Category!]!
    pagination: CategoryPaginationInfo!
  }

  type CategoryPaginationInfo {
    total: Int!
    limit: Int!
    offset: Int!
    hasMore: Boolean!
    currentPage: Int!
    totalPages: Int!
  }

  type GetCategoryResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: Category
    metadata: ResponseMetadata
  }

  input CreateCategoryInput {
    name: String!
    description: String
    slug: String
    image: String
    isActive: Boolean
    sortOrder: Int
    parentCategoryId: ID
  }

  input UpdateCategoryInput {
    name: String
    description: String
    slug: String
    image: String
    isActive: Boolean
    sortOrder: Int
    parentCategoryId: ID
  }

  type CreateCategoryResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: CreateCategoryData
    metadata: ResponseMetadata
  }

  type CreateCategoryData {
    entity: Category!
    id: ID!
    createdAt: String!
  }

  type UpdateCategoryResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: UpdateCategoryData
    metadata: ResponseMetadata
  }

  type UpdateCategoryData {
    entity: Category!
    id: ID!
    updatedAt: String!
    changes: [String!]!
  }

  type DeleteCategoryResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: DeleteCategoryData
    metadata: ResponseMetadata
  }

  type DeleteCategoryData {
    id: ID!
    deletedAt: String!
    softDelete: Boolean!
  }

  type Query {
    categories(filters: CategoryFilterInput, pagination: PaginationInput): GetCategoriesResponse!
    category(id: ID!): GetCategoryResponse!
    categoryBySlug(slug: String!): GetCategoryResponse!
  }

  type Mutation {
    createCategory(input: CreateCategoryInput!): CreateCategoryResponse!
    updateCategory(id: ID!, input: UpdateCategoryInput!): UpdateCategoryResponse!
    deleteCategory(id: ID!): DeleteCategoryResponse!
  }
`;
