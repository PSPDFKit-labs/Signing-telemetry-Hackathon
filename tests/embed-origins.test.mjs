import { describe, expect, it } from 'vitest';
import { parseEmbedOrigins } from '../next.config.mjs';

describe('embedded signing frame origins', () => {
  it('supports exact HTTPS origins and all documented HTTP loopback hosts', () => {
    expect(parseEmbedOrigins('https://resident.example, http://localhost:3100 http://127.0.0.1:3100 http://[::1]:3100')).toEqual([
      'https://resident.example', 'http://localhost:3100', 'http://127.0.0.1:3100', 'http://[::1]:3100',
    ]);
  });

  it('rejects insecure remote hosts, non-HTTP protocols, credentials, paths and wildcards', () => {
    expect(parseEmbedOrigins([
      'http://resident.example', 'ftp://localhost', 'https://user:password@resident.example',
      'https://resident.example/agreements', 'https://resident.example?x=1',
      'https://resident.example#section', 'https://*.resident.example', 'invalid',
    ].join(','))).toEqual([]);
  });

  it('leaves framing same-origin-only when no additional origins are configured', () => {
    expect(parseEmbedOrigins('')).toEqual([]);
  });
});
