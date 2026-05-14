import { clerkMiddleware } from '@clerk/nextjs/server';

// Runs Clerk session validation on every request.
// Individual API route handlers check auth() themselves.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals, static assets, and PWA files
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|workbox-.*\\.js|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
