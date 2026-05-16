#!/usr/bin/env node
// Non-destructive duplicate audit script.
//
// Usage:
//   npx tsx scripts/audit-duplicates.ts
//
// Reads DATABASE_URL from .env.local, connects via @neondatabase/serverless,
// computes a dedupe_key for every active entry using the same algorithm as
// the push route, then reports semantic duplicate groups without writing anything.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { buildDedupeKey } from '../src/lib/sync/dedupe-key.ts';

// ── Load .env.local ────────────────────────────────────────────────────────────

function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env.local');
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local not found — rely on environment variables already set
  }
}

loadEnv();

// ── Types ──────────────────────────────────────────────────────────────────────

interface DbEntry {
  id:        string;
  user_id:   string;
  type:      string;
  title:     string;
  text:      string;
  date:      string | null;
  entry_time: string | null;
  amount:    number | null;
  metadata:  unknown;
  dedupe_key: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface DuplicateGroup {
  dedupeKey:  string;
  userId:     string;
  entries:    DbEntry[];
  canonical:  DbEntry;
  duplicates: DbEntry[];
}

// ── Canonical winner logic (mirrors repair script) ─────────────────────────────

function pickCanonical(group: DbEntry[]): DbEntry {
  // 1. Prefer non-deleted entries
  // 2. Among equals: most recently updated
  // 3. Among equals: richer metadata (non-null wins)
  return group.slice().sort((a, b) => {
    if (!a.deleted_at && b.deleted_at) return -1;
    if (a.deleted_at && !b.deleted_at) return 1;
    const aUpdated = new Date(a.updated_at).getTime();
    const bUpdated = new Date(b.updated_at).getTime();
    if (bUpdated !== aUpdated) return bUpdated - aUpdated;
    const aMeta = a.metadata != null ? 1 : 0;
    const bMeta = b.metadata != null ? 1 : 0;
    return bMeta - aMeta;
  })[0];
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const databaseUrl =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.NEON_DATABASE_URL;

  if (!databaseUrl) {
    console.error('ERROR: No database URL found. Set DATABASE_URL in .env.local or environment.');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  console.log('Fetching all active entries…');
  const rows = await sql`
    SELECT id, user_id, type, title, text, date, entry_time, amount, metadata,
           dedupe_key, created_at, updated_at, deleted_at
      FROM entries
     WHERE deleted_at IS NULL
     ORDER BY user_id, created_at
  ` as DbEntry[];

  console.log(`  ${rows.length} active entries across all users\n`);

  // Group by computed dedupe_key (authoritative; ignores stored dedupe_key)
  const grouped = new Map<string, DbEntry[]>();
  let missingKey = 0;

  for (const row of rows) {
    const key = buildDedupeKey({
      userId:    row.user_id,
      type:      row.type,
      title:     row.title,
      text:      row.text,
      date:      row.date,
      entryTime: row.entry_time,
      amount:    row.amount,
    });
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
    if (!row.dedupe_key) missingKey++;
  }

  // Find semantic duplicate groups (>1 entry per key)
  const duplicateGroups: DuplicateGroup[] = [];
  for (const [dedupeKey, entries] of grouped) {
    if (entries.length <= 1) continue;
    const canonical  = pickCanonical(entries);
    const duplicates = entries.filter(e => e.id !== canonical.id);
    duplicateGroups.push({
      dedupeKey,
      userId: entries[0].user_id,
      entries,
      canonical,
      duplicates,
    });
  }

  // ── Report ─────────────────────────────────────────────────────────────────

  const affectedUsers = new Set(duplicateGroups.map(g => g.userId)).size;
  const totalDuplicates = duplicateGroups.reduce((n, g) => n + g.duplicates.length, 0);

  console.log('── Summary ──────────────────────────────────────────────────');
  console.log(`  Total active entries:   ${rows.length}`);
  console.log(`  Without dedupe_key:     ${missingKey} (will be backfilled on next push)`);
  console.log(`  Duplicate groups:       ${duplicateGroups.length}`);
  console.log(`  Entries to soft-delete: ${totalDuplicates}`);
  console.log(`  Users affected:         ${affectedUsers}`);
  console.log('─────────────────────────────────────────────────────────────\n');

  if (duplicateGroups.length === 0) {
    console.log('No semantic duplicates found.');
    return;
  }

  for (const group of duplicateGroups) {
    console.log(`\nGroup key: ${group.dedupeKey}  user: ${group.userId.slice(0, 12)}…`);
    console.log(`  Canonical → ${group.canonical.id}`);
    console.log(`             type:${group.canonical.type}  title:"${group.canonical.title}"  date:${group.canonical.date ?? '—'}  updated:${group.canonical.updated_at}`);
    for (const dup of group.duplicates) {
      console.log(`  Duplicate  ${dup.id}`);
      console.log(`             type:${dup.type}  title:"${dup.title}"  date:${dup.date ?? '—'}  updated:${dup.updated_at}`);
    }
  }

  console.log('\nNo changes written. Run scripts/repair-duplicates.ts --apply to soft-delete duplicates.');
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
