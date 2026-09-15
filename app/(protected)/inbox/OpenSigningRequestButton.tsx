'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function OpenSigningRequestButton({ requestId }: { requestId: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function openRequest() {
    setPending(true);
    try {
      const response = await fetch('/api/sign/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });
      const body = await response.json();
      if (!response.ok || typeof body.url !== 'string') throw new Error(body.error || 'Unable to open request');
      router.push(body.url);
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" className="btn sm" onClick={openRequest} disabled={pending}>
      {pending ? 'Opening…' : 'Sign document'}
    </button>
  );
}
