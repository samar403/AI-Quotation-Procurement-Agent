import { z } from "zod";
import { CATEGORIES } from "../types";

// Structured-output schema for Claude. Nullable (not optional) fields keep every key present,
// which makes the JSON schema strict and the downstream mapping trivial.
export const ExtractedItem = z.object({
  raw_text: z.string(),
  product: z.string(),
  category: z.enum(CATEGORIES),
  composition: z.string().nullable(),
  gsm: z.number().nullable(),
  width_inch: z.number().nullable(),
  count: z.string().nullable(),
  construction: z.string().nullable(),
  weave: z.string().nullable(),
  color: z.string().nullable(),
  finish: z.string().nullable(),
  quantity: z.number(),
  unit: z.enum(["m", "kg", "pcs", "roll", "yard"]),
  target_price: z.number().nullable(),
  notes: z.string().nullable(),
  confidence: z.number(),
});

export const Extraction = z.object({
  is_order: z.boolean(),
  summary: z.string(),
  language: z.string(),
  customer: z.object({
    name: z.string().nullable(),
    company: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    city: z.string().nullable(),
    gstin: z.string().nullable(),
  }),
  items: z.array(ExtractedItem),
  delivery_by: z.string().nullable(),
  delivery_location: z.string().nullable(),
  payment_terms: z.string().nullable(),
  notes: z.string().nullable(),
  clarifications: z.array(z.string()),
  overall_confidence: z.number(),
});

export type ExtractionT = z.infer<typeof Extraction>;
