import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';

describe('Frontend CSV Recipient Parsing & Email Validation', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  it('should parse standard CSV with "email" column', () => {
    const csvContent = `name,email,company\nJohn Doe,john@example.com,Acme\nJane Smith,jane@reachinbox.ai,ReachInbox`;

    const parsed = Papa.parse<{ name: string; email: string; company: string }>(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    const emails = parsed.data.map((row) => row.email.trim().toLowerCase());
    expect(emails).toHaveLength(2);
    expect(emails).toContain('john@example.com');
    expect(emails).toContain('jane@reachinbox.ai');
    expect(emails.every((e) => emailRegex.test(e))).toBe(true);
  });

  it('should filter out invalid emails and duplicate entries from CSV', () => {
    const csvContent = `email\nlead1@test.com\ninvalid-address\nlead1@test.com\nlead2@test.com`;

    const parsed = Papa.parse<{ email: string }>(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    const rawEmails = parsed.data.map((r) => r.email.trim().toLowerCase());
    const validEmails = rawEmails.filter((e) => emailRegex.test(e));
    const uniqueValids = Array.from(new Set(validEmails));

    expect(rawEmails).toHaveLength(4);
    expect(validEmails).toHaveLength(3); // excludes invalid-address
    expect(uniqueValids).toHaveLength(2); // deduplicated
    expect(uniqueValids).toEqual(['lead1@test.com', 'lead2@test.com']);
  });

  it('should detect email column under alternate header variations', () => {
    const variations = ['Email', 'recipient', 'RECIPIENT_EMAIL', 'to', 'mail'];

    variations.forEach((header) => {
      const csv = `${header}\nuser@outbox.com`;
      const parsed = Papa.parse<any>(csv, { header: true, skipEmptyLines: true });
      const row = parsed.data[0];
      let detected = '';
      for (const k of Object.keys(row)) {
        if (['email', 'recipient', 'recipient_email', 'to', 'mail'].includes(k.toLowerCase())) {
          detected = row[k];
          break;
        }
      }
      expect(detected).toBe('user@outbox.com');
    });
  });
});
