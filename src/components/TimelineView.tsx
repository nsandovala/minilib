'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { TimelineEntry, ChecklistItem, EntryType, ShoppingMetadata } from '@/types';
import { toggleEntryDone, deleteEntry, updateEntry, reparseAndUpdateEntry, toggleShoppingItem } from '@/db/entries';
import { toggleChecklistItem } from '@/db/checklist';
import { db } from '@/db';
import { recordBelongsToActiveUser } from '@/lib/local-user';
import { groupEntriesForCognitiveTimeline, getMicrocopy, type CognitiveGroupKey } from '@/core/agents/timeline-agent';
import { getAgentForType } from '@/core/card-agents';
import {
  formatRelativeDate,
  formatCLP,
  isOverdue as checkOverdue,
  getEntryDisplayType,
  getEntryDisplayTitle,
  getEntryPriority,
  getEntryNextStep,
  getFinancialDirection,
  getFinancialCategory,
  getEntryStorageKey,
  isEntryPinned,
  toggleEntryPinned,
  getShoppingStage,
} from '@/lib/entries';

interface TimelineViewProps {
  entries: TimelineEntry[];
  onRefresh: () => void;
}

const TYPE_COLORS: Record<EntryType, string> = {
  payment:       '#c9a882',
  health:        '#7a9e7e',
  appointment:   '#7a9e7e',
  reminder:      '#b8944e',
  task:          'rgba(245,240,235,0.45)',
  pet:           '#c9a882',
  note:          'rgba(245,240,235,0.34)',
  shopping_list: '#8faa8b',
};

const PRIORITY_DOT = {
  normal:    'rgba(245,240,235,0.2)',
  important: '#c9a882',
  urgent:    '#c47070',
};

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
  return color;
}

function getChecklistCategory(entry: TimelineEntry): string {
  const meta = entry.metadata as ShoppingMetadata | undefined;
  if (meta?.listKind === 'shopping') {
    const map: Record<string, string> = {
      supermercado: 'Supermercado',
      feria: 'Feria',
      farmacia: 'Farmacia',
      otro: 'Otro',
    };
    return map[meta.storeType] ?? 'Supermercado';
  }
  const tags = entry.detectedTags ?? [];
  if (tags.includes('aseo hogar') || tags.includes('casa')) return 'Casa';
  if (tags.includes('farmacia')) return 'Farmacia';
  if (tags.includes('mascotas')) return 'Mascotas';
  return 'Supermercado';
}

function isMetadataShopping(entry: TimelineEntry): boolean {
  return (entry.metadata as ShoppingMetadata | undefined)?.listKind === 'shopping';
}

function getShoppingMetadata(entry: TimelineEntry): ShoppingMetadata | undefined {
  return entry.metadata as ShoppingMetadata | undefined;
}

function getPaymentTitle(entry: TimelineEntry): string {
  const title = getEntryDisplayTitle(entry);
  return title
    .replace(/^pagar\s+/i, '')
    .replace(/^pago\s+/i, '')
    .replace(/^ingreso\s+/i, '')
    .trim() || title;
}

function getWhenLabel(entry: TimelineEntry): string {
  return [entry.date ? formatRelativeDate(entry.date) : null, entry.time ?? null]
    .filter(Boolean)
    .join(' · ');
}

function getPaymentStatus(entry: TimelineEntry): string {
  if (entry.done) return getFinancialDirection(entry) === 'income' ? 'recibido' : 'pagado';
  if (checkOverdue(entry)) return 'vencido';
  return 'pendiente';
}

function getDetailOriginal(entry: TimelineEntry): string {
  const original = entry.text.trim();
  const title = getEntryDisplayTitle(entry).trim().toLowerCase();
  if (!original || original.toLowerCase() === title) return '';
  return original;
}

// ─── Progress label for shopping lists ───────────────────────────────────────

