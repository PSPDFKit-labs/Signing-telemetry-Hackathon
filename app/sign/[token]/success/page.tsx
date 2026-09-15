'use client';

import Link from 'next/link';
import { IconDashboard } from '@/components/sign-design/icons';

export default function SignSuccessPage() {
  return (
    <>
      <div className="app-page-head">
        <div>
          <h1 className="app-h1">Document Signed</h1>
          <p>Your signature has been successfully recorded.</p>
        </div>
      </div>

      <div className="success-card">
        <div className="ck">
          <svg
            aria-hidden="true"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <h2 style={{ margin: 0, color: 'var(--ink)', fontSize: 'var(--text-xl)', fontWeight: 600 }}>
          Successfully signed
        </h2>
        <p
          style={{
            margin: 0,
            color: 'var(--ink-3)',
            maxWidth: '36ch',
            textAlign: 'center',
            fontSize: 'var(--text-sm)',
          }}
        >
          Your signature has been recorded. The sender will notify you when the final signed document is ready.
        </p>
        <div className="note">No further action is needed unless the sender contacts you.</div>
        <Link href="/dashboard" className="btn ghost">
          <IconDashboard aria-hidden="true" /> Go to dashboard
        </Link>
      </div>
    </>
  );
}
