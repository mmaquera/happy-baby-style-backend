import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncKey(): Buffer {
  const raw = process.env.MFA_ENC_KEY;
  if (!raw || raw.length !== 64) throw new Error('MFA_ENC_KEY must be a 64-char hex string (32 bytes)');
  return Buffer.from(raw, 'hex');
}

export function encryptMfaSecret(plaintext: string): string {
  const key = getEncKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptMfaSecret(stored: string): string {
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Invalid stored MFA secret format');
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getEncKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]).toString('utf8');
}
