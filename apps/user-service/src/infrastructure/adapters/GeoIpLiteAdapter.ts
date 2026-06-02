import geoip from 'geoip-lite';
import { IGeoIpPort, GeoIpResult } from '@domain/ports/IGeoIpPort';

// RFC 5735 / RFC 4291 loopback / private ranges — geoip-lite returns null for these.
// We handle null results gracefully, but this list documents intentional no-ops.
const LOCALHOST_PATTERNS = ['127.0.0.1', '::1', 'localhost'];

/**
 * Offline IP geolocation adapter backed by geoip-lite.
 * Uses a bundled MaxMind GeoLite2 database — zero network calls in the request path.
 */
export class GeoIpLiteAdapter implements IGeoIpPort {
  lookup(ip: string | undefined | null): GeoIpResult {
    if (!ip || LOCALHOST_PATTERNS.includes(ip)) {
      return {};
    }

    try {
      const geo = geoip.lookup(ip);
      if (!geo) {
        return {};
      }
      return {
        country: geo.country || undefined,
        city: geo.city || undefined,
      };
    } catch {
      // Never propagate — analytics are best-effort
      return {};
    }
  }
}
