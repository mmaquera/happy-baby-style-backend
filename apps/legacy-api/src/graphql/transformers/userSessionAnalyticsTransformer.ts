import { UserSessionAnalytics } from '@domain/entities/Auth';

/**
 * Transforma una entidad UserSessionAnalytics a su representación GraphQL
 * Sigue los estándares de transformación del proyecto
 */
export function transformUserSessionAnalytics(analytics: UserSessionAnalytics) {
  return {
    id: analytics.id,
    sessionId: analytics.sessionId,
    userId: analytics.userId,
    pageViews: analytics.pageViews,
    timeSpent: analytics.timeSpent,
    bounceRate: analytics.bounceRate,
    conversionRate: analytics.conversionRate,
    deviceType: analytics.deviceType,
    browser: analytics.browser,
    os: analytics.os,
    country: analytics.country,
    city: analytics.city,
    createdAt: analytics.createdAt.toISOString(),
    updatedAt: analytics.updatedAt.toISOString(),
  };
}

/**
 * Transforma un array de entidades UserSessionAnalytics
 */
export function transformUserSessionAnalyticsArray(analytics: UserSessionAnalytics[]) {
  return analytics.map(transformUserSessionAnalytics);
}
