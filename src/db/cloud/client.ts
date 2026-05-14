// Server-only — never import this from client components.
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

type CloudDb = ReturnType<typeof drizzle<typeof schema>>;

let cloudDb: CloudDb | null = null;

function getDatabaseUrl(): string {
  const databaseUrl =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.NEON_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'Missing database connection string. Set DATABASE_URL, POSTGRES_URL, or NEON_DATABASE_URL.',
    );
  }

  return databaseUrl;
}

export function getCloudDb(): CloudDb {
  if (cloudDb) return cloudDb;

  const sql = neon(getDatabaseUrl());
  cloudDb = drizzle(sql, { schema });

  return cloudDb;
}
