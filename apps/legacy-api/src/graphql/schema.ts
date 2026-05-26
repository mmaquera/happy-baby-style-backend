import gql from 'graphql-tag';

export const typeDefs = gql`
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

  # =====================================================
  # ENUMS (only those still used by legacy-api types)
  # =====================================================

  enum PaymentMethodType {
    credit_card
    debit_card
    paypal
    bank_transfer
    cash_on_delivery
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
  # FEDERATION STUBS — types owned by other services
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

  type Category @key(fields: "id") {
    id: ID!
  }

  type Product @key(fields: "id") {
    id: ID!
  }

  type Order @key(fields: "id") {
    id: ID!
  }

  type OrderItem @key(fields: "id") {
    id: ID!
  }

  type Image @key(fields: "id") {
    id: ID!
  }

  type Svg @key(fields: "id") {
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

  type UserFavorite @shareable {
    id: ID!
    userId: ID!
    productId: ID!
    createdAt: DateTime!
    user: UserProfile!
    product: Product!
  }

  # =====================================================
  # PAYMENT TYPES — SavedPaymentMethod (user domain, not yet migrated)
  # =====================================================

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
    user: UserProfile!
  }

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

  type PaginatedReviews {
    reviews: [ProductReview!]!
    total: Int!
    hasMore: Boolean!
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
    user: UserProfile
  }

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

  # =====================================================
  # RESPONSE TYPES
  # =====================================================

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
  # PAGINATION INPUT
  # =====================================================

  input PaginationInput {
    limit: Int = 10
    offset: Int = 0
  }

  # =====================================================
  # QUERIES
  # =====================================================

  type Query {
    # Health check
    health: String! @shareable

    # Dashboard & Analytics (cross-domain)
    dashboardMetrics: DashboardMetrics!
    orderAnalytics: OrderAnalytics!

    # Shopping cart
    userCart(userId: ID!): [ShoppingCart!]!
    cartItem(id: ID!): ShoppingCart

    # User favorites
    userFavorites(userId: ID!): [UserFavorite!]!
    isProductFavorited(userId: ID!, productId: ID!): Boolean!

    # Saved payment methods (user domain)
    savedPaymentMethods(userId: ID!): [SavedPaymentMethod!]!

    # Reviews
    productReviews(productId: ID!, pagination: PaginationInput): PaginatedReviews!
    userReviews(userId: ID!): [ProductReview!]!
    review(id: ID!): ProductReview
    reviewVotes(reviewId: ID!): [ReviewVote!]!

    # Loyalty
    loyaltyPrograms: [LoyaltyProgram!]!
    userRewardPoints(userId: ID!): [RewardPoint!]!
    userRewardBalance(userId: ID!): Int!

    # Notifications
    userNotifications(userId: ID!): [PushNotification!]!
    unreadNotifications(userId: ID!): [PushNotification!]!
    notificationTemplates: [NotificationTemplate!]!
    emailTemplates: [EmailTemplate!]!

    # Newsletter
    newsletterSubscriptions: [NewsletterSubscription!]!
    isSubscribedToNewsletter(email: String!): Boolean!

    # Analytics & Tracking
    userAppEvents(userId: ID!): [AppEvent!]!
    productAppEvents(productId: ID!): [AppEvent!]!

    # Configuration
    storeSettings: [StoreSettings!]!
    storeSetting(key: String!): StoreSettings
    taxRates: [TaxRate!]!
    taxRate(id: ID!): TaxRate
  }

  # =====================================================
  # MUTATIONS
  # =====================================================

  type Mutation {
    # Shopping cart
    addToCart(userId: ID!, productId: ID!, quantity: Int!): ShoppingCartItem!
    updateCartItem(id: ID!, quantity: Int!): ShoppingCartItem!
    removeFromCart(id: ID!): SuccessResponse!
    clearUserCart(userId: ID!): SuccessResponse!

    # User favorites
    addToFavorites(userId: ID!, productId: ID!): UserFavorite!
    removeFromFavorites(userId: ID!, productId: ID!): SuccessResponse!
    toggleFavorite(userId: ID!, productId: ID!): UserFavorite

    # Saved payment methods (user domain)
    createSavedPaymentMethod(input: CreateSavedPaymentMethodInput!): SavedPaymentMethod!
    updateSavedPaymentMethod(id: ID!, input: UpdateSavedPaymentMethodInput!): SavedPaymentMethod!
    deleteSavedPaymentMethod(id: ID!): SuccessResponse!

    # Reviews
    createProductReview(input: CreateProductReviewInput!): ProductReview!
    updateProductReview(id: ID!, input: UpdateProductReviewInput!): ProductReview!
    deleteProductReview(id: ID!): SuccessResponse!
    approveReview(id: ID!): ProductReview!
    createReviewVote(input: CreateReviewVoteInput!): ReviewVote!
    deleteReviewVote(reviewId: ID!, userId: ID!): SuccessResponse!

    # Notifications
    createPushNotification(input: CreatePushNotificationInput!): PushNotification!
    markNotificationAsRead(id: ID!): PushNotification!
    markAllNotificationsAsRead(userId: ID!): SuccessResponse!
    createNotificationTemplate(input: CreateNotificationTemplateInput!): NotificationTemplate!

    # Newsletter
    subscribeToNewsletter(email: String!, userId: String): NewsletterSubscription!
    unsubscribeFromNewsletter(email: String!): SuccessResponse!
  }
`;
