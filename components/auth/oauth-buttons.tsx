'use client';

import { useState } from 'react';
import { GoogleIcon, MicrosoftIcon } from '@/components/icons';
import { handleSignin } from '@/server/auth/sign-in';

interface OAuthButtonsProps {
  callbackUrl?: string;
  googleConfigured?: boolean;
  microsoftConfigured?: boolean;
}

export function OAuthButtons({
  callbackUrl: _callbackUrl,
  googleConfigured = true,
  microsoftConfigured = true,
}: OAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoadingProvider('google');
    handleSignin({ provider: 'google' });
  };

  const handleMicrosoftSignIn = async () => {
    setLoadingProvider('microsoft');
    handleSignin({ provider: 'microsoft-entra-id' });
  };

  const isLoading = loadingProvider !== null;

  return (
    <>
      {googleConfigured && (
        <button
          type="button"
          className="sso-btn"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          aria-busy={loadingProvider === 'google'}
        >
          {loadingProvider === 'google' ? (
            <Spinner />
          ) : (
            <GoogleIcon aria-hidden="true" style={{ width: 16, height: 16 }} />
          )}
          <span>Continue with Google</span>
        </button>
      )}
      {microsoftConfigured && (
        <button
          type="button"
          className="sso-btn"
          onClick={handleMicrosoftSignIn}
          disabled={isLoading}
          aria-busy={loadingProvider === 'microsoft'}
        >
          {loadingProvider === 'microsoft' ? (
            <Spinner />
          ) : (
            <MicrosoftIcon aria-hidden="true" style={{ width: 16, height: 16 }} />
          )}
          <span>Continue with Microsoft</span>
        </button>
      )}
    </>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        border: '2px solid var(--line)',
        borderTopColor: 'var(--ink)',
        animation: 'sign-spin 0.8s linear infinite',
      }}
    />
  );
}
