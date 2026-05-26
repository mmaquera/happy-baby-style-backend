import gql from 'graphql-tag';

export const typeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

  # =====================================================
  # ENUMS
  # =====================================================
  
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

  enum NotificationType {
    order_status
    payment
    shipping
    marketing
    system
  }

  enum RewardPointType {
    earned
    redeemed
    expired
    bonus
  }

  # =====================================================
  # SCALARS
  # =====================================================
  
  scalar DateTime
  scalar Decimal
  scalar JSON

  # =====================================================
  # USER TYPES — owned by user-service (Federation stubs)
  # =====================================================

  type User @key(fields: "id") {
    id: ID!
  }

  type UserProfile @key(fields: "id") {
    id: ID!
  }

  type UserAddress @key(fields: "id") {
    id: ID!
  }

  # =====================================================
  # PRODUCT CATALOG TYPES
  # =====================================================

  # Category is owned by category-service (Federation)
  type Category @key(fields: "id") {
    id: ID!
  }

  # Product is owned by product-service (Federation)
  type Product @key(fields: "id") {
    id: ID!
  }

  # =====================================================
  # SHOPPING & CART TYPES
  # =====================================================

  type ShoppingCart {
    id: ID!
    userId: String
    sessionId: String
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Relations
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
    
    # Relations
    cart: ShoppingCart!
    product: Product!
  }

  type UserFavorite @shareable {
    id: ID!
    userId: ID!
    productId: ID!
    createdAt: DateTime!

    # Relations
    user: UserProfile!
    product: Product!
  }

  # Order types are owned by order-service (Federation)
  type Order @key(fields: "id") {
    id: ID!
  }

  type OrderItem @key(fields: "id") {
    id: ID!
  }

  # =====================================================
  # PAYMENT & FINANCIAL TYPES
  # =====================================================

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
    
    # Relations
    order: Order!
  }

  type SavedPaymentMethod {
    id: ID!
    userId: ID!
    type: PaymentMethodType!
    provider: String!
    lastFour: String
    expiryMonth: Int
    expiryYear: Int
    cardholderName: String
    isDefault: Boolean!
    isActive: Boolean!
    metadata: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Relations
    user: UserProfile!
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
    
    # Relations
    order: Order!
    user: UserProfile!
  }

  # =====================================================
  # MARKETING & PROMOTIONS TYPES
  # =====================================================

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
    
    # Relations
    usage: [CouponUsage!]!
  }

  type CouponUsage {
    id: ID!
    couponId: ID!
    userId: ID!
    orderId: ID!
    discountAmount: Decimal!
    usedAt: DateTime!
    
    # Relations
    coupon: Coupon!
    user: UserProfile!
    order: Order!
  }

  # =====================================================
  # REVIEWS & RATINGS TYPES
  # =====================================================

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
    
    # Relations
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
    
    # Relations
    review: ProductReview!
  }

  type ReviewVote {
    id: ID!
    reviewId: ID!
    userId: ID!
    isHelpful: Boolean!
    createdAt: DateTime!
    
    # Relations
    review: ProductReview!
    user: UserProfile!
  }

  # =====================================================
  # INVENTORY & STOCK TYPES
  # =====================================================

  type InventoryTransaction {
    id: ID!
    productId: ID!
    type: InventoryTransactionType!
    quantity: Int!
    reference: String
    notes: String
    createdAt: DateTime!
    
    # Relations
    product: Product!
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
    
    # Relations
    product: Product!
  }

  # =====================================================
  # SHIPPING & LOGISTICS TYPES
  # =====================================================

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
    
    # Relations
    rates: [ShippingRate!]!
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
    
    # Relations
    zone: ShippingZone!
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

  # =====================================================
  # LOYALTY & REWARDS TYPES
  # =====================================================

  type LoyaltyProgram {
    id: ID!
    name: String!
    description: String
    pointsPerDollar: Decimal!
    redemptionRate: Decimal!
    expiryMonths: Int!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type RewardPoint {
    id: ID!
    userId: ID!
    points: Int!
    type: RewardPointType!
    expiresAt: DateTime
    createdAt: DateTime!
    
    # Relations
    user: UserProfile!
  }

  # =====================================================
  # NOTIFICATIONS & COMMUNICATIONS TYPES
  # =====================================================

  type PushNotification {
    id: ID!
    userId: ID!
    title: String!
    body: String!
    type: NotificationType!
    data: JSON!
    isRead: Boolean!
    readAt: DateTime
    sentAt: DateTime
    deliveredAt: DateTime
    failedAt: DateTime
    errorMessage: String
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Relations
    user: UserProfile!
  }

  type NotificationTemplate {
    id: ID!
    name: String!
    type: NotificationType!
    title: String!
    body: String!
    variables: [String!]!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type EmailTemplate {
    id: ID!
    name: String!
    subject: String!
    body: String!
    variables: [String!]!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type NewsletterSubscription {
    id: ID!
    email: String!
    userId: String
    isActive: Boolean!
    subscribedAt: DateTime!
    unsubscribedAt: DateTime
    
    # Relations
    user: UserProfile
  }

  # =====================================================
  # ANALYTICS & TRACKING TYPES
  # =====================================================

  type AppEvent {
    id: ID!
    userId: String
    sessionId: String
    eventType: String!
    eventData: JSON
    productId: String
    categoryId: String
    deviceInfo: JSON
    location: JSON
    userAgent: String
    ipAddress: String
    createdAt: DateTime!
    
    # Relations
    user: UserProfile
    product: Product
  }

  # =====================================================
  # CONFIGURATION & SETTINGS TYPES
  # =====================================================

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

  type Image @key(fields: "id") {
    id: ID!
  }

  type Svg @key(fields: "id") {
    id: ID!
  }

  # =====================================================
  # INPUT TYPES
  # =====================================================

  # Payment Inputs
  input CreateSavedPaymentMethodInput {
    userId: ID!
    type: PaymentMethodType!
    provider: String!
    lastFour: String
    expiryMonth: Int
    expiryYear: Int
    cardholderName: String
    isDefault: Boolean
    metadata: JSON
  }

  input UpdateSavedPaymentMethodInput {
    isDefault: Boolean
    isActive: Boolean
    metadata: JSON
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

  # Coupon Inputs
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

  # Review Inputs
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

  # Inventory Inputs
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

  # Shipping Inputs
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

  # Notification Inputs
  input CreatePushNotificationInput {
    userId: ID!
    title: String!
    body: String!
    type: NotificationType!
    data: JSON
  }

  input CreateNotificationTemplateInput {
    name: String!
    type: NotificationType!
    title: String!
    body: String!
    variables: [String!]!
    isActive: Boolean
  }

  # Filter and Pagination Inputs
  input PaginationInput {
    limit: Int = 10
    offset: Int = 0
  }

  # =====================================================
  # RESPONSE TYPES
  # =====================================================

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

  type OrderStatsResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: OrderStats!
    metadata: ResponseMetadata
  }


  type PaginatedReviews {
    reviews: [ProductReview!]!
    total: Int!
    hasMore: Boolean!
  }

  # Base Response Types for Standardized API Responses
  type BaseResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    metadata: ResponseMetadata
  }

  type ResponseMetadata @shareable {
    requestId: String
    traceId: String
    duration: Int
    timestamp: String!
  }

  type SuccessResponse @shareable {
    success: Boolean!
    message: String!
  }

  # Analytics Response Types
  type DashboardMetrics {
    totalUsers: Int!
    totalProducts: Int!
    totalOrders: Int!
    totalRevenue: Decimal!
    todayOrders: Int!
    todayRevenue: Decimal!
    pendingOrders: Int!
    lowStockProducts: Int!
    activeCoupons: Int!
  }

  type OrderAnalytics {
    totalOrders: Int!
    totalRevenue: Decimal!
    averageOrderValue: Decimal!
    ordersByStatus: JSON!
    revenueByMonth: JSON!
    topCustomers: [UserProfile!]!
  }


  # =====================================================
  # QUERIES
  # =====================================================

  type Query {
    # Health check
    health: String! @shareable

    # Dashboard & Analytics
    dashboardMetrics: DashboardMetrics!
    orderAnalytics: OrderAnalytics!

    # Shopping cart queries
    userCart(userId: ID!): [ShoppingCart!]!
    cartItem(id: ID!): ShoppingCart
    
    # User favorites queries
    userFavorites(userId: ID!): [UserFavorite!]!
    isProductFavorited(userId: ID!, productId: ID!): Boolean!
    
    # Payment queries
    userPaymentMethods(userId: ID!): [PaymentMethod!]!
    savedPaymentMethods(userId: ID!): [SavedPaymentMethod!]!
    paymentMethod(id: ID!): PaymentMethod
    
    # Transaction queries
    userTransactions(userId: ID!): [Transaction!]!
    transaction(id: ID!): Transaction
    
    # Coupon queries
    coupons: [Coupon!]!
    coupon(id: ID!): Coupon
    couponByCode(code: String!): Coupon
    activeCoupons: [Coupon!]!
    userCouponUsage(userId: ID!): [CouponUsage!]!
    
    # Review queries
    productReviews(productId: ID!, pagination: PaginationInput): PaginatedReviews!
    userReviews(userId: ID!): [ProductReview!]!
    review(id: ID!): ProductReview
    reviewVotes(reviewId: ID!): [ReviewVote!]!
    
    # Inventory queries
    inventoryTransactions(productId: ID!): [InventoryTransaction!]!
    stockAlerts: [StockAlert!]!
    
    # Shipping queries
    carriers: [Carrier!]!
    carrier(id: ID!): Carrier
    shippingZones: [ShippingZone!]!
    shippingZone(id: ID!): ShippingZone
    shippingRates(zoneId: ID!): [ShippingRate!]!
    deliverySlots: [DeliverySlot!]!
    
    # Loyalty queries
    loyaltyPrograms: [LoyaltyProgram!]!
    userRewardPoints(userId: ID!): [RewardPoint!]!
    userRewardBalance(userId: ID!): Int!
    
    # Notification queries
    userNotifications(userId: ID!): [PushNotification!]!
    unreadNotifications(userId: ID!): [PushNotification!]!
    notificationTemplates: [NotificationTemplate!]!
    emailTemplates: [EmailTemplate!]!
    
    # Newsletter queries
    newsletterSubscriptions: [NewsletterSubscription!]!
    isSubscribedToNewsletter(email: String!): Boolean!
    
    # Analytics & Tracking queries
    userAppEvents(userId: ID!): [AppEvent!]!
    productAppEvents(productId: ID!): [AppEvent!]!

    # Configuration queries
    storeSettings: [StoreSettings!]!
    storeSetting(key: String!): StoreSettings
    taxRates: [TaxRate!]!
    taxRate(id: ID!): TaxRate
    
    # Image queries
    images(entityType: String, entityId: String): [Image!]!
  }

  # =====================================================
  # MUTATIONS
  # =====================================================

  type Mutation {
    # Shopping cart mutations
    addToCart(userId: ID!, productId: ID!, quantity: Int!): ShoppingCartItem!
    updateCartItem(id: ID!, quantity: Int!): ShoppingCartItem!
    removeFromCart(id: ID!): SuccessResponse!
    clearUserCart(userId: ID!): SuccessResponse!
    
    # User favorites mutations
    addToFavorites(userId: ID!, productId: ID!): UserFavorite!
    removeFromFavorites(userId: ID!, productId: ID!): SuccessResponse!
    toggleFavorite(userId: ID!, productId: ID!): UserFavorite!
    
    # Payment mutations
    createSavedPaymentMethod(input: CreateSavedPaymentMethodInput!): SavedPaymentMethod!
    updateSavedPaymentMethod(id: ID!, input: UpdateSavedPaymentMethodInput!): SavedPaymentMethod!
    deleteSavedPaymentMethod(id: ID!): SuccessResponse!
    createPaymentMethod(input: CreatePaymentMethodInput!): PaymentMethod!
    updatePaymentMethod(id: ID!, input: UpdatePaymentMethodInput!): PaymentMethod!
    deletePaymentMethod(id: ID!): SuccessResponse!
    
    # Coupon mutations
    createCoupon(input: CreateCouponInput!): Coupon!
    updateCoupon(id: ID!, input: UpdateCouponInput!): Coupon!
    deleteCoupon(id: ID!): SuccessResponse!
    # Review mutations
    createProductReview(input: CreateProductReviewInput!): ProductReview!
    updateProductReview(id: ID!, input: UpdateProductReviewInput!): ProductReview!
    deleteProductReview(id: ID!): SuccessResponse!
    approveReview(id: ID!): ProductReview!
    createReviewVote(input: CreateReviewVoteInput!): ReviewVote!
    deleteReviewVote(reviewId: ID!, userId: ID!): SuccessResponse!
    
    # Inventory mutations
    createInventoryTransaction(input: CreateInventoryTransactionInput!): InventoryTransaction!
    createStockAlert(input: CreateStockAlertInput!): StockAlert!
    updateStockAlert(id: ID!, isActive: Boolean!): StockAlert!
    deleteStockAlert(id: ID!): SuccessResponse!
    
    # Shipping mutations
    createCarrier(input: CreateCarrierInput!): Carrier!
    updateCarrier(id: ID!, name: String, code: String, trackingUrlTemplate: String, isActive: Boolean): Carrier!
    deleteCarrier(id: ID!): SuccessResponse!
    createShippingZone(input: CreateShippingZoneInput!): ShippingZone!
    createShippingRate(input: CreateShippingRateInput!): ShippingRate!
    
    # Notification mutations
    createPushNotification(input: CreatePushNotificationInput!): PushNotification!
    markNotificationAsRead(id: ID!): PushNotification!
    markAllNotificationsAsRead(userId: ID!): SuccessResponse!
    createNotificationTemplate(input: CreateNotificationTemplateInput!): NotificationTemplate!
    
    # Newsletter mutations
    subscribeToNewsletter(email: String!, userId: String): NewsletterSubscription!
    unsubscribeFromNewsletter(email: String!): SuccessResponse!
    
    # Bulk operations — bulkUpdateOrderStatus → migrated to order-service, user ops → migrated to user-service (Federation)
  }
`;