import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isLocalDemo } from '@/lib/local-demo';

describe('local evaluation sign-in boundary', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('LOCAL_DEMO', 'true');
    vi.stubEnv('LOCAL_DEMO_PASSWORD', 'test-only-password');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://127.0.0.1:3000');
    vi.stubEnv('DATABASE_URL', 'postgresql://demo:demo@127.0.0.1:54329/demo');
  });
  afterEach(() => vi.unstubAllEnvs());
  it('allows the explicitly configured loopback environment', () => expect(isLocalDemo()).toBe(true));
  it('remains available in a production build only when every loopback safeguard is present', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isLocalDemo()).toBe(true);
  });
  it('is disabled against a remote database', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://demo:demo@database.example/demo');
    expect(isLocalDemo()).toBe(false);
  });
  it('is disabled for a remotely hosted application', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://sign.example');
    expect(isLocalDemo()).toBe(false);
  });
  it('requires an explicit opt-in and a password', () => {
    vi.stubEnv('LOCAL_DEMO', 'false');
    expect(isLocalDemo()).toBe(false);
    vi.stubEnv('LOCAL_DEMO', 'true');
    vi.stubEnv('LOCAL_DEMO_PASSWORD', '');
    expect(isLocalDemo()).toBe(false);
  });
});
