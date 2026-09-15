'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { handleSignOut } from '@/server/auth/sign-out';
import { type Crumb, useBreadcrumb } from './breadcrumb-context';
import {
  IconDashboard,
  IconInbox,
  IconMenu,
  IconMoon,
  IconSend,
  IconSent,
  IconSigned,
  IconSignOut,
  IconSun,
  IconTemplates,
  IconTrash,
} from './icons';
import { useTweaks } from './tweaks/tweaks-context';
import { TweaksPanel } from './tweaks/tweaks-panel';

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  count?: number;
};

export function AppFrame({
  user,
  inboxCount,
  children,
}: {
  user: { name: string; email: string; plan?: string };
  inboxCount?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { tweaks, setTweak } = useTweaks();
  const { crumbs } = useBreadcrumb();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const onSignOut = async () => {
    try {
      setIsSigningOut(true);
      await handleSignOut();
      router.push('/login');
    } catch (error) {
      console.error('Failed to sign out:', error);
      setIsSigningOut(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: react to path
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const items: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: <IconDashboard /> },
    { href: '/inbox', label: 'Inbox', icon: <IconInbox />, count: inboxCount },
    { href: '/send', label: 'Send', icon: <IconSend /> },
    { href: '/documents', label: 'Sent', icon: <IconSent /> },
    { href: '/signed', label: 'Signed', icon: <IconSigned /> },
    { href: '/templates', label: 'Templates', icon: <IconTemplates /> },
    { href: '/trash', label: 'Trash', icon: <IconTrash /> },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Auto-derive the current page's breadcrumb label from the nav items
  // when the page hasn't set crumbs explicitly via useBreadcrumb().
  const autoCrumbs: Crumb[] =
    crumbs.length > 0
      ? crumbs
      : (() => {
          const match = items.find((it) => isActive(it.href));
          return match ? [{ label: match.label }] : [];
        })();

  const initials =
    user.name
      .split(' ')
      .map((s) => s[0] ?? '')
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  return (
    <div className="app-frame">
      <div
        className={`app-sidebar-backdrop${menuOpen ? ' open' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <aside className={`app-sidebar${menuOpen ? ' open' : ''}`}>
        <Link href="/dashboard" className="brand">
          <span className="dot" />
          Resident Interface
        </Link>
        <nav className="app-sidebar-nav">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={isActive(item.href) ? 'active' : ''}>
              {item.icon}
              <span>{item.label}</span>
              {item.count !== undefined && item.count > 0 && <span className="nav-count">{item.count}</span>}
            </Link>
          ))}
        </nav>
        <div className="app-sidebar-foot">
          <div className="avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--ink)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user.name}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-4)' }}>{user.plan ?? user.email}</div>
          </div>
          <button
            type="button"
            className="signout-btn"
            onClick={onSignOut}
            disabled={isSigningOut}
            aria-label="Sign out"
            title="Sign out"
          >
            <IconSignOut aria-hidden="true" />
          </button>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-topbar">
          <button
            type="button"
            className="menu-button"
            aria-label="Open menu"
            onClick={() => setMenuOpen((o) => !o)}
            style={{ marginRight: 'var(--space-3)' }}
          >
            <IconMenu />
          </button>
          <div className="breadcrumb" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <Link href="/dashboard">Resident Interface</Link>
            {autoCrumbs.map((c, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable
              <span key={i} style={{ display: 'contents' }}>
                <span className="sep">›</span>
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span className="current">{c.label}</span>}
              </span>
            ))}
          </div>
          <div className="app-topbar-right">
            <TweaksPanel />
            <button
              type="button"
              className="theme-toggle"
              aria-label="Toggle theme"
              onClick={() => setTweak('dark', !tweaks.dark)}
            >
              {tweaks.dark ? <IconSun /> : <IconMoon />}
            </button>
          </div>
        </div>
        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}
