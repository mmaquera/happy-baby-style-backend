import gql from 'graphql-tag';

export const typeDefs = gql`
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

  enum UserRole {
    admin
    customer
    staff
  }

  enum AuthProvider {
    email
    google
    facebook
    apple
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
  scalar Upload

  # =====================================================
  # CORE USER MANAGEMENT TYPES
  # =====================================================

  type UserAccount {
    id: ID!
    userId: ID!
    provider: AuthProvider!
    providerAccountId: String!
    accessToken: String
    refreshToken: String
    tokenType: String
    scope: String
    idToken: String
    expiresAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type UserSession {
    id: ID!
    userId: ID!
    sessionToken: String!
    accessToken: String!
    refreshToken: String
    expiresAt: DateTime!
    userAgent: String
    ipAddress: String
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type UserSessionAnalytics {
    id: ID!
    sessionId: String!
    userId: ID!
    pageViews: Int!
    timeSpent: Int!
    bounceRate: Float!
    conversionRate: Float!
    deviceType: String
    browser: String
    os: String
    country: String
    city: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type User {
    id: ID!
    email: String!
    role: UserRole!
    isActive: Boolean!
    emailVerified: Boolean!
    lastLoginAt: DateTime
    profile: UserProfile
    addresses: [UserAddress!]!
    accounts: [UserAccount!]!
    sessions: [UserSession!]!
    sessionsAnalytics: [UserSessionAnalytics!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type UserProfile {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    phone: String
    dateOfBirth: DateTime
    avatar: String
    role: UserRole!
    emailVerified: Boolean!
    isActive: Boolean!
    lastLoginAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Computed fields
    fullName: String
    
    # Relations
    addresses: [UserAddress!]!
    orders: [Order!]!
    cartItems: [ShoppingCartItem!]!
    favorites: [UserFavorite!]!
    paymentMethods: [PaymentMethod!]!
    savedPaymentMethods: [SavedPaymentMethod!]!
    transactions: [Transaction!]!
    productReviews: [ProductReview!]!
    reviewVotes: [ReviewVote!]!
    appEvents: [AppEvent!]!
    auditLogs: [AuditLog!]!
    securityEvents: [SecurityEvent!]!
    pushNotifications: [PushNotification!]!
    rewardPoints: [RewardPoint!]!
    couponUsage: [CouponUsage!]!
    newsletterSubscriptions: [NewsletterSubscription!]!
  }

  type UserAddress {
    id: ID!
    userId: ID!
    type: String!
    firstName: String!
    lastName: String!
    company: String
    address1: String!
    address2: String
    city: String!
    state: String!
    postalCode: String!
    country: String!
    phone: String
    isDefault: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Computed fields
    fullName: String!
    fullAddress: String!
    
    # Relations
    user: UserProfile!
    orders: [Order!]!
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

  # ProductVariant is owned by product-service (Federation)
  type ProductVariant @key(fields: "id") {
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

  type UserFavorite {
    id: ID!
    userId: ID!
    productId: ID!
    createdAt: DateTime!
    
    # Relations
    user: UserProfile!
    product: Product!
  }

  # =====================================================
  # ORDER MANAGEMENT TYPES
  # =====================================================

  type Order {
    id: ID!
    userId: ID!
    orderNumber: String!
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
    
    # Relations
    user: UserProfile!
    items: [OrderItem!]!
    shippingAddress: UserAddress
    paymentMethods: [PaymentMethod!]!
    tracking: [OrderTracking!]!
    transactions: [Transaction!]!
    couponUsage: [CouponUsage!]!
  }

  type OrderItem {
    id: ID!
    orderId: ID!
    productId: ID!
    quantity: Int!
    unitPrice: Decimal!
    totalPrice: Decimal!
    createdAt: DateTime!
    
    # Relations
    order: Order!
    product: Product!
  }

  type OrderTracking {
    id: ID!
    orderId: ID!
    status: String!
    location: String
    description: String
    trackingNumber: String
    carrierId: String
    estimatedDelivery: DateTime
    actualDelivery: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Relations
    order: Order!
    carrier: Carrier
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
    
    # Relations
    tracking: [OrderTracking!]!
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

  type AuditLog {
    id: ID!
    userId: String
    action: String!
    tableName: String
    recordId: String
    oldValues: JSON
    newValues: JSON
    ipAddress: String
    userAgent: String
    createdAt: DateTime!
    
    # Relations
    user: UserProfile
  }

  type SecurityEvent {
    id: ID!
    userId: String
    eventType: String!
    description: String!
    ipAddress: String
    userAgent: String
    metadata: JSON!
    createdAt: DateTime!
    
    # Relations
    user: UserProfile
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

  type Image {
    id: ID!
    fileName: String!
    originalName: String!
    mimeType: String!
    size: Int!
    url: String!
    bucket: String
    path: String
    entityType: String
    entityId: String
    createdAt: DateTime!
  }

  type Svg {
    id: ID!
    fileName: String!
    originalName: String!
    url: String!
    path: String
    entityType: String
    entityId: String
    dimensions: SvgDimensions
    viewBox: String
    optimized: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type SvgDimensions {
    width: Float
    height: Float
  }

  # =====================================================
  # INPUT TYPES
  # =====================================================

  # User Management Inputs
  input CreateUserProfileInput {
    email: String!
    firstName: String!
    lastName: String!
    phone: String
    dateOfBirth: DateTime
    avatar: String
    role: UserRole
    isActive: Boolean
    password: String
  }

  input UpdateUserProfileInput {
    firstName: String
    lastName: String
    phone: String
    dateOfBirth: DateTime
    avatar: String
    role: UserRole
    isActive: Boolean
  }

  input UpdateUserInput {
    email: String
    role: UserRole
    isActive: Boolean
    profile: UpdateUserProfileInput
  }

  input CreateUserAddressInput {
    userId: ID!
    type: String!
    firstName: String!
    lastName: String!
    company: String
    address1: String!
    address2: String
    city: String!
    state: String!
    postalCode: String!
    country: String
    phone: String
    isDefault: Boolean
  }

  input UpdateUserAddressInput {
    type: String
    firstName: String
    lastName: String
    company: String
    address1: String
    address2: String
    city: String
    state: String
    postalCode: String
    country: String
    phone: String
    isDefault: Boolean
  }

  # Order Management Inputs
  input CreateOrderInput {
    userId: ID!
    orderNumber: String!
    subtotal: Decimal!
    taxAmount: Decimal
    shippingAmount: Decimal
    discountAmount: Decimal
    totalAmount: Decimal!
    currency: String
    shippingAddressId: String
    notes: String
  }

  input UpdateOrderInput {
    status: OrderStatus
    notes: String
  }

  input CreateOrderItemInput {
    orderId: ID!
    productId: ID!
    quantity: Int!
    unitPrice: Decimal!
    totalPrice: Decimal!
  }

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
  input OrderFilterInput {
    userId: ID
    status: OrderStatus
    startDate: DateTime
    endDate: DateTime
    minAmount: Decimal
    maxAmount: Decimal
  }

  input UserFilterInput {
    role: UserRole
    isActive: Boolean
    search: String
    emailVerified: Boolean
  }

  input UserOrderHistoryFilter {
    status: OrderStatus
    startDate: DateTime
    endDate: DateTime
    minAmount: Decimal
    maxAmount: Decimal
  }

  input PaginationInput {
    limit: Int = 10
    offset: Int = 0
  }

  # =====================================================
  # RESPONSE TYPES
  # =====================================================

  type PaginatedOrders {
    orders: [Order!]!
    total: Int!
    hasMore: Boolean!
  }

  type PaginatedUsers {
    users: [User!]!
    total: Int!
    hasMore: Boolean!
  }

  # Standardized response for users query
  type GetUsersResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: GetUsersData
    metadata: ResponseMetadata
  }

  type GetUsersData {
    items: [User!]!
    pagination: UserPaginationInfo!
  }

  type UserPaginationInfo {
    total: Int!
    limit: Int!
    offset: Int!
    hasMore: Boolean!
    currentPage: Int!
    totalPages: Int!
  }

  # Standardized response for usersByProvider query
  type GetUsersByProviderResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: [User!]!
    metadata: ResponseMetadata
  }

  # Standardized response for currentUser query
  type GetCurrentUserResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: User
    metadata: ResponseMetadata
  }

  type UserOrderHistoryResponse {
    orders: [Order!]!
    total: Int!
    hasMore: Boolean!
    stats: UserOrderHistoryStats!
  }

  type UserOrderHistoryStats {
    totalOrders: Int!
    totalSpent: Decimal!
    averageOrderValue: Decimal!
    lastOrderDate: DateTime
    ordersByStatus: JSON!
  }

  type UserFavoriteStats {
    totalFavorites: Int!
    recentFavorites: [UserFavorite!]!
    favoriteCategories: [String!]!
  }

  type UserActivitySummary {
    recentOrders: [Order!]!
    favoriteProducts: [Product!]!
    cartItemsCount: Int!
    totalSpent: Decimal!
    joinDate: DateTime!
    lastActivity: DateTime!
  }

  type OrderStats {
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

  type UserStats {
    totalUsers: Int!
    activeUsers: Int!
    newUsersThisMonth: Int!
    usersByRole: JSON!
  }

  type UserStatsResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: UserStats!
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

  type ResponseMetadata {
    requestId: String
    traceId: String
    duration: Int
    timestamp: String!
  }

  type CreateUserResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: CreateUserData
    metadata: ResponseMetadata
  }

  type CreateUserData {
    entity: User!
    id: ID!
    createdAt: String!
  }

  # Session Analytics Input Types
  input CreateUserSessionAnalyticsInput {
    sessionId: String!
    userId: ID!
    pageViews: Int
    timeSpent: Int
    bounceRate: Float
    conversionRate: Float
    deviceType: String
    browser: String
    os: String
    country: String
    city: String
  }

  input UpdateUserSessionAnalyticsInput {
    pageViews: Int
    timeSpent: Int
    bounceRate: Float
    conversionRate: Float
    deviceType: String
    browser: String
    os: String
    country: String
    city: String
  }

  # Session Analytics Response Types
  type CreateUserSessionAnalyticsResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: CreateUserSessionAnalyticsData
    metadata: ResponseMetadata
  }

  type CreateUserSessionAnalyticsData {
    entity: UserSessionAnalytics!
    id: ID!
    createdAt: String!
  }

  type UpdateUserSessionAnalyticsResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: UpdateUserSessionAnalyticsData
    metadata: ResponseMetadata
  }

  type UpdateUserSessionAnalyticsData {
    entity: UserSessionAnalytics!
    id: ID!
    updatedAt: String!
    changes: [String!]!
  }

  type DeleteUserSessionAnalyticsResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: DeleteUserSessionAnalyticsData
    metadata: ResponseMetadata
  }

  type DeleteUserSessionAnalyticsData {
    id: ID!
    deletedAt: String!
    softDelete: Boolean!
  }

  # Session Revocation Response Types
  type RevokeUserSessionResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: RevokeUserSessionData
    metadata: ResponseMetadata
  }

  type RevokeUserSessionData {
    sessionId: ID!
    revokedAt: String!
    reason: String
    analyticsCleaned: Boolean!
  }

  type RevokeAllUserSessionsResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: RevokeAllUserSessionsData
    metadata: ResponseMetadata
  }

  type RevokeAllUserSessionsData {
    userId: ID!
    sessionsRevoked: Int!
    analyticsCleaned: Int!
    revokedAt: String!
    reason: String
  }

  # User Address Response Types
  type CreateUserAddressResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: CreateUserAddressData
    metadata: ResponseMetadata
  }

  type CreateUserAddressData {
    entity: UserAddress!
    id: ID!
    createdAt: String!
  }

  type UpdateUserAddressResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: UpdateUserAddressData
    metadata: ResponseMetadata
  }

  type UpdateUserAddressData {
    entity: UserAddress!
    id: ID!
    updatedAt: String!
    changes: [String!]!
  }

  type DeleteUserAddressResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: DeleteUserAddressData
    metadata: ResponseMetadata
  }

  type DeleteUserAddressData {
    id: ID!
    deletedAt: String!
    softDelete: Boolean!
  }

  type SetDefaultAddressResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: SetDefaultAddressData
    metadata: ResponseMetadata
  }

  type SetDefaultAddressData {
    userId: ID!
    addressId: ID!
    updatedAt: String!
  }

  type GetUserAddressResponse {
    success: Boolean!
    message: String!
    timestamp: String!
    code: String!
    data: GetUserAddressData
    metadata: ResponseMetadata
  }

  type GetUserAddressData {
    entity: UserAddress!
  }

  type GetUserAddressesResponse {
    success: Boolean!
    message: String!
    timestamp: String!
    code: String!
    data: GetUserAddressesData
    metadata: ResponseMetadata
  }

  type GetUserAddressesData {
    items: [UserAddress!]!
  }

  type AuthResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: AuthData
    metadata: ResponseMetadata
  }

  type AuthData {
    user: User
    accessToken: String
    refreshToken: String
  }

  # Password Reset Response Types
  type PasswordResetRequestResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: PasswordResetRequestData
    metadata: ResponseMetadata
  }

  type PasswordResetRequestData {
    email: String!
    timestamp: String!
  }

  type PasswordResetConfirmResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: PasswordResetConfirmData
    metadata: ResponseMetadata
  }

  type PasswordResetConfirmData {
    timestamp: String!
    passwordUpdated: Boolean!
  }

  type SetUserPasswordResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: SetUserPasswordData
    metadata: ResponseMetadata
  }

  type SetUserPasswordData {
    userId: ID!
    timestamp: String!
    passwordUpdated: Boolean!
  }

  # Audit and Security Response Types
  type GetUserAuditLogsResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: GetUserAuditLogsData
    metadata: ResponseMetadata
  }

  type GetUserAuditLogsData {
    items: [AuditLog!]!
  }

  type GetUserSecurityEventsResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: GetUserSecurityEventsData
    metadata: ResponseMetadata
  }

  type GetUserSecurityEventsData {
    items: [SecurityEvent!]!
  }

  type SuccessResponse {
    success: Boolean!
    message: String!
  }

  type UploadImageResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: UploadImageData
    metadata: ResponseMetadata
  }

  type UploadImageData {
    url: String!
    filename: String!
    imageId: ID!
  }

  type UploadSvgResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: UploadSvgData
    metadata: ResponseMetadata
  }

  type UploadSvgData {
    url: String!
    filename: String!
    svgId: ID!
    dimensions: SvgDimensions
    viewBox: String
    optimized: Boolean!
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

  type UserAnalytics {
    totalUsers: Int!
    activeUsers: Int!
    newUsersThisMonth: Int!
    usersByRole: JSON!
    topSpenders: [UserProfile!]!
    userEngagement: JSON!
  }

  # =====================================================
  # QUERIES
  # =====================================================

  type Query {
    # Health check
    health: String!
    
    # Dashboard & Analytics
    dashboardMetrics: DashboardMetrics!
    orderAnalytics: OrderAnalytics!
    userAnalytics: UserAnalytics!

      # Stats queries
  orderStats: OrderStatsResponse!
  userStats: UserStatsResponse!
    
    # User queries
    users(filter: UserFilterInput, pagination: PaginationInput): GetUsersResponse!
    user(id: ID!): User
    userProfile(userId: ID!): UserProfile
    userAddresses(userId: ID!): GetUserAddressesResponse!
    userAddress(id: ID!): GetUserAddressResponse!
    currentUser: GetCurrentUserResponse!
    searchUsers(query: String!): [User!]!
    activeUsers: [User!]!
    usersByRole(role: UserRole!): [User!]!
    usersByProvider(provider: AuthProvider!): GetUsersByProviderResponse!
    userOrderHistory(userId: ID!, filter: UserOrderHistoryFilter, pagination: PaginationInput): UserOrderHistoryResponse!
    userFavoriteStats(userId: ID!): UserFavoriteStats!
    userActivitySummary(userId: ID!): UserActivitySummary!
    
    # Authentication queries
    userAccounts(userId: ID!): [UserAccount!]!
    userSessions(userId: ID!): [UserSession!]!
    activeSessions(userId: ID!): [UserSession!]!
    userSessionAnalytics(userId: ID!): [UserSessionAnalytics!]!
    
    # Shopping cart queries
    userCart(userId: ID!): [ShoppingCart!]!
    cartItem(id: ID!): ShoppingCart
    
    # User favorites queries
    userFavorites(userId: ID!): [UserFavorite!]!
    isProductFavorited(userId: ID!, productId: ID!): Boolean!
    
    # Order queries
    orders(filter: OrderFilterInput, pagination: PaginationInput): PaginatedOrders!
    order(id: ID!): Order
    orderByNumber(orderNumber: String!): Order
    userOrders(userId: ID!, pagination: PaginationInput): PaginatedOrders!
    
    # Order tracking queries
    orderTracking(orderId: ID!): [OrderTracking!]!
    orderItems(orderId: ID!): [OrderItem!]!
    
    # Payment queries
    userPaymentMethods(userId: ID!): [PaymentMethod!]!
    savedPaymentMethods(userId: ID!): [SavedPaymentMethod!]!
    paymentMethod(id: ID!): PaymentMethod
    
    # Transaction queries
    userTransactions(userId: ID!): [Transaction!]!
    orderTransactions(orderId: ID!): [Transaction!]!
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
    userAuditLogs(userId: ID!): GetUserAuditLogsResponse!
    userSecurityEvents(userId: ID!): GetUserSecurityEventsResponse!
    
    # Configuration queries
    storeSettings: [StoreSettings!]!
    storeSetting(key: String!): StoreSettings
    taxRates: [TaxRate!]!
    taxRate(id: ID!): TaxRate
    
    # Image queries
    images(entityType: String, entityId: String): [Image!]!
    image(id: ID!): Image
  }

  # =====================================================
  # MUTATIONS
  # =====================================================

  type Mutation {
    # Auth mutations
    registerUser(input: CreateUserProfileInput!): AuthResponse!
    loginUser(email: String!, password: String!): AuthResponse!
    logoutUser: SuccessResponse!
    refreshToken(refreshToken: String!): AuthResponse!
    
    # User mutations
    createUser(input: CreateUserProfileInput!): CreateUserResponse!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    deleteUser(id: ID!): SuccessResponse!
    activateUser(id: ID!): User!
    deactivateUser(id: ID!): User!
    updateUserPassword(email: String!, currentPassword: String!, newPassword: String!): SuccessResponse!
    requestPasswordReset(email: String!): PasswordResetRequestResponse!
    resetPassword(token: String!, newPassword: String!): PasswordResetConfirmResponse!
    setUserPassword(userId: ID!, newPassword: String!): SetUserPasswordResponse!
    
    # User session management
    revokeUserSession(sessionId: ID!, userId: ID!, reason: String): RevokeUserSessionResponse!
    revokeAllUserSessions(userId: ID!, requestingUserId: ID!, reason: String, excludeCurrentSession: Boolean): RevokeAllUserSessionsResponse!
    
    # User account management
    unlinkUserAccount(accountId: ID!): SuccessResponse!
    forcePasswordReset(userId: ID!): SuccessResponse!
    impersonateUser(userId: ID!): AuthResponse!
    
    # User profile management
    createUserProfile(input: CreateUserProfileInput!): UserProfile!
    updateUserProfile(userId: ID!, input: UpdateUserProfileInput!): UserProfile!
    deleteUserProfile(userId: ID!): SuccessResponse!
    
    # User address mutations
    createUserAddress(input: CreateUserAddressInput!): CreateUserAddressResponse!
    updateUserAddress(id: ID!, input: UpdateUserAddressInput!): UpdateUserAddressResponse!
    deleteUserAddress(id: ID!): DeleteUserAddressResponse!
    setDefaultAddress(userId: ID!, addressId: ID!): SetDefaultAddressResponse!
    
    # Shopping cart mutations
    addToCart(userId: ID!, productId: ID!, quantity: Int!): ShoppingCartItem!
    updateCartItem(id: ID!, quantity: Int!): ShoppingCartItem!
    removeFromCart(id: ID!): SuccessResponse!
    clearUserCart(userId: ID!): SuccessResponse!
    
    # User favorites mutations
    addToFavorites(userId: ID!, productId: ID!): UserFavorite!
    removeFromFavorites(userId: ID!, productId: ID!): SuccessResponse!
    toggleFavorite(userId: ID!, productId: ID!): UserFavorite!
    
    # Order mutations
    createOrder(input: CreateOrderInput!): Order!
    updateOrder(id: ID!, input: UpdateOrderInput!): Order!
    updateOrderStatus(id: ID!, status: OrderStatus!): Order!
    cancelOrder(id: ID!): Order!
    shipOrder(id: ID!, trackingNumber: String): Order!
    deliverOrder(id: ID!): Order!
    
    # Order item mutations
    createOrderItem(input: CreateOrderItemInput!): OrderItem!
    updateOrderItem(id: ID!, quantity: Int!, unitPrice: Decimal!): OrderItem!
    deleteOrderItem(id: ID!): SuccessResponse!
    
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
    applyCoupon(orderId: ID!, couponCode: String!): Order!
    removeCoupon(orderId: ID!): Order!
    
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
    
    # Session Analytics mutations
    createUserSessionAnalytics(input: CreateUserSessionAnalyticsInput!): CreateUserSessionAnalyticsResponse!
    updateUserSessionAnalytics(id: ID!, input: UpdateUserSessionAnalyticsInput!): UpdateUserSessionAnalyticsResponse!
    deleteUserSessionAnalytics(id: ID!): DeleteUserSessionAnalyticsResponse!
    
    # Image upload
    uploadImage(file: Upload!, entityType: String!, entityId: String!): UploadImageResponse!
    
    # SVG upload
    uploadSvg(file: Upload!, entityType: String!, entityId: String!, optimize: Boolean, sanitize: Boolean): UploadSvgResponse!
    
    # Bulk operations
    bulkUpdateOrderStatus(orders: [ID!]!, status: OrderStatus!): [Order!]!
  }
`; 