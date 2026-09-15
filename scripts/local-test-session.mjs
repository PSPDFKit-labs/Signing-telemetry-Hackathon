import assert from 'node:assert/strict';
import { config } from 'dotenv';

export async function localTestSession() {
  config({ path: '.env.local', quiet: true });
  const base = 'http://127.0.0.1:3000';
  assert.equal(process.env.LOCAL_DEMO, 'true');
  assert.equal(process.env.NEXT_PUBLIC_APP_URL, base);
  assert.equal(new URL(process.env.DATABASE_URL).hostname, '127.0.0.1');
  assert.equal(new URL(process.env.DATABASE_URL).port, '54329');
  assert.ok(!process.env.RESEND_API_KEY && !process.env.SENDGRID_API_KEY, 'Disable email delivery for local tests');
  const cookies = new Map();
  async function request(path, options = {}) {
    assert.ok(path.startsWith('/') && !path.startsWith('//'));
    const response = await fetch(base + path, {
      ...options,
      redirect: 'manual',
      headers: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...options.headers },
    });
    for (const value of response.headers.getSetCookie()) {
      const [pair] = value.split(';');
      const split = pair.indexOf('=');
      cookies.set(pair.slice(0, split), pair.slice(split + 1));
    }
    return response;
  }
  const csrf = await (await request('/api/auth/csrf')).json();
  await request('/api/auth/callback/local-demo', {
    method: 'POST',
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      password: process.env.LOCAL_DEMO_PASSWORD,
      callbackUrl: `${base}/dashboard`,
    }),
  });
  const session = await (await request('/api/auth/session')).json();
  assert.equal(session.user?.email, 'coordinator@resident-demo.test');
  return {
    request,
    post: (path, body) =>
      request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  };
}
