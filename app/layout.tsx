import { bodyAttributes } from '@zero-ui/attributes';
import '@/styles/globals.css';
import '@/styles/sign-design.css';
import '@/styles/resident-interface-brand.css';
import type { Metadata } from 'next';
import { Caveat, Fraunces, Geist, Geist_Mono, Instrument_Serif, Open_Sans } from 'next/font/google';
import Script from 'next/script';
import { SessionProvider } from 'next-auth/react';
import { BreadcrumbProvider } from '@/components/sign-design/breadcrumb-context';
import { TweaksProvider } from '@/components/sign-design/tweaks/tweaks-context';
import ThemeManager from '@/components/theme-manager';
import { Toaster } from '@/components/ui/toaster';

const nutrientSdkVersion = process.env.NEXT_PUBLIC_NUTRIENT_SDK_VERSION || '1.19.0';
const nutrientSdkUrl = `https://cdn.cloud.nutrient.io/pspdfkit-web@${nutrientSdkVersion}/nutrient-viewer.js`;

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument-serif',
});
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
});
const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-signature',
});
const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-open-sans',
});

const fontVariables = [
  geist.variable,
  geistMono.variable,
  instrumentSerif.variable,
  fraunces.variable,
  caveat.variable,
  openSans.variable,
].join(' ');

const tweaksPrePaintScript = `(function(){try{var s=localStorage.getItem('nutrient-sign:tweaks');var t=s?JSON.parse(s):null;var d=t&&typeof t==='object'?t:{};var theme=d.dark===true?'dark':'light';var html=document.documentElement;html.setAttribute('data-theme',theme);html.setAttribute('data-palette',d.palette||'cool');html.setAttribute('data-type',d.type||'technical');html.setAttribute('data-density',d.density||'balanced');html.setAttribute('data-radius',d.radius||'soft');var a=d.accent||'#5EC6C1';html.style.setProperty('--brand-accent',a);html.style.setProperty('--brand-accent-2','color-mix(in srgb, '+a+' 70%, white)');html.style.setProperty('--brand-accent-tint','color-mix(in srgb, '+a+' 12%, transparent)');try{localStorage.setItem('theme-preference',theme);}catch(e){}}catch(e){}})()`;

const tweaksBodyAlignScript = `(function(){try{var theme=document.documentElement.getAttribute('data-theme')||'light';if(document.body){document.body.setAttribute('data-theme',theme);}}catch(e){}})()`;

export const metadata: Metadata = {
  title: 'Resident Interface — Agreement Operations Demo',
  description: 'Resident agreement preparation, execution, and return workflow powered by Nutrient.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const content = (
    <TweaksProvider>
      <BreadcrumbProvider>{children}</BreadcrumbProvider>
    </TweaksProvider>
  );

  return (
    <html lang="en" className={fontVariables} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <Script id="tweaks-pre-paint" strategy="beforeInteractive">
          {tweaksPrePaintScript}
        </Script>
      </head>
      <body {...bodyAttributes} suppressHydrationWarning>
        <Script id="tweaks-body-align" strategy="beforeInteractive">
          {tweaksBodyAlignScript}
        </Script>
        <Script id="nutrient-viewer-sdk" src={nutrientSdkUrl} strategy="beforeInteractive" />
        <ThemeManager />
        {process.env.AUTH_SECRET ? <SessionProvider>{content}</SessionProvider> : content}
        <Toaster />
      </body>
    </html>
  );
}
