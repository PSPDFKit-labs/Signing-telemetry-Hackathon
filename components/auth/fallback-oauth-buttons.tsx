'use client';

import { useState } from 'react';
import { GoogleIcon, MicrosoftIcon } from '@/components/icons';

interface FallbackOAuthButtonsProps {
  callbackUrl?: string;
  googleConfigured?: boolean;
  microsoftConfigured?: boolean;
}

export function FallbackOAuthButtons({
  callbackUrl = '/dashboard',
  googleConfigured = true,
  microsoftConfigured = true,
}: FallbackOAuthButtonsProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    window.location.href = callbackUrl;
  };

  const handleMicrosoftSignIn = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    window.location.href = callbackUrl;
  };

  return (
    <>
      {googleConfigured && (
        <button
          type="button"
          className="sso-btn"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? <Spinner /> : <GoogleIcon aria-hidden="true" style={{ width: 16, height: 16 }} />}
          <span>Continue with Google</span>
        </button>
      )}
      {microsoftConfigured && (
        <button
          type="button"
          className="sso-btn"
          onClick={handleMicrosoftSignIn}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? <Spinner /> : <MicrosoftIcon aria-hidden="true" style={{ width: 16, height: 16 }} />}
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
