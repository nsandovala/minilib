# Authentication

## Overview
We use Clerk for handling user authentication and identity management.

## Clerk v6
The project leverages Clerk v6, utilizing the latest App Router integration and React server components.

## Middleware
Clerk's middleware is configured to protect specific routes and API endpoints, ensuring only authenticated users can access the sync engine and their data.

## Providers
- Configured via the Clerk dashboard (e.g., Email/Password, Google).

## Environment Vars
The following environment variables are required for Clerk to function:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

## Protected Routes
- All `/api/sync/*` routes are strictly protected.
- App routes displaying user data require a valid session.
