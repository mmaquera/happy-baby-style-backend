import gql from 'graphql-tag';

export const typeDefs = gql`
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

  scalar Decimal
  scalar DateTime
  scalar JSON

  # ── Enums ─────────────────────────────────────────────────────────────────

  enum OrderStatus {
    pending
    confirmed
    processing
    shipped
    delivered
    cancelled
    refunded
  }

  enum PaymentMethodType {
    credit_card
    debit_card
    paypal
    bank_transfer
    cash_on_delivery
  }

  enum TransactionType {
    payment
    refund
    chargeback
    adjustment
  }

  enum TransactionStatus {
    pending
    completed
    failed
    cancelled
    refunded
  }

  enum DiscountType {
    percentage
    fixed_amount
    free_shipping
  }

  # ── Core order types ───────────────────────────────────────────────────────

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

  type SuccessResponse @shareable {
    success: Boolean!
    message: String!
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
    todayOrders: Int!
    todayRevenue: Decimal!
    activeCoupons: Int!
  }

  type PaginatedOrders {
    orders: [Order!]!
    total: Int!
    hasMore: Boolean!
  }

  # ── Payment & transaction types ────────────────────────────────────────────

  type PaymentMethod {
    id: ID!
    orderId: ID!
    type: PaymentMethodType!
    amount: Decimal!
    status: String!
    transactionId: String
    metadata: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Transaction {
    id: ID!
    orderId: ID!
    userId: ID!
    type: TransactionType!
    amount: Decimal!
    currency: String!
    status: TransactionStatus!
    gateway: String
    gatewayTransactionId: String
    metadata: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # ── Coupon types ───────────────────────────────────────────────────────────

  type Coupon {
    id: ID!
    code: String!
    name: String!
    description: String
    discountType: DiscountType!
    discountValue: Decimal!
    minimumAmount: Decimal
    maximumDiscount: Decimal
    usageLimit: Int
    usedCount: Int!
    validFrom: DateTime!
    validUntil: DateTime!
    isActive: Boolean!
    isFirstTimeOnly: Boolean!
    applicableCategories: [String!]!
    applicableProducts: [String!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type CouponUsage {
    id: ID!
    couponId: ID!
    userId: ID!
    orderId: ID!
    discountAmount: Decimal!
    usedAt: DateTime!
  }

  # ── Shipping & logistics types ─────────────────────────────────────────────

  type Carrier {
    id: ID!
    name: String!
    code: String!
    trackingUrlTemplate: String
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ShippingZone {
    id: ID!
    name: String!
    countries: [String!]!
    states: [String!]!
    cities: [String!]!
    postalCodes: [String!]!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ShippingRate {
    id: ID!
    zoneId: ID!
    name: String!
    minWeight: Decimal
    maxWeight: Decimal
    price: Decimal!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type DeliverySlot {
    id: ID!
    dayOfWeek: Int!
    startTime: String!
    endTime: String!
    maxOrders: Int!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # ── Federation stubs ───────────────────────────────────────────────────────

  type User @key(fields: "id") {
    id: ID!
  }

  type Product @key(fields: "id") {
    id: ID!
  }

  # ── Input types ────────────────────────────────────────────────────────────

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
    # customerEmail is derived from the authenticated JWT — not accepted from client input.
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

  input CreateCouponInput {
    code: String!
    name: String!
    description: String
    discountType: DiscountType!
    discountValue: Decimal!
    minimumAmount: Decimal
    maximumDiscount: Decimal
    usageLimit: Int
    validFrom: DateTime!
    validUntil: DateTime!
    isActive: Boolean
    isFirstTimeOnly: Boolean
    applicableCategories: [String!]
    applicableProducts: [String!]
  }

  input UpdateCouponInput {
    name: String
    description: String
    discountValue: Decimal
    minimumAmount: Decimal
    maximumDiscount: Decimal
    usageLimit: Int
    validFrom: DateTime
    validUntil: DateTime
    isActive: Boolean
    isFirstTimeOnly: Boolean
    applicableCategories: [String!]
    applicableProducts: [String!]
  }

  input CreateCarrierInput {
    name: String!
    code: String!
    trackingUrlTemplate: String
    isActive: Boolean
  }

  input CreateShippingZoneInput {
    name: String!
    countries: [String!]!
    states: [String!]!
    cities: [String!]!
    postalCodes: [String!]!
    isActive: Boolean
  }

  input CreateShippingRateInput {
    zoneId: ID!
    name: String!
    minWeight: Decimal
    maxWeight: Decimal
    price: Decimal!
    isActive: Boolean
  }

  input CreatePaymentMethodInput {
    orderId: ID!
    type: PaymentMethodType!
    amount: Decimal!
    status: String!
    transactionId: String
    metadata: JSON
  }

  input UpdatePaymentMethodInput {
    type: PaymentMethodType
    amount: Decimal
    status: String
    transactionId: String
    metadata: JSON
  }

  # ── Shopping cart types ────────────────────────────────────────────────────

  type ShoppingCart {
    id: ID!
    userId: String
    sessionId: String
    createdAt: DateTime!
    updatedAt: DateTime!
    items: [ShoppingCartItem!]!
  }

  type ShoppingCartItem {
    id: ID!
    cartId: ID!
    productId: ID!
    quantity: Int!
    price: Decimal!
    createdAt: DateTime!
    updatedAt: DateTime!
    cart: ShoppingCart!
    product: Product!
  }

  # ── Store config types ─────────────────────────────────────────────────────

  type StoreSettings {
    id: ID!
    settingKey: String!
    settingValue: String!
    description: String
    category: String
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type TaxRate {
    id: ID!
    name: String!
    rate: Decimal!
    country: String
    state: String
    city: String
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # ── Queries ────────────────────────────────────────────────────────────────

  type Query {
    # Orders
    orders(filter: OrderFilterInput, pagination: PaginationInput): PaginatedOrders!
    order(id: ID!): Order
    orderStats: OrderStats!
    ordersByStatus(status: OrderStatus!): [Order!]!

    # Payment methods & transactions
    userPaymentMethods(userId: ID!): [PaymentMethod!]!
    paymentMethod(id: ID!): PaymentMethod
    userTransactions(userId: ID!): [Transaction!]!
    transaction(id: ID!): Transaction

    # Coupons
    coupons: [Coupon!]!
    coupon(id: ID!): Coupon
    couponByCode(code: String!): Coupon
    activeCoupons: [Coupon!]!
    userCouponUsage(userId: ID!): [CouponUsage!]!

    # Shipping & logistics
    carriers: [Carrier!]!
    carrier(id: ID!): Carrier
    shippingZones: [ShippingZone!]!
    shippingZone(id: ID!): ShippingZone
    shippingRates(zoneId: ID!): [ShippingRate!]!
    deliverySlots: [DeliverySlot!]!

    # Shopping cart
    userCart(userId: ID!): [ShoppingCart!]!
    cartItem(id: ID!): ShoppingCartItem

    # Store config
    storeSettings: [StoreSettings!]!
    storeSetting(key: String!): StoreSettings
    taxRates: [TaxRate!]!
    taxRate(id: ID!): TaxRate
  }

  # ── Mutations ──────────────────────────────────────────────────────────────

  type Mutation {
    # Orders
    createOrder(input: CreateOrderInput!): Order!
    updateOrder(id: ID!, input: UpdateOrderInput!): Order!
    updateOrderStatus(id: ID!, status: OrderStatus!): Order!
    deleteOrder(id: ID!): Boolean!
    bulkUpdateOrderStatus(orders: [ID!]!, status: OrderStatus!): [Order!]!

    # Payment methods
    createPaymentMethod(input: CreatePaymentMethodInput!): PaymentMethod!
    updatePaymentMethod(id: ID!, input: UpdatePaymentMethodInput!): PaymentMethod!
    deletePaymentMethod(id: ID!): Boolean!

    # Coupons
    createCoupon(input: CreateCouponInput!): Coupon!
    updateCoupon(id: ID!, input: UpdateCouponInput!): Coupon!
    deleteCoupon(id: ID!): Boolean!

    # Shipping
    createCarrier(input: CreateCarrierInput!): Carrier!
    updateCarrier(
      id: ID!
      name: String
      code: String
      trackingUrlTemplate: String
      isActive: Boolean
    ): Carrier!
    deleteCarrier(id: ID!): Boolean!
    createShippingZone(input: CreateShippingZoneInput!): ShippingZone!
    createShippingRate(input: CreateShippingRateInput!): ShippingRate!

    # Shopping cart — userId is always derived from the authenticated JWT, never from input.
    addToCart(productId: ID!, quantity: Int!): ShoppingCartItem!
    updateCartItem(id: ID!, quantity: Int!): ShoppingCartItem!
    removeFromCart(id: ID!): SuccessResponse!
    clearUserCart: SuccessResponse!
  }
`;
