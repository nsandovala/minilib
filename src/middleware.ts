import { clerkMiddleware } from '@clerk/nextjs/server';

// Runs Clerk session validation on every request.
// Individual API route handlers check auth() themselves.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
