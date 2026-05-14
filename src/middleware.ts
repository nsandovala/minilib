import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/home',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/manifest.json',
  '/sw.js',
  '/favicon.ico',
  '/icons(.*)',
  '/_next(.*)',
]);

const runClerkAuth = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

function getMissingClerkEnv(): string[] {
  const missing: string[] = [];

  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()) {
    missing.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
  }

  if (!process.env.CLERK_SECRET_KEY?.trim()) {
    missing.push('CLERK_SECRET_KEY');
  }

  return missing;
}

function buildMissingEnvMessage(missing: string[]): string {
  return `Clerk middleware disabled: missing ${missing.join(', ')}.`;
}

function buildMissingEnvResponse(request: NextRequest, missing: string[]): NextResponse {
  const message = buildMissingEnvMessage(missing);
  const isApiRequest =
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/trpc/');

  if (isApiRequest) {
    return NextResponse.json(
      { error: message },
      { status: 503, headers: { 'x-auth-warning': message } },
    );
  }

  return new NextResponse(message, {
    status: 503,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-auth-warning': message,
    },
  });
}

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl?.pathname;

  if (!pathname) {
    return new NextResponse('Invalid middleware request URL.', { status: 400 });
  }

  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  const missingClerkEnv = getMissingClerkEnv();
  if (missingClerkEnv.length > 0) {
    return buildMissingEnvResponse(request, missingClerkEnv);
  }

  try {
    return await runClerkAuth(request, event);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Clerk middleware error.';
    console.error('[middleware] Clerk failure:', message);

    return new NextResponse(`Clerk middleware failed: ${message}`, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|workbox-.*\\.js|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
    '/(api|trpc)(.*)',
  ],
};