function ProgressLabel({
  total,
  checked,
  totalEstimated,
  totalChecked,
}: {
  total: number;
  checked: number;
  totalEstimated?: number;
  totalChecked?: number;
}) {
  if (total === 0) return null;

  const stage = getShoppingStage(checked, total);
  const color = stage === 'completed' ? '#7a9e7e' : stage === 'shopping' ? '#c9a882' : 'var(--text-muted)';

  const hasMoney = typeof totalEstimated === 'number' && totalEstimated > 0;

  return (
    <span
      style={{
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        color,
        fontWeight: stage === 'completed' ? 600 : 400,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      {stage === 'completed'
        ? `✓ Completado`
        : `${checked}/${total} listo${checked !== 1 ? 's' : ''}`}
      {hasMoney && (
        <span style={{ color: '#c9a882', fontWeight: 500 }}>
          {typeof totalChecked === 'number' && totalChecked > 0
            ? `${formatCLP(totalChecked)} / ${formatCLP(totalEstimated)}`
            : formatCLP(totalEstimated)}
        </span>
      )}
    </span>
  );
}

// ─── Interactive checklist (expanded) ────────────────────────────────────────

interface ChecklistRowProps {
  item: ChecklistItem;
  onToggle: (id: number, checked: boolean) => void;
}

function ChecklistRow({ item, onToggle }: ChecklistRowProps) {
  return (
    <button
      type="button"
      onClick={() => item.id !== undefined && onToggle(item.id, !item.checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'transparent',
        border: 'none',
        padding: '4px 0',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '4px',
          border: `1.5px solid ${item.checked ? '#7a9e7e' : 'rgba(255,248,240,0.18)'}`,
          background: item.checked ? 'rgba(122,158,126,0.18)' : 'rgba(255,248,240,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
        aria-hidden="true"
      >
        {item.checked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#7a9e7e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span
        style={{
          fontSize: '13px',
          color: item.checked ? 'var(--text-muted)' : 'var(--text-secondary)',
          textDecoration: item.checked ? 'line-through' : 'none',
          lineHeight: 1.4,
          transition: 'color 0.15s ease',
        }}
      >
        {item.label}
      </span>
    </button>
  );
}

interface MetadataChecklistRowProps {
  item: { id: string; label: string; category: string; checked: boolean; quantity?: string; unit?: string; amount?: number };
  onToggle: () => void;
}

function MetadataChecklistRow({ item, onToggle }: MetadataChecklistRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'transparent',
        border: 'none',
        padding: '4px 0',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '4px',
          border: `1.5px solid ${item.checked ? '#7a9e7e' : 'rgba(255,248,240,0.18)'}`,
          background: item.checked ? 'rgba(122,158,126,0.18)' : 'rgba(255,248,240,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
        aria-hidden="true"
      >
        {item.checked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#7a9e7e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span
        style={{
          fontSize: '13px',
          color: item.checked ? 'var(--text-muted)' : 'var(--text-secondary)',
          textDecoration: item.checked ? 'line-through' : 'none',
          lineHeight: 1.4,
          transition: 'color 0.15s ease',
          flex: 1,
          minWidth: 0,
        }}
      >
        {item.label}
        {item.quantity && item.unit && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
            {item.quantity} {item.unit}
          </span>
        )}
      </span>
      {typeof item.amount === 'number' && (
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: item.checked ? 'var(--text-muted)' : '#c9a882',
            paddingLeft: '8px',
            flexShrink: 0,
          }}
        >
          {formatCLP(item.amount)}
        </span>
      )}
      {item.category !== 'otros' && !item.amount && (
        <span
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            marginLeft: 'auto',
            paddingLeft: '8px',
            flexShrink: 0,
          }}
        >
          {item.category}
        </span>
      )}
    </button>
  );
}

// ─── Detail line (non-shopping expanded view) ─────────────────────────────────

function DetailLine({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        {value}
      </p>
    </div>
  );
}

// ─── Main TimelineView ────────────────────────────────────────────────────────

