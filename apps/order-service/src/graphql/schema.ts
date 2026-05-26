import gql from 'graphql-tag';

export const typeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

  scalar Decimal
  scalar DateTime
  scalar JSON

  enum OrderStatus {
    pending
    confirmed
    processing
    shipped
    delivered
    cancelled
    refunded
  }

  type Order @key(fields: "id") {
    id: ID!
    userId: ID!
    orderNumber: String!
    customerEmail: String!
    customerName: String!
    status: OrderStatus!
    subtotal: Decimal!
    taxAmount: Decimal!
    shippingAmount: Decimal!
    discountAmount: Decimal!
    totalAmount: Decimal!
    currency: String!
    shippingAddressId: String
    notes: String
    createdAt: DateTime!
    updatedAt: DateTime!
    deliveredAt: DateTime
    items: [OrderItem!]!
    shippingAddress: ShippingAddress
    user: User
  }

  type OrderItem @key(fields: "id") {
    id: ID!
    orderId: ID!
    productId: ID!
    quantity: Int!
    price: Decimal!
    createdAt: DateTime!
    order: Order
    product: Product
  }

  type ShippingAddress {
    id: ID!
    street: String!
    city: String!
    state: String!
    zipCode: String!
    country: String!
  }

  type OrderStats @shareable {
    totalOrders: Int!
    pendingOrders: Int!
    processingOrders: Int!
    shippedOrders: Int!
    deliveredOrders: Int!
    cancelledOrders: Int!
    totalRevenue: Decimal!
    averageOrderValue: Decimal!
  }

  type PaginatedOrders {
    orders: [Order!]!
    total: Int!
    hasMore: Boolean!
  }

  # External federation stubs
  type User @key(fields: "id") {
    id: ID!
  }

  type Product @key(fields: "id") {
    id: ID!
  }

  input CreateOrderItemInput {
    productId: ID!
    quantity: Int!
    size: String!
    color: String!
  }

  input CreateOrderAddressInput {
    street: String!
    city: String!
    state: String!
    zipCode: String!
    country: String
  }

  input CreateOrderInput {
    customerEmail: String!
    customerName: String!
    customerPhone: String
    items: [CreateOrderItemInput!]!
    shippingAddress: CreateOrderAddressInput!
  }

  input UpdateOrderInput {
    status: OrderStatus
    customerEmail: String
    customerName: String
    customerPhone: String
  }

  input OrderFilterInput {
    status: OrderStatus
    customerEmail: String
    userId: ID
    orderNumber: String
    startDate: DateTime
    endDate: DateTime
  }

  input PaginationInput {
    limit: Int
    offset: Int
  }

  type Query {
    orders(filter: OrderFilterInput, pagination: PaginationInput): PaginatedOrders!
    order(id: ID!): Order
    orderStats: OrderStats!
    ordersByStatus(status: OrderStatus!): [Order!]!
  }

  type Mutation {
    createOrder(input: CreateOrderInput!): Order!
    updateOrder(id: ID!, input: UpdateOrderInput!): Order!
    updateOrderStatus(id: ID!, status: OrderStatus!): Order!
    deleteOrder(id: ID!): Boolean!
    bulkUpdateOrderStatus(orders: [ID!]!, status: OrderStatus!): [Order!]!
  }
`;
