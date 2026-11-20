import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, generateIdempotencyKey } from '../src/utils/crypto.js';
import { emailRegex, scheduleEmailSchema, createSenderSchema } from '../src/validators/index.js';
import { RateLimiterService } from '../src/services/rateLimiter.js';

describe('Cryptographic & Idempotency Utilities', () => {
  it('should encrypt and decrypt strings using AES-256-GCM', () => {
    const secret = 'xoxb-slack-bot-token-secret-12345';
    const encrypted = encrypt(secret);

    expect(encrypted).not.toBe(secret);
    expect(encrypted).toContain(':'); // iv:tag:ciphertext

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(secret);
  });

  it('should produce deterministic idempotency keys for identical parameters', () => {
    const key1 = generateIdempotencyKey('user-1', 'sender-1', 'target@test.com', 'camp-1', '2026-11-20T12:00:00.000Z');
    const key2 = generateIdempotencyKey('user-1', 'sender-1', 'target@test.com', 'camp-1', '2026-11-20T12:00:00.000Z');
    const key3 = generateIdempotencyKey('user-1', 'sender-1', 'other@test.com', 'camp-1', '2026-11-20T12:00:00.000Z');

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).toHaveLength(64); // sha256 hex
  });

  it('should normalize email casing in idempotency keys', () => {
    const keyLower = generateIdempotencyKey('user-1', 'sender-1', 'lead@test.com', 'camp-1', '2026-11-20T12:00:00.000Z');
    const keyUpper = generateIdempotencyKey('user-1', 'sender-1', 'LEAD@test.com ', 'camp-1', '2026-11-20T12:00:00.000Z');

    expect(keyLower).toBe(keyUpper);
  });
});

describe('Validation Schemas', () => {
  it('should validate standard RFC compliant emails', () => {
    expect(emailRegex.test('user@domain.com')).toBe(true);
    expect(emailRegex.test('user.name+tag@sub.domain.co.in')).toBe(true);
    expect(emailRegex.test('invalid-email')).toBe(false);
    expect(emailRegex.test('@no-local.com')).toBe(false);
  });

  it('should validate scheduling payload', () => {
    const valid = {
      subject: 'Welcome to ReachInbox',
      body: 'Hello World',
      recipientEmails: ['test1@example.com', 'test2@example.com'],
      senderId: 'sender-123',
      delayBetweenEmails: 2500,
      hourlyLimit: 150,
    };

    const result = scheduleEmailSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject invalid recipient emails in schedule payload', () => {
    const invalid = {
      subject: 'Subject',
      body: 'Body',
      recipientEmails: ['valid@domain.com', 'not-an-email'],
      senderId: 'sender-123',
    };

    const result = scheduleEmailSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should validate sender creation', () => {
    const sender = {
      email: 'alex@reachinbox.ai',
      displayName: 'Alex at ReachInbox',
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
    };

    const result = createSenderSchema.safeParse(sender);
    expect(result.success).toBe(true);
  });
});

describe('Rate Limiter Calculation', () => {
  it('should calculate correct hour window string in UTC', () => {
    const fixedDate = new Date('2026-11-20T15:35:10.000Z');
    const window = RateLimiterService.getHourWindow(fixedDate);
    expect(window).toBe('2026-11-20-15');
  });

  it('should calculate next hour window start accurately', () => {
    const fixedDate = new Date('2026-11-20T15:35:10.000Z');
    const nextWindow = RateLimiterService.getNextHourWindowStart(fixedDate);
    expect(nextWindow.toISOString()).toBe('2026-11-20T16:00:00.000Z');
  });

  it('should roll over to next day when hour is 23', () => {
    const fixedDate = new Date('2026-11-20T23:45:00.000Z');
    const nextWindow = RateLimiterService.getNextHourWindowStart(fixedDate);
    expect(nextWindow.toISOString()).toBe('2026-11-21T00:00:00.000Z');
  });
});
