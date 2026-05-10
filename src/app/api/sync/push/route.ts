import { auth } from '@clerk/nextjs/server';
import { upsertEntries, upsertChecklistItems } from '@/db/cloud/queries';
import type { EntryPayload, ChecklistItemPayload } from '@/lib/sync/types';
import type { CloudEntryInsert, CloudChecklistItemInsert } from '@/db/cloud/schema';

function entryToInsert(userId: string, p: EntryPayload): CloudEntryInsert {
  return {
    id:        p.localId,
    userId,
    text:      p.text,
    type:      p.type,
    title:     p.title,
    date:      p.date ?? null,
    entryTime: p.entryTime ?? null,
    tags:      JSON.stringify(p.tags),
    done:      p.done,
    amount:    p.amount ?? null,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
    deletedAt: null,
  };
}

function checklistItemToInsert(userId: string, p: ChecklistItemPayload): CloudChecklistItemInsert {
  return {
    id:        p.localId,
    entryId:   p.localEntryId,
    userId,
    label:     p.label,
    checked:   p.checked,
    category:  p.category ?? null,
    sortOrder: p.sortOrder ?? 0,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
    deletedAt: p.deletedAt ? new Date(p.deletedAt) : null,
  };
}

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { entries: EntryPayload[]; checklistItems?: ChecklistItemPayload[] };
  try {
    body = await req.json() as typeof body;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.entries)) {
    return Response.json({ error: 'entries must be an array' }, { status: 400 });
  }

  const entryRows = body.entries.map((p) => entryToInsert(userId, p));
  const itemRows  = (body.checklistItems ?? []).map((p) => checklistItemToInsert(userId, p));

  await Promise.all([
    upsertEntries(entryRows),
    upsertChecklistItems(itemRows),
  ]);

  return Response.json({ ok: true, entries: entryRows.length, checklistItems: itemRows.length });
}
