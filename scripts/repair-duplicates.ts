#!/usr/bin/env node
// Safe duplicate repair script — soft-deletes semantic duplicates in cloud DB.
//
// Usage:
//   npx tsx scripts/repair-duplicates.ts           # dry-run (no writes)
//   npx tsx scripts/repair-duplicates.ts --apply   # commit changes
//
// Safety guarantees:
//   - Never hard-deletes any row
//   - Never merges entries across different user_id values
//   - Only soft-deletes rows that share a computed dedupe_key with a canonical winner
//   - Canonical winner: non-deleted first → most recently updated → richest metadata
//   - Dry-run is the default; --apply flag required to write

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
  id:         string;
  user_id:    string;
  type:       string;
  title:      string;
  text:       string;
  date:       string | null;
  entry_time: string | null;
  amount:     number | null;
  metadata:   unknown;
  updated_at: string;
  deleted_at: string | null;
}

// ── Canonical winner logic ─────────────────────────────────────────────────────

function pickCanonical(group: DbEntry[]): DbEntry {
  return group.slice().sort((a, b) => {
    // 1. Non-deleted wins over soft-deleted
    if (!a.deleted_at && b.deleted_at) return -1;
    if (a.deleted_at && !b.deleted_at) return 1;
    // 2. Most recently updated
    const aUpdated = new Date(a.updated_at).getTime();
    const bUpdated = new Date(b.updated_at).getTime();
    if (bUpdated !== aUpdated) return bUpdated - aUpdated;
    // 3. Richer metadata (non-null wins)
    const aMeta = a.metadata != null ? 1 : 0;
    const bMeta = b.metadata != null ? 1 : 0;
    return bMeta - aMeta;
  })[0];
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const applyFlag = process.argv.includes('--apply');

  const databaseUrl =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.NEON_DATABASE_URL;

  if (!databaseUrl) {
    console.error('ERROR: No database URL found. Set DATABASE_URL in .env.local or environment.');
    process.exit(1);
  }

  if (!applyFlag) {
    console.log('[DRY RUN] No changes will be written. Pass --apply to commit.\n');
  } else {
    console.log('[APPLY MODE] Changes will be written to the database.\n');
  }

  const sql = neon(databaseUrl);

  console.log('Fetching all active entries…');
  const rows = await sql`
    SELECT id, user_id, type, title, text, date, entry_time, amount, metadata,
           updated_at, deleted_at
      FROM entries
     WHERE deleted_at IS NULL
     ORDER BY user_id, updated_at DESC
  ` as DbEntry[];

  console.log(`  ${rows.length} active entries fetched\n`);

  // Group by computed dedupe_key
  const grouped = new Map<string, DbEntry[]>();
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
  }

  // Collect duplicate IDs to soft-delete
  const toSoftDelete: string[] = [];

  for (const [, entries] of grouped) {
    if (entries.length <= 1) continue;
    const canonical  = pickCanonical(entries);
    const duplicates = entries.filter(e => e.id !== canonical.id);

    console.log(`Duplicate group — canonical: ${canonical.id} (${canonical.type} "${canonical.title}")`);
    for (const dup of duplicates) {
      console.log(`  will soft-delete: ${dup.id} (updated: ${dup.updated_at})`);
      toSoftDelete.push(dup.id);
    }
  }

  if (toSoftDelete.length === 0) {
    console.log('\nNo duplicates found. Nothing to repair.');
    return;
  }

  console.log(`\nTotal entries to soft-delete: ${toSoftDelete.length}`);

  if (!applyFlag) {
    console.log('\n[DRY RUN] Skipped writes. Re-run with --apply to commit.');
    return;
  }

  // Soft-delete in batches of 100 to avoid huge IN() clauses
  const BATCH = 100;
  const now = new Date().toISOString();
  let deleted = 0;

  for (let i = 0; i < toSoftDelete.length; i += BATCH) {
    const batch = toSoftDelete.slice(i, i + BATCH);
    // Neon serverless driver: use tagged template literal with array
    await sql`
      UPDATE entries
         SET deleted_at = ${now}
       WHERE id = ANY(${batch}::text[])
         AND deleted_at IS NULL
    `;
    deleted += batch.length;
    console.log(`  Soft-deleted batch ${Math.floor(i / BATCH) + 1}: ${batch.length} rows`);
  }

  console.log(`\nDone. ${deleted} duplicate entries soft-deleted.`);
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
