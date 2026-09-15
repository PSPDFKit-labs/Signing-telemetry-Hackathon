import { describe, expect, it } from 'vitest';
import { escapeEmailHtml } from '../lib/email-template-security';

describe('email templates', () => {
  it('escapes every character that can break HTML text or attributes', () => {
    expect(escapeEmailHtml(`<script data-x="a&b">'x'</script>`)).toBe(
      '&lt;script data-x=&quot;a&amp;b&quot;&gt;&#39;x&#39;&lt;/script&gt;',
    );
  });
});
