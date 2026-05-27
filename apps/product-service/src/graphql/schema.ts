import gql from 'graphql-tag';

export const typeDefs = gql`
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

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

  # External entity — owned by user-service
  type UserProfile @key(fields: "id") {
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
    lowStockCount: Int!
    outOfStockCount: Int!
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

  # ── Inventory & stock types ────────────────────────────────────────────────

  enum InventoryTransactionType {
    purchase
    sale
    return
    adjustment
    transfer
  }

  enum StockAlertType {
    low_stock
    out_of_stock
    overstock
  }

  type InventoryTransaction {
    id: ID!
    productId: ID!
    type: InventoryTransactionType!
    quantity: Int!
    reference: String
    notes: String
    createdAt: DateTime!
  }

  type StockAlert {
    id: ID!
    productId: ID!
    type: StockAlertType!
    threshold: Int!
    currentStock: Int!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  input CreateInventoryTransactionInput {
    productId: ID!
    type: InventoryTransactionType!
    quantity: Int!
    reference: String
    notes: String
  }

  input CreateStockAlertInput {
    productId: ID!
    type: StockAlertType!
    threshold: Int!
    currentStock: Int!
    isActive: Boolean
  }

  # ── Review types ─────────────────────────────────────────────────────────────

  type ProductReview {
    id: ID!
    productId: ID!
    userId: ID!
    rating: Int!
    title: String
    comment: String
    isApproved: Boolean!
    isVerified: Boolean!
    helpfulCount: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
    product: Product!
    user: UserProfile!
    photos: [ReviewPhoto!]!
    votes: [ReviewVote!]!
  }

  type ReviewPhoto {
    id: ID!
    reviewId: ID!
    imageUrl: String!
    caption: String
    sortOrder: Int!
    createdAt: DateTime!
    review: ProductReview!
  }

  type ReviewVote {
    id: ID!
    reviewId: ID!
    userId: ID!
    isHelpful: Boolean!
    createdAt: DateTime!
    review: ProductReview!
    user: UserProfile!
  }

  type PaginatedReviews {
    reviews: [ProductReview!]!
    total: Int!
    hasMore: Boolean!
  }

  input CreateProductReviewInput {
    productId: ID!
    userId: ID!
    rating: Int!
    title: String
    comment: String
  }

  input UpdateProductReviewInput {
    rating: Int
    title: String
    comment: String
    isApproved: Boolean
  }

  input CreateReviewVoteInput {
    reviewId: ID!
    userId: ID!
    isHelpful: Boolean!
  }

  type Query {
    products(filter: ProductFilterInput, pagination: PaginationInput): GetProductsResponse!
    product(id: ID!): GetProductResponse!
    productBySku(sku: String!): GetProductResponse!
    productsByCategory(categoryId: ID!, pagination: PaginationInput): PaginatedProducts!
    searchProducts(
      query: String!
      filter: ProductFilterInput
      pagination: PaginationInput
    ): PaginatedProducts!
    productVariants(productId: ID!): [ProductVariant!]!
    productVariant(id: ID!): ProductVariant
    productStats: ProductStatsResponse!
    lowStockProducts: [Product!]!
    outOfStockProducts: [Product!]!
    inventoryTransactions(productId: ID!): [InventoryTransaction!]!
    stockAlerts: [StockAlert!]!

    # Reviews
    productReviews(productId: ID!, pagination: PaginationInput): PaginatedReviews!
    userReviews(userId: ID!): [ProductReview!]!
    review(id: ID!): ProductReview
    reviewVotes(reviewId: ID!): [ReviewVote!]!
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
    createInventoryTransaction(input: CreateInventoryTransactionInput!): InventoryTransaction!
    createStockAlert(input: CreateStockAlertInput!): StockAlert!
    updateStockAlert(id: ID!, isActive: Boolean!): StockAlert!
    deleteStockAlert(id: ID!): SuccessResponse!

    # Reviews
    createProductReview(input: CreateProductReviewInput!): ProductReview!
    updateProductReview(id: ID!, input: UpdateProductReviewInput!): ProductReview!
    deleteProductReview(id: ID!): SuccessResponse!
    approveReview(id: ID!): ProductReview!
    createReviewVote(input: CreateReviewVoteInput!): ReviewVote!
    deleteReviewVote(reviewId: ID!, userId: ID!): SuccessResponse!
  }
`;
