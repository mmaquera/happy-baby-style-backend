import gql from 'graphql-tag';

export const typeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

  scalar DateTime
  scalar JSON

  # Product is owned by product-service
  type Product @key(fields: "id") {
    id: ID!
    categoryId: ID
    name: String!
    description: String
    price: Float!
    salePrice: Float
    sku: String!
    images: [String!]!
    attributes: JSON!
    isActive: Boolean!
    stockQuantity: Int!
    tags: [String!]!
    rating: Float
    reviewCount: Int!
    createdAt: DateTime!
    updatedAt: DateTime!

    # Computed fields
    currentPrice: Float!
    hasDiscount: Boolean!
    discountPercentage: Int!
    totalStock: Int!
    isInStock: Boolean!

    # Cross-domain: Category is owned by category-service (resolved via federation)
    category: Category
    variants: [ProductVariant!]!
  }

  # External entity — owned by category-service
  type Category @key(fields: "id") {
    id: ID!
  }

  type ProductVariant {
    id: ID!
    productId: ID!
    name: String!
    price: Float!
    sku: String!
    stockQuantity: Int!
    attributes: JSON!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    isInStock: Boolean!
    product: Product!
  }

  # =====================================================
  # INPUT TYPES
  # =====================================================

  input CreateProductInput {
    categoryId: ID
    name: String!
    description: String
    price: Float!
    salePrice: Float
    sku: String!
    images: [String!]
    attributes: JSON
    isActive: Boolean
    stockQuantity: Int
    tags: [String!]
  }

  input UpdateProductInput {
    categoryId: ID
    name: String
    description: String
    price: Float
    salePrice: Float
    sku: String
    images: [String!]
    attributes: JSON
    isActive: Boolean
    stockQuantity: Int
    tags: [String!]
  }

  input CreateProductVariantInput {
    productId: ID!
    name: String!
    price: Float!
    sku: String!
    stockQuantity: Int!
    attributes: JSON
    isActive: Boolean
  }

  input UpdateProductVariantInput {
    name: String
    price: Float
    sku: String
    stockQuantity: Int
    attributes: JSON
    isActive: Boolean
  }

  input ProductFilterInput {
    categoryId: ID
    isActive: Boolean
    minPrice: Float
    maxPrice: Float
    inStock: Boolean
    search: String
    tags: [String!]
    rating: Int
  }

  input PaginationInput {
    limit: Int = 10
    offset: Int = 0
  }

  # =====================================================
  # RESPONSE TYPES
  # =====================================================

  type ResponseMetadata @shareable {
    requestId: String
    traceId: String
    duration: Int
    timestamp: String!
  }

  type GetProductsResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: GetProductsData
    metadata: ResponseMetadata
  }

  type GetProductsData {
    items: [Product!]!
    pagination: ProductPaginationInfo!
  }

  type ProductPaginationInfo {
    total: Int!
    limit: Int!
    offset: Int!
    hasMore: Boolean!
    currentPage: Int!
    totalPages: Int!
  }

  type GetProductResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: GetProductData
    metadata: ResponseMetadata
  }

  type GetProductData {
    entity: Product!
  }

  type CreateProductResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: CreateProductData
    metadata: ResponseMetadata
  }

  type CreateProductData {
    entity: Product!
    id: ID!
    createdAt: String!
  }

  type UpdateProductResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: UpdateProductData
    metadata: ResponseMetadata
  }

  type UpdateProductData {
    entity: Product!
    id: ID!
    updatedAt: String!
    changes: [String!]!
  }

  type DeleteProductResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: DeleteProductData
    metadata: ResponseMetadata
  }

  type DeleteProductData {
    id: ID!
    deletedAt: String!
    softDelete: Boolean!
  }

  type PaginatedProducts {
    products: [Product!]!
    total: Int!
    hasMore: Boolean!
  }

  type ProductStats {
    totalProducts: Int!
    activeProducts: Int!
  }

  type ProductStatsResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: ProductStats!
    metadata: ResponseMetadata
  }

  type SuccessResponse @shareable {
    success: Boolean!
    message: String!
  }

  # =====================================================
  # QUERIES
  # =====================================================

  type Query {
    products(filter: ProductFilterInput, pagination: PaginationInput): GetProductsResponse!
    product(id: ID!): GetProductResponse!
    productBySku(sku: String!): GetProductResponse!
    productsByCategory(categoryId: ID!, pagination: PaginationInput): PaginatedProducts!
    searchProducts(query: String!, filter: ProductFilterInput, pagination: PaginationInput): PaginatedProducts!
    productVariants(productId: ID!): [ProductVariant!]!
    productVariant(id: ID!): ProductVariant
    productStats: ProductStatsResponse!
    lowStockProducts: [Product!]!
    outOfStockProducts: [Product!]!
  }

  # =====================================================
  # MUTATIONS
  # =====================================================

  type Mutation {
    createProduct(input: CreateProductInput!): CreateProductResponse!
    updateProduct(id: ID!, input: UpdateProductInput!): UpdateProductResponse!
    deleteProduct(id: ID!): DeleteProductResponse!
    createProductVariant(input: CreateProductVariantInput!): ProductVariant!
    updateProductVariant(id: ID!, input: UpdateProductVariantInput!): ProductVariant!
    deleteProductVariant(id: ID!): SuccessResponse!
    bulkUpdateProducts(ids: [ID!]!, input: UpdateProductInput!): [Product!]!
  }
`;
