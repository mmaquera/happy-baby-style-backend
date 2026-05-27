import gql from 'graphql-tag';

export const typeDefs = gql`
  extend schema
    @link(
      url: "https://specs.apollo.dev/federation/v2.0"
      import: ["@key", "@external", "@requires", "@provides", "@shareable"]
    )

  scalar DateTime
  scalar Decimal
  scalar JSON

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

  # ── Federation-owned types ───────────────────────────────────────────────────

  type User @key(fields: "id") {
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

  type UserProfile @key(fields: "id") {
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
    fullName: String
    addresses: [UserAddress!]!
  }

  type UserAddress @key(fields: "id") {
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
    fullName: String!
    fullAddress: String!
    user: UserProfile!
  }

  # ── Auth & Session types ─────────────────────────────────────────────────────

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

  # ── Audit types ──────────────────────────────────────────────────────────────

  type AuditLog {
    id: ID!
    userId: ID
    action: String!
    tableName: String
    recordId: String
    oldValues: JSON
    newValues: JSON
    ipAddress: String
    userAgent: String
    createdAt: DateTime!
  }

  type SecurityEvent {
    id: ID!
    userId: ID
    eventType: String!
    description: String!
    ipAddress: String
    userAgent: String
    metadata: JSON!
    createdAt: DateTime!
  }

  # ── Cross-domain federation stubs ────────────────────────────────────────────

  type Order @key(fields: "id") {
    id: ID!
  }

  type Product @key(fields: "id") {
    id: ID!
  }

  # ── User analytics types ─────────────────────────────────────────────────────

  type UserAnalytics {
    totalUsers: Int!
    activeUsers: Int!
    newUsersThisMonth: Int!
    usersByRole: JSON!
    topSpenders: [UserProfile!]!
    userEngagement: JSON!
  }

  type UserStats {
    totalUsers: Int!
    activeUsers: Int!
    newUsersThisMonth: Int!
    usersByRole: JSON!
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

  type UserFavorite @shareable {
    id: ID!
    userId: ID!
    productId: ID!
    createdAt: DateTime!
    user: UserProfile!
    product: Product!
  }

  # ── Saved payment methods ────────────────────────────────────────────────────

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

  # ── Loyalty & rewards ────────────────────────────────────────────────────────

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

  # ── Notifications ────────────────────────────────────────────────────────────

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

  # ── Newsletter ───────────────────────────────────────────────────────────────

  type NewsletterSubscription {
    id: ID!
    email: String!
    userId: String
    isActive: Boolean!
    subscribedAt: DateTime!
    unsubscribedAt: DateTime
    user: UserProfile
  }

  # ── App events ───────────────────────────────────────────────────────────────

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
  }

  type UserActivitySummary {
    recentOrders: [Order!]!
    favoriteProducts: [Product!]!
    cartItemsCount: Int!
    totalSpent: Decimal!
    joinDate: DateTime!
    lastActivity: DateTime!
  }

  # ── Response types ───────────────────────────────────────────────────────────

  type ResponseMetadata @shareable {
    requestId: String
    traceId: String
    duration: Int
    timestamp: String!
  }

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

  type GetUsersByProviderResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: [User!]!
    metadata: ResponseMetadata
  }

  type GetCurrentUserResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: User
    metadata: ResponseMetadata
  }

  type UserStatsResponse {
    success: Boolean!
    message: String!
    code: String!
    timestamp: String!
    data: UserStats!
    metadata: ResponseMetadata
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

  type SuccessResponse @shareable {
    success: Boolean!
    message: String!
  }

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

  # ── Inputs ───────────────────────────────────────────────────────────────────

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

  input CreateUserProfileInput {
    email: String!
    password: String!
    firstName: String!
    lastName: String!
    phone: String
    dateOfBirth: DateTime
    role: UserRole
    isActive: Boolean
  }

  input UpdateUserInput {
    email: String
    role: UserRole
    isActive: Boolean
    firstName: String
    lastName: String
    phone: String
    dateOfBirth: DateTime
    avatarUrl: String
  }

  input UpdateUserProfileInput {
    firstName: String
    lastName: String
    phone: String
    dateOfBirth: DateTime
    avatarUrl: String
  }

  input CreateUserAddressInput {
    userId: ID!
    type: String
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

  # ── Queries ──────────────────────────────────────────────────────────────────

  type Query {
    health: String! @shareable

    # User queries
    users(filter: UserFilterInput, pagination: PaginationInput): GetUsersResponse!
    user(id: ID!): User
    userProfile(userId: ID!): UserProfile
    currentUser: GetCurrentUserResponse!
    searchUsers(query: String!): [User!]!
    activeUsers: [User!]!
    usersByRole(role: UserRole!): [User!]!
    usersByProvider(provider: AuthProvider!): GetUsersByProviderResponse!
    userStats: UserStatsResponse!
    userAnalytics: UserAnalytics!

    # Address queries
    userAddresses(userId: ID!): GetUserAddressesResponse!
    userAddress(id: ID!): GetUserAddressResponse!

    # Session queries
    userAccounts(userId: ID!): [UserAccount!]!
    userSessions(userId: ID!): [UserSession!]!
    activeSessions(userId: ID!): [UserSession!]!
    userSessionAnalytics(userId: ID!): [UserSessionAnalytics!]!

    # User activity queries
    userOrderHistory(
      userId: ID!
      filter: UserOrderHistoryFilter
      pagination: PaginationInput
    ): UserOrderHistoryResponse!
    userFavoriteStats(userId: ID!): UserFavoriteStats!
    userActivitySummary(userId: ID!): UserActivitySummary!

    # Favorites
    userFavorites(userId: ID!): [UserFavorite!]!
    isProductFavorited(userId: ID!, productId: ID!): Boolean!

    # Saved payment methods
    savedPaymentMethods(userId: ID!): [SavedPaymentMethod!]!

    # Loyalty & rewards
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

    # App events
    userAppEvents(userId: ID!): [AppEvent!]!
    productAppEvents(productId: ID!): [AppEvent!]!

    # Audit & security queries
    userAuditLogs(userId: ID!): GetUserAuditLogsResponse!
    userSecurityEvents(userId: ID!): GetUserSecurityEventsResponse!
  }

  # ── Mutations ────────────────────────────────────────────────────────────────

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
    updateUserPassword(
      email: String!
      currentPassword: String!
      newPassword: String!
    ): SuccessResponse!
    requestPasswordReset(email: String!): PasswordResetRequestResponse!
    resetPassword(token: String!, newPassword: String!): PasswordResetConfirmResponse!
    setUserPassword(userId: ID!, newPassword: String!): SetUserPasswordResponse!

    # User profile mutations
    createUserProfile(input: CreateUserProfileInput!): UserProfile!
    updateUserProfile(userId: ID!, input: UpdateUserProfileInput!): UserProfile!
    deleteUserProfile(userId: ID!): SuccessResponse!

    # Address mutations
    createUserAddress(input: CreateUserAddressInput!): CreateUserAddressResponse!
    updateUserAddress(id: ID!, input: UpdateUserAddressInput!): UpdateUserAddressResponse!
    deleteUserAddress(id: ID!): DeleteUserAddressResponse!
    setDefaultAddress(userId: ID!, addressId: ID!): SetDefaultAddressResponse!

    # Session mutations
    revokeUserSession(sessionId: ID!, userId: ID!, reason: String): RevokeUserSessionResponse!
    revokeAllUserSessions(
      userId: ID!
      requestingUserId: ID!
      reason: String
      excludeCurrentSession: Boolean
    ): RevokeAllUserSessionsResponse!
    unlinkUserAccount(accountId: ID!): SuccessResponse!
    forcePasswordReset(userId: ID!): SuccessResponse!
    impersonateUser(userId: ID!): AuthResponse!

    # Session Analytics mutations
    createUserSessionAnalytics(
      input: CreateUserSessionAnalyticsInput!
    ): CreateUserSessionAnalyticsResponse!
    updateUserSessionAnalytics(
      id: ID!
      input: UpdateUserSessionAnalyticsInput!
    ): UpdateUserSessionAnalyticsResponse!
    deleteUserSessionAnalytics(id: ID!): DeleteUserSessionAnalyticsResponse!

    # Favorites mutations
    addToFavorites(userId: ID!, productId: ID!): UserFavorite!
    removeFromFavorites(userId: ID!, productId: ID!): SuccessResponse!
    toggleFavorite(userId: ID!, productId: ID!): UserFavorite

    # Saved payment methods mutations
    createSavedPaymentMethod(input: CreateSavedPaymentMethodInput!): SavedPaymentMethod!
    updateSavedPaymentMethod(id: ID!, input: UpdateSavedPaymentMethodInput!): SavedPaymentMethod!
    deleteSavedPaymentMethod(id: ID!): SuccessResponse!

    # Notification mutations
    createPushNotification(input: CreatePushNotificationInput!): PushNotification!
    markNotificationAsRead(id: ID!): PushNotification!
    markAllNotificationsAsRead(userId: ID!): SuccessResponse!
    createNotificationTemplate(input: CreateNotificationTemplateInput!): NotificationTemplate!

    # Newsletter mutations
    subscribeToNewsletter(email: String!, userId: String): NewsletterSubscription!
    unsubscribeFromNewsletter(email: String!): SuccessResponse!
  }
`;
