# Architecture

## Current Stack
- **Frontend**: Next.js / React
- **Local DB**: Dexie.js (IndexedDB wrapper)
- **Remote DB**: Neon (Serverless Postgres)
- **ORM**: Drizzle ORM
- **Auth**: Clerk

## Client/Server Separation
- **Client**: Handles UI, local state, and offline storage via Dexie. Operations are fast and local.
- **Server**: Handles cloud sync, remote database operations via Drizzle/Neon, and secure API routes.

## Frontend/Backend Flow
1. User interacts with the UI (Client).
2. Changes are immediately written to the local Dexie database (Offline-First).
3. The Sync Engine runs in the background to push local changes to the server and pull remote updates.

## Offline-First Philosophy
The application is designed to be fully functional without an internet connection. Read and write operations are performed against the local Dexie database first, ensuring zero latency and high availability regardless of network conditions.

## Why Dexie
Dexie provides a robust, developer-friendly wrapper around IndexedDB, making it easier to manage complex local schemas, indices, and reactive queries necessary for an offline-first experience.

## Why Neon
Neon offers a serverless Postgres architecture that scales automatically and provides features like branching, making it an excellent fit for modern edge-compatible web applications and seamless Drizzle integration.

## Why Clerk
Clerk provides comprehensive, drop-in authentication and user management that integrates perfectly with Next.js App Router and middleware, simplifying secure access to our sync APIs.
