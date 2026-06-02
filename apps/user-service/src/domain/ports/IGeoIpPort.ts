/**
 * Port for offline IP geolocation lookups.
 * Implementations must not make any network calls in the request path.
 */
export interface GeoIpResult {
  country?: string;
  city?: string;
}

export interface IGeoIpPort {
  /**
   * Looks up geolocation data for the given IP address.
   * Returns an empty object for null/undefined input, localhost addresses,
   * or IPs not found in the local database — never throws.
   */
  lookup(ip: string | undefined | null): GeoIpResult;
}
