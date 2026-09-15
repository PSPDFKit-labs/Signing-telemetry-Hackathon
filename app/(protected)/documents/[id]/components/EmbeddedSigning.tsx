'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SIGNING_EMBED_PROTOCOL, SIGNING_EMBED_VERSION } from '@/lib/embed-contract';

export function EmbeddedSigning({
  documentId,
  recipients,
}: {
  documentId: string;
  recipients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [participantId, setParticipantId] = useState(recipients[0]?.id || '');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!url) return;
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== new URL(url).origin) return;
      const data = event.data;
      if (!data || data.source !== SIGNING_EMBED_PROTOCOL || data.version !== SIGNING_EMBED_VERSION) return;
      if (data.documentId && data.documentId !== documentId) return;
      const labels: Record<string, string> = {
        ready: 'Opening signing session',
        'viewer-ready': 'Ready for signature',
        submitting: 'Saving signature',
        completed: 'Signature submitted',
        declined: 'Signing declined',
        error: 'The signing session reported an error',
      };
      if (!labels[data.type]) return;
      setStatus(labels[data.type]);
      if (data.type === 'completed' || data.type === 'declined') router.refresh();
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [url, documentId, router]);

  async function open() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/documents/${documentId}/embed-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not open signing session');
      const target = new URL(data.embedUrl);
      if (target.origin !== window.location.origin) throw new Error('Application URL must match this workspace');
      setUrl(target.href);
      setStatus('Opening signing session');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open signing session');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border p-5">
      <h2 className="text-lg font-semibold">Sign within the workspace</h2>
      <p className="text-sm">
        Open a recipient’s real signing session to evaluate the embedded workflow. Creating a session replaces that
        recipient’s previous signing link.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="embedded-recipient">Recipient</label>
        <select
          id="embedded-recipient"
          value={participantId}
          disabled={busy || Boolean(url)}
          onChange={(event) => setParticipantId(event.target.value)}
          className="rounded border p-2"
        >
          {recipients.map((recipient) => (
            <option key={recipient.id} value={recipient.id}>
              {recipient.name}
            </option>
          ))}
        </select>
        {url ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setUrl('');
              setStatus('');
              router.refresh();
            }}
          >
            Close session
          </button>
        ) : (
          <button type="button" className="btn" disabled={busy || !participantId} onClick={open}>
            {busy ? 'Opening…' : 'Open signing session'}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {url && (
        <iframe
          ref={frame}
          src={url}
          title="Recipient signing session"
          className="w-full rounded border"
          style={{ height: '75vh', minHeight: 480 }}
        />
      )}
    </section>
  );
}
