import { isLocalDemo } from '@/lib/local-demo';

const PUBLIC_API_PREFIXES = ['/api/auth', '/api/sign', '/api/documents/proxy'];

export function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function mustHaveRateLimiter(pathname: string, environment: string | undefined): boolean {
  // The packaged evaluation runs as a production build for responsive navigation,
  // but is explicitly restricted to loopback services by isLocalDemo(). It has no
  // public ingress, so requiring a hosted Redis service would make local PDF
  // previews and signing links fail with a 503.
  return environment === 'production' && !isLocalDemo() && isPublicApiRoute(pathname);
}
