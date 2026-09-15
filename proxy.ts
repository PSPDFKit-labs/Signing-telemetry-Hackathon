import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isPublicApiRoute, mustHaveRateLimiter } from '@/lib/api-route-security';
import { getLimiterForRoute } from '@/lib/rate-limit';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- API route protection and rate limiting ---
  if (pathname.startsWith('/api')) {
    const isPublic = isPublicApiRoute(pathname);

    // Check auth for non-public API routes via session token cookie
    if (!isPublic) {
      const hasSession =
        request.cookies.has('authjs.session-token') || request.cookies.has('__Secure-authjs.session-token');
      if (!hasSession) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Rate limiting — key by session cookie or IP
    const limiter = getLimiterForRoute(pathname);
    if (!limiter && mustHaveRateLimiter(pathname, process.env.NODE_ENV)) {
      return NextResponse.json({ error: 'Rate limiting is not configured' }, { status: 503 });
    }
    if (limiter) {
      const key =
        request.cookies.get('authjs.session-token')?.value ||
        request.cookies.get('__Secure-authjs.session-token')?.value ||
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        'anonymous';

      const { success } = await limiter.limit(key);
      if (!success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      }
    }

    return NextResponse.next();
  }

  // --- Non-API routes: cache control headers ---
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}

export const config = {
  matcher: [
    // API routes (auth + rate limiting)
    '/api/:path*',
    // Non-API routes (cache headers) — exclude static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
