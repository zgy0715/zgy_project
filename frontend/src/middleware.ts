import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public paths that don't require authentication
const publicPaths = ['/', '/auth/login', '/auth/register', '/auth/forgot-password'];

// Only real static assets may skip the auth gate. A blanket `pathname.includes('.')`
// let any dotted dashboard path (e.g. /dashboard/foo.bar) bypass authentication.
const STATIC_FILE_PATTERN =
  /\.(?:ico|png|jpe?g|gif|svg|webp|avif|css|js|mjs|map|txt|xml|json|woff2?|ttf|otf|eot)$/i;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname === p)) {
    return NextResponse.next();
  }

  // /api/docs reads files out of the repository, so it must NOT inherit the
  // blanket API exemption below. Gate it on the same cookie as the dashboard.
  if (pathname.startsWith('/api/docs')) {
    if (request.cookies.get('deepagent_authenticated')?.value !== 'true') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Allow static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    STATIC_FILE_PATTERN.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie set by auth-store on successful login
  const authCookie = request.cookies.get('deepagent_authenticated')?.value;

  if (!authCookie || authCookie !== 'true') {
    // Not authenticated — redirect to login with callback
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Set security headers on all authenticated responses
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
