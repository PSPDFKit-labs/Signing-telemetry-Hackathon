'use client';

import { ErrorBoundary } from '@/components/auth/error-boundary';
import { FallbackOAuthButtons } from '@/components/auth/fallback-oauth-buttons';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { NutrientLogo } from '@/components/icons';
import { IconMoon, IconSun } from '@/components/sign-design/icons';
import { useTweaks } from '@/components/sign-design/tweaks/tweaks-context';
import { handleSignin } from '@/server/auth/sign-in';

interface LoginPageContentProps {
  localDemo?: boolean;
  googleConfigured: boolean;
  microsoftConfigured: boolean;
}

export function LoginPageContent({ googleConfigured, microsoftConfigured, localDemo = false }: LoginPageContentProps) {
  const { tweaks, setTweak } = useTweaks();
  const hasProvider = googleConfigured || microsoftConfigured;

  return (
    <div className="login-page">
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <button
          type="button"
          className="theme-toggle"
          aria-label="Toggle theme"
          onClick={() => setTweak('dark', !tweaks.dark)}
        >
          {tweaks.dark ? <IconSun /> : <IconMoon />}
        </button>
      </div>

      <div className="brand-stack" style={{ gap: 10 }}>
        <span
          style={{
            width: 30,
            height: 30,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 8,
            background: 'var(--ink)',
            color: 'var(--bg)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          RI
        </span>
        <span style={{ display: 'grid', gap: 1 }}>
          <strong style={{ fontSize: 14 }}>Resident Interface</strong>
          <small
            style={{
              color: 'var(--ink-4)',
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              fontWeight: 500,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
            }}
          >
            Agreement execution
          </small>
        </span>
      </div>

      <div className="login-card">
        <div
          style={{
            width: 36,
            height: 36,
            display: 'grid',
            placeItems: 'center',
            marginBottom: 18,
            borderRadius: 9,
            background: 'var(--brand-accent-tint)',
            color: 'var(--brand-accent)',
          }}
        >
          <NutrientLogo aria-hidden="true" style={{ width: 20, height: 'auto' }} />
        </div>
        <h1>{localDemo ? 'Resident Interface evaluation sample' : 'Open the sender workspace'}</h1>
        <p>
          {localDemo
            ? 'This is a local sample implementation for testing the agreement workflow.'
            : 'Use an authorized Resident Interface or Nutrient account to manage the agreement workflow.'}
        </p>
        {localDemo ? (
          <>
            <button type="button" className="btn" onClick={() => handleSignin({ provider: 'local-demo' })}>
              Open sample workspace
            </button>
            <p style={{ marginTop: 14, color: 'var(--ink-3)', fontSize: 'var(--text-xs)', lineHeight: 1.5 }}>
              Sample login only. Before deployment, wire this entry point to Resident Interface authentication and services.
            </p>
          </>
        ) : hasProvider ? (
          <ErrorBoundary
            fallback={
              <FallbackOAuthButtons
                callbackUrl="/dashboard"
                googleConfigured={googleConfigured}
                microsoftConfigured={microsoftConfigured}
              />
            }
          >
            <OAuthButtons
              callbackUrl="/dashboard"
              googleConfigured={googleConfigured}
              microsoftConfigured={microsoftConfigured}
            />
          </ErrorBoundary>
        ) : (
          <div
            role="status"
            style={{
              padding: 14,
              border: '1px solid color-mix(in srgb, #b7791f 30%, var(--line))',
              borderRadius: 'var(--r-2)',
              background: 'color-mix(in srgb, #b7791f 7%, var(--surface))',
            }}
          >
            <strong style={{ display: 'block', fontSize: 11, color: 'var(--ink)' }}>
              Local sign-in is not configured
            </strong>
            <span style={{ display: 'block', marginTop: 4, color: 'var(--ink-3)', fontSize: 10, lineHeight: 1.5 }}>
              Add an OAuth provider and database connection to open the live workspace.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
