import gql from 'graphql-tag';

export const typeDefs = gql`
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

  scalar Decimal
  scalar DateTime
  scalar JSON

  # ── Enums ─────────────────────────────────────────────────────────────────

  """
  SUNAT Catálogo 07 (simplified) — tax affectation type.
  gravado: IGV applies at 18% (standard).
  exonerado: Exempt from IGV; invoice is still issued.
  inafecto: Outside IGV scope; no IGV on invoice.
  """
  enum TaxAffectation {
    gravado
    exonerado
    inafecto
  }

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
    # ── Billing / SUNAT snapshot (nullable — provided by FE at checkout) ──────
    billingDocumentType: String
    billingDocumentNumber: String
    billingLegalName: String
    billingFirstName: String
    billingLastName: String
    billingAddressId: String
    # ── IGV accumulators (Ronda 2) ────────────────────────────────────────────
    # All amounts are Decimal (PEN, 2 dp). Historic orders have 0 for all fields.
    # taxableAmount: sum of igvBase for 'gravado' lines (base imponible total).
    # exemptAmount: sum of lineTotals for 'exonerado' lines.
    # nonTaxableAmount: sum of lineTotals for 'inafecto' lines.
    # igvAmount: total IGV charged on this order (= taxableAmount × igvRate).
    taxableAmount: Decimal!
    exemptAmount: Decimal!
    nonTaxableAmount: Decimal!
    igvAmount: Decimal!
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
    # ── Fiscal snapshot per line (Ronda 2) ────────────────────────────────────
    # Immutable once written at order creation. Never updated.
    taxAffectation: TaxAffectation!
    """Base imponible for this line (excl. IGV). Equals lineTotal for exonerado/inafecto."""
    igvBase: Decimal
    """IGV amount for this line. 0 for exonerado/inafecto lines."""
    igvAmount: Decimal
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
    """
    Orders belonging to this user.
    Resolved by order-service when the gateway composes the User entity.
    Requires authentication — unauthenticated callers receive an empty list.
    Pagination: limit 1..100, offset >= 0.
    """
    orders(limit: Int, offset: Int): [Order!]!
  }

  type Product @key(fields: "id") {
    id: ID!
  }

  # ── Input types ────────────────────────────────────────────────────────────

  """
  Fiscal/billing data for SUNAT comprobante generation.
  Supplied by the FE at checkout and frozen (immutable) once the order is confirmed.
  documentType: 'dni' | 'ruc' | 'passport' | 'ce'
  legalName is required when documentType is 'ruc' (razón social).
  """
  input BillingDataInput {
    documentType: String!
    documentNumber: String!
    legalName: String
    firstName: String
    lastName: String
    addressId: String
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
    # customerEmail is derived from the authenticated JWT — not accepted from client input.
    customerName: String!
    customerPhone: String
    items: [CreateOrderItemInput!]!
    shippingAddress: CreateOrderAddressInput!
    """
    Optional SUNAT billing snapshot. When provided, frozen at creation and immutable
    once the order reaches 'confirmed'. When absent, all billing fields are null.
    """
    billingData: BillingDataInput
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

  input UpdateCarrierInput {
    name: String
    code: String
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

  input UpdateShippingZoneInput {
    name: String
    countries: [String!]
    states: [String!]
    cities: [String!]
    postalCodes: [String!]
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

  input UpdateShippingRateInput {
    name: String
    minWeight: Decimal
    maxWeight: Decimal
    price: Decimal
    isActive: Boolean
  }

  input CreateDeliverySlotInput {
    dayOfWeek: Int!
    startTime: String!
    endTime: String!
    maxOrders: Int!
    isActive: Boolean
  }

  input UpdateDeliverySlotInput {
    dayOfWeek: Int
    startTime: String
    endTime: String
    maxOrders: Int
    isActive: Boolean
  }

  input CreateTaxRateInput {
    name: String!
    rate: Decimal!
    country: String
    state: String
    city: String
    isActive: Boolean
  }

  input UpdateTaxRateInput {
    name: String
    rate: Decimal
    country: String
    state: String
    city: String
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
    deleteOrder(id: ID!): SuccessResponse!
    bulkUpdateOrderStatus(orders: [ID!]!, status: OrderStatus!): [Order!]!

    # Payment methods
    createPaymentMethod(input: CreatePaymentMethodInput!): PaymentMethod!
    updatePaymentMethod(id: ID!, input: UpdatePaymentMethodInput!): PaymentMethod!
    deletePaymentMethod(id: ID!): SuccessResponse!

    # Coupons
    createCoupon(input: CreateCouponInput!): Coupon!
    updateCoupon(id: ID!, input: UpdateCouponInput!): Coupon!
    deleteCoupon(id: ID!): SuccessResponse!

    # Carriers
    createCarrier(input: CreateCarrierInput!): Carrier!
    updateCarrier(id: ID!, input: UpdateCarrierInput!): Carrier!
    deleteCarrier(id: ID!): SuccessResponse!

    # Shipping zones
    createShippingZone(input: CreateShippingZoneInput!): ShippingZone!
    updateShippingZone(id: ID!, input: UpdateShippingZoneInput!): ShippingZone!
    deleteShippingZone(id: ID!): SuccessResponse!

    # Shipping rates
    createShippingRate(input: CreateShippingRateInput!): ShippingRate!
    updateShippingRate(id: ID!, input: UpdateShippingRateInput!): ShippingRate!
    deleteShippingRate(id: ID!): SuccessResponse!

    # Delivery slots
    createDeliverySlot(input: CreateDeliverySlotInput!): DeliverySlot!
    updateDeliverySlot(id: ID!, input: UpdateDeliverySlotInput!): DeliverySlot!
    deleteDeliverySlot(id: ID!): SuccessResponse!

    # Tax rates
    createTaxRate(input: CreateTaxRateInput!): TaxRate!
    updateTaxRate(id: ID!, input: UpdateTaxRateInput!): TaxRate!
    deleteTaxRate(id: ID!): SuccessResponse!

    # Shopping cart — userId is always derived from the authenticated JWT, never from input.
    addToCart(productId: ID!, quantity: Int!): ShoppingCartItem!
    updateCartItem(id: ID!, quantity: Int!): ShoppingCartItem!
    removeFromCart(id: ID!): SuccessResponse!
    clearUserCart: SuccessResponse!
  }
`;
