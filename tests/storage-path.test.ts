import { describe, expect, it } from 'vitest';
import { isUserUploadPath, storageKeyFromPath } from '../lib/storage-path';

describe('storage path authorization', () => {
  it('accepts only a single object under the current user upload prefix', () => {
    expect(isUserUploadPath('uploads/user-1/file.pdf', 'user-1')).toBe(true);
    expect(isUserUploadPath('https://bucket.s3.us-east-1.amazonaws.com/uploads/user-1/file.pdf', 'user-1')).toBe(true);
    expect(isUserUploadPath('uploads/user-2/file.pdf', 'user-1')).toBe(false);
    expect(isUserUploadPath('uploads/user-1/nested/file.pdf', 'user-1')).toBe(false);
  });

  it('normalizes encoded URL paths and rejects malformed URLs', () => {
    expect(storageKeyFromPath('https://bucket.test/uploads/user-1/a%20b.pdf')).toBe('uploads/user-1/a b.pdf');
    expect(storageKeyFromPath('http://%')).toBeNull();
  });
});
