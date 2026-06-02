// No @hbs/logging dependency — adapter has no logger.

jest.mock('geoip-lite', () => ({
  lookup: jest.fn(),
}));

import geoip from 'geoip-lite';
import { GeoIpLiteAdapter } from '../GeoIpLiteAdapter';

const mockLookup = geoip.lookup as jest.Mock;

const makeAdapter = () => new GeoIpLiteAdapter();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GeoIpLiteAdapter', () => {
  it('returns country and city for a known IP', () => {
    mockLookup.mockReturnValue({ country: 'CO', city: 'Bogotá', range: [], region: '', eu: '0', timezone: '', ll: [0, 0], metro: 0, area: 0 });
    const adapter = makeAdapter();
    const result = adapter.lookup('203.0.113.5');
    expect(result).toEqual({ country: 'CO', city: 'Bogotá' });
  });

  it('returns empty object when geoip returns null (unknown IP)', () => {
    mockLookup.mockReturnValue(null);
    const adapter = makeAdapter();
    expect(adapter.lookup('192.0.2.1')).toEqual({});
  });

  it('returns empty object for null input (no ip address available)', () => {
    const adapter = makeAdapter();
    expect(adapter.lookup(null)).toEqual({});
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('returns empty object for undefined input', () => {
    const adapter = makeAdapter();
    expect(adapter.lookup(undefined)).toEqual({});
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('returns empty object for localhost (127.0.0.1)', () => {
    const adapter = makeAdapter();
    expect(adapter.lookup('127.0.0.1')).toEqual({});
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('returns empty object for IPv6 loopback (::1)', () => {
    const adapter = makeAdapter();
    expect(adapter.lookup('::1')).toEqual({});
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('returns empty object when geoip throws (never propagates)', () => {
    mockLookup.mockImplementation(() => { throw new Error('db read error'); });
    const adapter = makeAdapter();
    expect(() => adapter.lookup('203.0.113.5')).not.toThrow();
    expect(adapter.lookup('203.0.113.5')).toEqual({});
  });

  it('omits undefined city field when geo has no city', () => {
    mockLookup.mockReturnValue({ country: 'US', city: '', range: [], region: '', eu: '0', timezone: '', ll: [0, 0], metro: 0, area: 0 });
    const adapter = makeAdapter();
    const result = adapter.lookup('8.8.8.8');
    // empty string city is falsy → coerced to undefined
    expect(result.city).toBeUndefined();
  });
});
