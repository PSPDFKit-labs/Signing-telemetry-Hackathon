import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPublicApiRoute, mustHaveRateLimiter } from '../lib/api-route-security';

describe('public API protection', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('matches only intended route boundaries', () => {
    expect(isPublicApiRoute('/api/sign/submit')).toBe(true);
    expect(isPublicApiRoute('/api/documents/proxy')).toBe(true);
    expect(isPublicApiRoute('/api/signature-admin')).toBe(false);
    expect(isPublicApiRoute('/api/documents/proxy-admin')).toBe(false);
  });

  it('requires configured distributed rate limiting in production', () => {
    expect(mustHaveRateLimiter('/api/sign/verify-token', 'production')).toBe(true);
    expect(mustHaveRateLimiter('/api/sign/verify-token', 'development')).toBe(false);
    expect(mustHaveRateLimiter('/api/documents', 'production')).toBe(false);
  });

  it('does not require hosted rate limiting for the loopback-only local evaluation', () => {
    vi.stubEnv('LOCAL_DEMO', 'true');
    vi.stubEnv('LOCAL_DEMO_PASSWORD', 'test-only-password');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://127.0.0.1:3000');
    vi.stubEnv('DATABASE_URL', 'postgresql://demo:demo@127.0.0.1:54329/demo');

    expect(mustHaveRateLimiter('/api/documents/proxy', 'production')).toBe(false);
  });
});
