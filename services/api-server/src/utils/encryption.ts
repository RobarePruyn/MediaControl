/**
 * AES-256-GCM encryption utility for sensitive data (controller credentials, SSO secrets).
 * Encrypts before storage, decrypts on read. The encryption key comes from environment config.
 * @module api-server/utils/encryption
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Output format: base64(iv + authTag + ciphertext)
 * @param plaintext - The string to encrypt
 * @param keyHex - Hex-encoded 256-bit encryption key
 * @returns Base64-encoded encrypted payload
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack as: iv (12) + authTag (16) + ciphertext (variable)
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString('base64');
}

/**
 * Decrypt an AES-256-GCM encrypted payload.
 * @param encryptedBase64 - Base64-encoded encrypted payload (from encrypt())
 * @param keyHex - Hex-encoded 256-bit encryption key
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedBase64: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const packed = Buffer.from(encryptedBase64, 'base64');

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Encrypt a JSON-serializable object.
 * @param data - Object to encrypt
 * @param keyHex - Hex-encoded 256-bit encryption key
 * @returns Base64-encoded encrypted payload
 */
export function encryptJson(data: unknown, keyHex: string): string {
  return encrypt(JSON.stringify(data), keyHex);
}

/**
 * Decrypt a JSON object that was encrypted with encryptJson.
 * @param encryptedBase64 - Base64-encoded encrypted payload
 * @param keyHex - Hex-encoded 256-bit encryption key
 * @returns Parsed JSON object
 */
export function decryptJson<T = unknown>(encryptedBase64: string, keyHex: string): T {
  return JSON.parse(decrypt(encryptedBase64, keyHex)) as T;
}