export default function TimelineView({ entries, onRefresh }: TimelineViewProps) {
  const allChecklistItems = useLiveQuery(
    async () => (await db.checklist_items.toArray()).filter((item) => recordBelongsToActiveUser(item.ownerUserId)),
    [],
    [],
  ) ?? [];

  const checklistByEntry = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const item of allChecklistItems) {
      const list = map.get(item.localEntryId) ?? [];
      list.push(item);
      map.set(item.localEntryId, list);
    }
    return map;
  }, [allChecklistItems]);

  const handleToggleItem = async (itemId: number, checked: boolean) => {
    await toggleChecklistItem(itemId, checked);
  };

  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPinnedIds(new Set(entries.filter(isEntryPinned).map((e) => e.localId)));
  }, [entries]);

  const timeline = useMemo(
    () => groupEntriesForCognitiveTimeline(entries, pinnedIds),
    [entries, pinnedIds],
  );

  if (timeline.isEmpty) {
    return (
      <div className="empty-state" style={{ padding: '40px 24px' }}>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Tu libreta está vacía
        </p>
        <p style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Escribe algo arriba para empezar
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '14px 20px 24px' }}>
      {timeline.groups.map((group) => (
        <TimelineGroup
          key={group.key}
          label={group.label}
          entries={group.entries}
          groupKey={group.key}
          collapsedLimit={group.key === 'completed' ? 3 : undefined}
          checklistByEntry={checklistByEntry}
          onToggleItem={handleToggleItem}
          onAction={onRefresh}
        />
      ))}
    </div>
  );
}

// ─── TimelineGroup ────────────────────────────────────────────────────────────

interface TimelineGroupProps {
  label: string;
  entries: TimelineEntry[];
  checklistByEntry: Map<string, ChecklistItem[]>;
  onToggleItem: (itemId: number, checked: boolean) => Promise<void>;
  onAction: () => void;
  groupKey?: CognitiveGroupKey;
  collapsedLimit?: number;
}

function TimelineGroup({ label, entries, checklistByEntry, onToggleItem, onAction, groupKey, collapsedLimit }: TimelineGroupProps) {
  const [showAll, setShowAll] = useState(false);

  const deduped = entries.filter((entry, index, arr) => {
    if (entry.type !== 'shopping_list') return true;
    return arr.findIndex(
      (e) => e.type === 'shopping_list' && e.title === entry.title && e.date === entry.date,
    ) === index;
  });

  const isCollapsible = !!collapsedLimit && deduped.length > collapsedLimit;
  const displayed = isCollapsible && !showAll ? deduped.slice(0, collapsedLimit) : deduped;
  const hiddenCount = deduped.length - displayed.length;

  const isNow = groupKey === 'now';
  const isCompleted = groupKey === 'completed';

  return (
    <section style={{ marginBottom: '18px' }}>
      <h2
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: isNow
            ? 'rgba(201,168,130,0.6)'
            : isCompleted
            ? 'rgba(245,240,235,0.2)'
            : 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          margin: '0 0 8px',
          paddingLeft: '4px',
        }}
      >
        {label}
        {isCompleted && deduped.length > 0 && (
          <span style={{ fontWeight: 400, marginLeft: '5px' }}>({deduped.length})</span>
        )}
      </h2>
      <div style={{ display: 'grid', gap: '8px' }}>
        {displayed.map((entry) => (
          <TimelineItem
            key={entry.localId}
            entry={entry}
            checklistItems={checklistByEntry.get(entry.localId) ?? []}
            onToggleItem={onToggleItem}
            onAction={onAction}
            groupKey={groupKey}
          />
        ))}
      </div>
      {isCollapsible && !showAll && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          style={{
            marginTop: '6px',
            paddingLeft: '4px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            opacity: 0.6,
          }}
        >
          Ver {hiddenCount} más
        </button>
      )}
    </section>
  );
}

// ─── TimelineItem ─────────────────────────────────────────────────────────────

interface TimelineItemProps {
  entry: TimelineEntry;
  checklistItems: ChecklistItem[];
  onToggleItem: (itemId: number, checked: boolean) => Promise<void>;
  onAction: () => void;
  groupKey?: CognitiveGroupKey;
}

