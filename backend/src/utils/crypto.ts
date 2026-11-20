import crypto from 'crypto';
import { env } from '../config/env.js';

// Algorithm for token encryption
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encrypt a plain text string using AES-256-GCM
 */
export function encrypt(text: string): string {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Return iv:tag:ciphertext in hex
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string
 */
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [ivHex, tagHex, contentHex] = parts;
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(contentHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Deterministic idempotency key generator for scheduled email
 */
export function generateIdempotencyKey(
  userId: string,
  senderId: string,
  recipientEmail: string,
  campaignId: string,
  scheduledAt: Date | string
): string {
  const timestamp = typeof scheduledAt === 'string' ? new Date(scheduledAt).getTime() : scheduledAt.getTime();
  const raw = `${userId}:${senderId}:${recipientEmail.toLowerCase().trim()}:${campaignId}:${timestamp}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}
