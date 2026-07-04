import { auth } from '@/server/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public paths — no auth required
  // All /api routes bypass NextAuth here because:
  // - tRPC procedures re-enforce auth internally via protectedProcedure/adminProcedure
  // - /api/invite/[token] and /api/orgs/register are intentionally public
  // - /api/auth/* is required for NextAuth callbacks
  // Any future /api route without in-handler auth will be silently unprotected.
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/invite/') ||
    pathname === '/favicon.ico' ||
    pathname === '/login' ||
    pathname === '/register'
  ) {
    // Redirect authenticated users away from auth pages
    if (req.auth && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (!req.auth) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