function TimelineItem({ entry, checklistItems, onToggleItem, onAction, groupKey }: TimelineItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(entry.text);
  const [pinned, setPinned] = useState(isEntryPinned(entry));

  const handleToggleDone = async () => {
    if (entry.id === undefined) return;
    await toggleEntryDone(entry.id, !entry.done);
    onAction();
  };

  const handleDelete = async () => {
    if (entry.id === undefined) return;
    await deleteEntry(entry.id);
    onAction();
  };

  const handleTogglePin = () => {
    const next = toggleEntryPinned(entry);
    setPinned(next);
    onAction();
  };

  const handleStartEdit = () => {
    setEditText(entry.text);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || editText.trim() === entry.text) {
      setEditing(false);
      return;
    }
    if (entry.id !== undefined) {
      await reparseAndUpdateEntry(entry.id, editText.trim());
      onAction();
    }
    setEditing(false);
  };

  const handleKeyDownEdit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  const displayType   = getAgentForType(entry.type)?.ui.label ?? getEntryDisplayType(entry);
  const color         = TYPE_COLORS[entry.type] ?? 'rgba(245,240,235,0.34)';
  const priority      = getEntryPriority(entry);
  const whenLabel     = getWhenLabel(entry);
  const amountLabel   = typeof entry.amount === 'number' ? formatCLP(entry.amount) : '';
  const detailOriginal = getDetailOriginal(entry);

  const isShoppingList = entry.type === 'shopping_list' || isMetadataShopping(entry);
  const isPayment      = entry.type === 'payment';
  const isPetOrHealth  = entry.type === 'pet' || entry.type === 'health' || entry.type === 'appointment';

  const metaShopping = getShoppingMetadata(entry);

  const title = isPayment
    ? getPaymentTitle(entry)
    : metaShopping
    ? 'Lista de compras'
    : getEntryDisplayTitle(entry);
  const checklistCategory = isShoppingList ? getChecklistCategory(entry) : '';
  const statusText = isPayment ? getPaymentStatus(entry) : checkOverdue(entry) ? 'vencido' : '';

  // Collapsed checklist preview (first 3 unchecked items)
  const collapsedItems = isShoppingList
    ? metaShopping
      ? [...metaShopping.items].sort((a, b) => Number(a.checked) - Number(b.checked)).slice(0, 3)
      : [...checklistItems].sort((a, b) => Number(a.checked) - Number(b.checked)).slice(0, 3)
    : [];

  const microcopy = groupKey === 'now' ? getMicrocopy(entry) : null;

  return (
    <div
      id={`timeline-entry-${entry.localId}`}
      className="glass-card"
      style={{
        padding: '13px 14px',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        opacity: entry.done ? 0.42 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      {/* Done circle */}
      <button
        type="button"
        onClick={handleToggleDone}
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          border: `1.5px solid ${entry.done ? 'var(--accent-human)' : 'var(--glass-border)'}`,
          background: entry.done ? 'var(--accent-human)' : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '3px',
          transition: 'all 0.15s ease',
        }}
        aria-label={entry.done ? 'Marcar pendiente' : 'Marcar completado'}
      >
        {entry.done && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--bg-void)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Card body: header button + expanded area sibling */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header — editable or clickable */}
        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDownEdit}
              onBlur={handleSaveEdit}
              style={{
                flex: 1,
                background: 'rgba(255,248,240,0.06)',
                border: '1px solid rgba(255,248,240,0.12)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '13px',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            aria-expanded={expanded}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: 0,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            {/* Type pill + title + priority dot */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 7px',
                  borderRadius: '999px',
                  border: `1px solid ${withAlpha(color, 0.2)}`,
                  background: withAlpha(color, 0.08),
                  color,
                  flexShrink: 0,
                  lineHeight: 1.5,
                  marginTop: '1px',
                  textTransform: 'lowercase',
                }}
              >
                {displayType}
              </span>

              <p
                style={{
                  margin: 0,
                  flex: 1,
                  fontSize: '13px',
                  fontWeight: 500,
                  color: entry.done ? 'var(--text-secondary)' : 'var(--text-primary)',
                  textDecoration: entry.done ? 'line-through' : 'none',
                  lineHeight: 1.42,
                  wordBreak: 'break-word',
                }}
              >
                {title}
              </p>

              <span
                aria-hidden="true"
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '999px',
                  background: PRIORITY_DOT[priority],
                  flexShrink: 0,
                  marginTop: '6px',
                }}
              />
            </div>

            {/* Microcopy — only in "Ahora" group for pending entries */}
            {microcopy && (
              <p style={{
                margin: '3px 0 0',
                fontSize: '10px',
                color: microcopy.startsWith('vencido') ? 'rgba(196,112,112,0.6)' : 'rgba(201,168,130,0.5)',
                paddingLeft: '0',
                lineHeight: 1.3,
              }}>
                {microcopy}
              </p>
            )}

            {/* Shopping list: category tag */}
            {isShoppingList && checklistCategory && (
              <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                {checklistCategory}
              </p>
            )}

            {/* Collapsed checklist preview */}
            {isShoppingList && !expanded && collapsedItems.length > 0 && (
              <div style={{ display: 'grid', gap: '4px', marginTop: '8px', paddingLeft: '2px' }}>
                {metaShopping
                  ? collapsedItems.map((item) => (
                      <div key={(item as { id: string }).id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: '13px',
                            height: '13px',
                            borderRadius: '3px',
                            border: `1px solid ${(item as { checked: boolean }).checked ? 'rgba(122,158,126,0.4)' : 'rgba(255,248,240,0.14)'}`,
                            background: (item as { checked: boolean }).checked ? 'rgba(122,158,126,0.1)' : 'rgba(255,248,240,0.02)',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {(item as { checked: boolean }).checked && (
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#7a9e7e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        <span style={{
                          fontSize: '12px',
                          color: (item as { checked: boolean }).checked ? 'var(--text-muted)' : 'var(--text-secondary)',
                          textDecoration: (item as { checked: boolean }).checked ? 'line-through' : 'none',
                          lineHeight: 1.35,
                        }}>
                          {(item as { label: string }).label}
                        </span>
                      </div>
                    ))
                  : (collapsedItems as ChecklistItem[]).map((item) => (
                      <div key={item.localId} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: '13px',
                            height: '13px',
                            borderRadius: '3px',
                            border: `1px solid ${item.checked ? 'rgba(122,158,126,0.4)' : 'rgba(255,248,240,0.14)'}`,
                            background: item.checked ? 'rgba(122,158,126,0.1)' : 'rgba(255,248,240,0.02)',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                          justifyContent: 'center',
                          }}
                        >
                          {item.checked && (
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#7a9e7e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        <span style={{
                          fontSize: '12px',
                          color: item.checked ? 'var(--text-muted)' : 'var(--text-secondary)',
                          textDecoration: item.checked ? 'line-through' : 'none',
                          lineHeight: 1.35,
                        }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                {metaShopping
                  ? metaShopping.items.length > 3 && (
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                        +{metaShopping.items.length - 3} más
                      </p>
                    )
                  : checklistItems.length > 3 && (
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                        +{checklistItems.length - 3} más
                      </p>
                    )}
              </div>
            )}

            {/* Meta row: date/amount/status/progress */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
              {whenLabel && (
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: checkOverdue(entry) ? '#c47070' : 'var(--text-secondary)' }}>
                  {whenLabel}
                </span>
              )}
              {amountLabel && !isShoppingList && (
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#c9a882' }}>
                  {amountLabel}
                </span>
              )}
              {isPayment && statusText && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: '999px',
                    color: statusText === 'vencido' ? '#c47070' : statusText === 'pendiente' ? '#b8944e' : '#7a9e7e',
                    background: statusText === 'vencido' ? 'rgba(196,112,112,0.08)' : statusText === 'pendiente' ? 'rgba(184,148,78,0.08)' : 'rgba(122,158,126,0.08)',
                    border: '1px solid rgba(255,248,240,0.08)',
                    lineHeight: 1.4,
                  }}
                >
                  {statusText}
                </span>
              )}
              {isShoppingList && (
                <ProgressLabel
                  total={metaShopping ? metaShopping.items.length : checklistItems.length}
                  checked={metaShopping ? metaShopping.items.filter((i) => i.checked).length : checklistItems.filter((i) => i.checked).length}
                  totalEstimated={metaShopping?.progress.totalEstimated}
                  totalChecked={metaShopping?.progress.totalChecked}
                />
              )}
              {isPetOrHealth && priority !== 'normal' && (
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {priority === 'urgent' ? 'urgente' : 'importante'}
                </span>
              )}
            </div>
          </button>
        )}

        {/* Expanded section — outside the button so interactive elements are valid */}
        <div
          style={{
            display: 'grid',
            gridTemplateRows: expanded ? '1fr' : '0fr',
            transition: 'grid-template-rows 0.22s ease',
            marginTop: expanded ? '10px' : 0,
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            {expanded && (
              <div
                style={{
                  borderTop: '1px solid rgba(255,248,240,0.08)',
                  paddingTop: '10px',
                  display: 'grid',
                  gap: '7px',
                }}
              >
                {isShoppingList ? (
                  <div style={{ display: 'grid', gap: '2px' }}>
                    {metaShopping ? (
                      metaShopping.items.length === 0 ? (
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Sin ítems detectados</p>
                      ) : (
                        <>
                          {metaShopping.items.map((item) => (
                            <MetadataChecklistRow
                              key={item.id}
                              item={item}
                              onToggle={() => entry.id !== undefined && toggleShoppingItem(entry.id, item.id)}
                            />
                          ))}
                          {metaShopping.progress.totalEstimated > 0 && (
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: '6px',
                                paddingTop: '6px',
                                borderTop: '1px solid rgba(255,248,240,0.06)',
                              }}
                            >
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {metaShopping.progress.totalChecked > 0 ? 'Comprado' : 'Total estimado'}
                              </span>
                              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#c9a882', fontWeight: 600 }}>
                                {metaShopping.progress.totalChecked > 0
                                  ? `${formatCLP(metaShopping.progress.totalChecked)} / ${formatCLP(metaShopping.progress.totalEstimated)}`
                                  : formatCLP(metaShopping.progress.totalEstimated)}
                              </span>
                            </div>
                          )}
                        </>
                      )
                    ) : checklistItems.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Sin ítems detectados</p>
                    ) : (
                      checklistItems.map((item) => (
                        <ChecklistRow key={item.localId} item={item} onToggle={onToggleItem} />
                      ))
                    )}
                    {detailOriginal && (
                      <p style={{ margin: '8px 0 0', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {detailOriginal}
                      </p>
                    )}
                  </div>
                ) : isPayment ? (
                  <>
                    <DetailLine label="Qué entendí" value={getFinancialDirection(entry) === 'income' ? 'Ingreso registrado' : 'Pago pendiente'} />
                    <DetailLine label="Monto" value={amountLabel} />
                    <DetailLine label="Cuándo" value={whenLabel} />
                    <DetailLine label="Tipo" value={`${getFinancialDirection(entry) === 'income' ? 'ingreso' : 'egreso'} / ${getFinancialCategory(entry)}`} />
                    <DetailLine label="Estado" value={statusText} />
                    <DetailLine label="Próximo paso" value={getFinancialDirection(entry) === 'income' ? 'dejarlo registrado si ya entró' : 'marcar como pagado cuando lo resuelvas'} />
                    <DetailLine label="Detalle original" value={detailOriginal} />
                  </>
                ) : isPetOrHealth ? (
                  <>
                    <DetailLine label="Qué entendí" value={entry.type === 'pet' ? 'Cuidado de mascota' : 'Cuidado personal'} />
                    <DetailLine label="Cuándo" value={whenLabel} />
                    <DetailLine label="Próximo paso" value={getEntryNextStep(entry)} />
                    <DetailLine label="Detalle original" value={detailOriginal} />
                  </>
                ) : entry.type === 'note' ? (
                  <>
                    <DetailLine label="Qué entendí" value="Nota guardada" />
                    <DetailLine label="Detalle original" value={detailOriginal} />
                  </>
                ) : (
                  <>
                    <DetailLine label="Próximo paso" value={getEntryNextStep(entry)} />
                    <DetailLine label="Cuándo" value={whenLabel} />
                    <DetailLine label="Detalle original" value={detailOriginal} />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pin + edit + delete */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
        <button
          type="button"
          onClick={handleTogglePin}
          aria-label={pinned ? 'Quitar favorito' : 'Marcar favorito'}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '8px',
            background: pinned ? 'rgba(201,168,130,0.12)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: pinned ? 0.95 : 0.35,
            transition: 'opacity 0.15s ease, background 0.15s ease',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={pinned ? '#c9a882' : 'none'} stroke="#c9a882" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 17.3 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleStartEdit}
          aria-label="Editar"
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: 0.3,
            transition: 'opacity 0.15s ease',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleDelete}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: 0.2,
            transition: 'opacity 0.15s ease',
          }}
          aria-label="Eliminar"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
