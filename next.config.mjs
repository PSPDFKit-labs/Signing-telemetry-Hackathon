/** @type {import('next').NextConfig} */

const localStorageOrigin =
  process.env.NODE_ENV !== 'production' && process.env.LOCAL_DEMO === 'true' ? 'http://127.0.0.1:19000' : '';
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' cdn.cloud.pspdfkit.com cdn.cloud.nutrient.io;
  style-src 'self' 'unsafe-inline' cdn.cloud.pspdfkit.com cdn.cloud.nutrient.io;
  img-src 'self' data: blob: lh3.googleusercontent.com;
  font-src 'self' data: cdn.cloud.pspdfkit.com cdn.cloud.nutrient.io;
  connect-src 'self' data: blob: cdn.cloud.pspdfkit.com cdn.cloud.nutrient.io *.s3.us-east-1.amazonaws.com ${localStorageOrigin};
  worker-src 'self' blob:;
  child-src 'self' blob:;
  frame-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`;

export function parseEmbedOrigins(value) {
  return value
  .split(/[\s,]+/)
  .filter(Boolean)
  .flatMap((candidate) => {
    try {
      const url = new URL(candidate);
      const allowedProtocol = url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
      const exactOrigin = !url.username && !url.password && url.pathname === '/' &&
        !url.search && !url.hash && !url.hostname.includes('*');
      return allowedProtocol && exactOrigin ? [url.origin] : [];
    } catch {
      return [];
    }
  });
}
const configuredEmbedOrigins = parseEmbedOrigins(process.env.EMBED_ALLOWED_ORIGINS || '');
const embedFrameAncestors = ["'self'", ...new Set(configuredEmbedOrigins)].join(' ');
const EmbedContentSecurityPolicy = ContentSecurityPolicy.replace(
  "frame-ancestors 'none';",
  `frame-ancestors ${embedFrameAncestors};`,
);

const commonSecurityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
];

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim(),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  ...commonSecurityHeaders,
];

const embedSecurityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: EmbedContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim(),
  },
  ...commonSecurityHeaders,
];

const nextConfig = {
  poweredByHeader: false,
  // The local evaluation should look like the product, not a development tool.
  // Runtime and build errors still surface normally in the browser and terminal.
  devIndicators: false,
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // Next 16.3 writes AGENTS.md and CLAUDE.md into the project root on `next dev`.
  // Disabled so the dev server never creates or overwrites agent instruction
  // files in this repo or in a fork of it. Set to true if you want them.
  agentRules: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Optimize package imports to avoid barrel file imports (200-800ms savings)
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      {
        source: '/:path((?!embed/sign(?:/|$)).*)',
        headers: securityHeaders,
      },
      {
        source: '/embed/sign/:path*',
        headers: embedSecurityHeaders,
      },
    ];
  },
  // Set output for Docker/containerized deployments if needed
  // output: 'standalone',
};

export default nextConfig;
