/**
 * Draft write input schemas (Phase 7, §9–§11, §26).
 * Zod at every API boundary: unknown fields rejected, every user-authored
 * text field bounded, money validated as integer minor units.
 *
 * Limits (centralized here; derived from Convex config):
 *   title:        3–120 chars
 *   description:  0–4000 chars
 *   item name:    1–200 chars
 *   item note:    0–500 chars
 *   item count:   1–20
 *   quantity:     integer > 0
 *   unit amount:  integer >= 0, within business ceiling
 *   currency:     NGN only (MVP)
 *   seller terms: 0–2000 chars
 */
import { z } from "zod";

export const CATEGORIES = [
  "Electronics",
  "Fashion",
  "Home & Living",
  "Automotive",
  "Services",
  "Agriculture",
  "Food & Groceries",
  "Creative",
  "Other",
] as const;

const TITLE_MIN = 3;
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 4000;
const ITEM_NAME_MAX = 200;
const ITEM_NOTE_MAX = 500;
const MAX_ITEMS = 20;
const SELLER_TERMS_MAX = 2000;
const ALLOWED_CURRENCY = "NGN";

const draftItemSchema = z.object({
  name: z.string().min(1).max(ITEM_NAME_MAX),
  note: z.string().max(ITEM_NOTE_MAX).optional(),
  quantity: z.number().int().min(1),
  unitAmountMinor: z.number().int().min(0),
});

export type DraftItemInput = z.infer<typeof draftItemSchema>;

export const createDraftSchema = z
  .object({
    title: z.string().min(TITLE_MIN).max(TITLE_MAX).trim(),
    description: z.string().max(DESCRIPTION_MAX).trim().default(""),
    category: z.enum(CATEGORIES),
    currency: z.literal(ALLOWED_CURRENCY),
    items: z.array(draftItemSchema).min(1).max(MAX_ITEMS),
    deliveryFeeMinor: z.number().int().min(0).default(0),
    inspectionWindowDays: z.number().int().min(1).max(30).optional(),
    sellerTerms: z.string().max(SELLER_TERMS_MAX).trim().optional(),
  })
  .strict();

export type CreateDraftInput = z.infer<typeof createDraftSchema>;

export const editDraftSchema = z
  .object({
    title: z.string().min(TITLE_MIN).max(TITLE_MAX).trim().optional(),
    description: z.string().max(DESCRIPTION_MAX).trim().optional(),
    category: z.enum(CATEGORIES).optional(),
    items: z.array(draftItemSchema).min(1).max(MAX_ITEMS).optional(),
    deliveryFeeMinor: z.number().int().min(0).optional(),
    inspectionWindowDays: z.number().int().min(1).max(30).optional(),
    sellerTerms: z.string().max(SELLER_TERMS_MAX).trim().optional(),
    expectedVersion: z.number().int().min(1),
  })
  .strict();

export type EditDraftInput = z.infer<typeof editDraftSchema>;

export {
  TITLE_MIN,
  TITLE_MAX,
  DESCRIPTION_MAX,
  ITEM_NAME_MAX,
  ITEM_NOTE_MAX,
  MAX_ITEMS,
  SELLER_TERMS_MAX,
  ALLOWED_CURRENCY,
};
