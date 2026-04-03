/**
 * URL-safe random token generator for group access tokens and other secrets.
 * @module api-server/utils/tokenGenerator
 */

import { randomBytes } from 'node:crypto';

/** Characters used in URL-safe tokens (base62 + hyphen + underscore) */
const URL_SAFE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Generate a cryptographically random URL-safe token.
 * @param length - Token length in characters (default 20)
 * @returns URL-safe random string
 */
export function generateAccessToken(length = 20): string {
  const bytes = randomBytes(length);
  let token = '';
  for (let i = 0; i < length; i++) {
    token += URL_SAFE_CHARS[bytes[i] % URL_SAFE_CHARS.length];
  }
  return token;
}
