// mfa-crypto uses Node's built-in crypto module — no @hbs/logging dependency needed.

import { encryptMfaSecret, decryptMfaSecret } from '../mfa-crypto';

const VALID_KEY = 'a'.repeat(64); // 64-char hex = 32 bytes

beforeEach(() => {
  process.env.MFA_ENC_KEY = VALID_KEY;
});

afterEach(() => {
  delete process.env.MFA_ENC_KEY;
});

describe('encryptMfaSecret / decryptMfaSecret', () => {
  it('round-trips a TOTP secret', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const ciphertext = encryptMfaSecret(plaintext);
    expect(decryptMfaSecret(ciphertext)).toBe(plaintext);
  });

  it('produces a different ciphertext on every call (random IV)', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const a = encryptMfaSecret(plaintext);
    const b = encryptMfaSecret(plaintext);
    expect(a).not.toBe(b);
  });

  it('stored format is iv:authTag:ciphertext (3 colon-separated hex parts)', () => {
    const stored = encryptMfaSecret('some-secret');
    const parts = stored.split(':');
    expect(parts).toHaveLength(3);
    // each part should be non-empty hex
    parts.forEach((p) => expect(p).toMatch(/^[0-9a-f]+$/));
  });

  it('throws when MFA_ENC_KEY is missing', () => {
    delete process.env.MFA_ENC_KEY;
    expect(() => encryptMfaSecret('secret')).toThrow('MFA_ENC_KEY must be a 64-char hex string');
  });

  it('throws when MFA_ENC_KEY is wrong length', () => {
    process.env.MFA_ENC_KEY = 'tooshort';
    expect(() => encryptMfaSecret('secret')).toThrow('MFA_ENC_KEY must be a 64-char hex string');
  });

  it('throws when stored format is invalid (missing parts)', () => {
    expect(() => decryptMfaSecret('onlyone')).toThrow('Invalid stored MFA secret format');
  });

  it('throws on tampered authTag (GCM integrity check)', () => {
    const stored = encryptMfaSecret('authentic-secret');
    const [iv, _authTag, ciphertext] = stored.split(':');
    // Replace authTag with all-zeros of same length
    const tampered = [iv, '0'.repeat(_authTag.length), ciphertext].join(':');
    expect(() => decryptMfaSecret(tampered)).toThrow();
  });

  it('throws on tampered ciphertext (GCM integrity check)', () => {
    const stored = encryptMfaSecret('authentic-secret');
    const [iv, authTag, ciphertext] = stored.split(':');
    // Flip the first byte of ciphertext
    const tamperedCipher = 'ff' + ciphertext.slice(2);
    const tampered = [iv, authTag, tamperedCipher].join(':');
    expect(() => decryptMfaSecret(tampered)).toThrow();
  });
});
