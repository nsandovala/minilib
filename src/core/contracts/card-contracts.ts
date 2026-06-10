import { z } from 'zod';

export const EntryTypeSchema = z.enum([
  'note',
  'task',
  'payment',
  'appointment',
  'shopping_list',
  'health',
  'pet',
  'calendar',
]);

export const StoreTypeSchema = z.enum([
  'supermercado',
  'farmacia',
  'feria',
  'minimarket',
  'botilleria',
  'mall',
  'mall_chino',
  'panaderia',
  'carniceria',
  'verduleria',
  'otro',
]);

export const RadarSurfaceSchema = z.enum([
  'notes',
  'todos',
  'purchases',
  'payments',
  'health',
  'pets',
  'appointments',
]);

export const MoneySchema = z.object({
  amount: z.number().positive().nullable(),
  currency: z.literal('CLP').nullable(),
});

export const ShoppingCompletionDraftSchema = z.object({
  totalCompra: z.number().positive().nullable().catch(null),
  linkedEntryId: z.string().nullable().catch(null),
  source: z.literal('shopping_list').nullable().catch(null),
});

export const RadarCardSchema = z.object({
  type: EntryTypeSchema,
  surface: RadarSurfaceSchema.catch('notes'),
  title: z.string().min(1).transform((s) => s.trim()),
  summary: z.string().nullable().catch(null),
  date_text: z.string().nullable().catch(null),
  dateISO: z.string().nullable().catch(null),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable().catch(null),
  amount: z.number().positive().nullable().catch(null),
  currency: z.literal('CLP').nullable().catch(null),
  priority: z.enum(['low', 'normal', 'urgent']).nullable().catch(null),
  status: z.enum(['pending', 'paid', 'completed']).nullable().catch(null),
  store_context: z.string().nullable().catch(null),
  storeType: StoreTypeSchema.nullable().catch(null),
  checklist_items: z.array(z.string()).catch([]),
  tags: z.array(z.string()).catch([]),
  confidence: z.number().transform((n) => Math.min(1, Math.max(0, n))).catch(0),
  reason: z.string().catch(''),
  metadata: z.object({
    possibleTotal: z.number().positive().nullable().catch(null),
    shoppingCompletion: ShoppingCompletionDraftSchema.catch({
      totalCompra: null,
      linkedEntryId: null,
      source: null,
    }),
  }).partial().catch({}),
});

/**
 * Strict schema for AI responses — no .catch() fallbacks.
 * If AI returns invalid data, we should know and fall back to heuristic.
 */
export const RadarCardSchemaStrict = z.object({
  type: EntryTypeSchema,
  surface: RadarSurfaceSchema,
  title: z.string().min(1),
  summary: z.string().nullable(),
  date_text: z.string().nullable(),
  dateISO: z.string().nullable(),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  amount: z.number().positive().nullable(),
  currency: z.literal('CLP').nullable(),
  priority: z.enum(['low', 'normal', 'urgent']).nullable(),
  status: z.enum(['pending', 'paid', 'completed']).nullable(),
  store_context: z.string().nullable(),
  storeType: StoreTypeSchema.nullable(),
  checklist_items: z.array(z.string()),
  tags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
});

export type ContractEntryType = z.infer<typeof EntryTypeSchema>;
export type ContractStoreType = z.infer<typeof StoreTypeSchema>;
export type RadarCardContract = z.infer<typeof RadarCardSchema>;
export type RadarCardContractStrict = z.infer<typeof RadarCardSchemaStrict>;
