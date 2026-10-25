// Core domain model for Taana. Everything persisted in the datastore is one of these shapes.

export type SourceType = "whatsapp" | "email" | "pdf" | "image" | "text";

export type Unit = "m" | "kg" | "pcs" | "roll" | "yard";

export const CATEGORIES = [
  "Cotton Fabric",
  "Viscose & Rayon",
  "Polyester & Synthetics",
  "Denim",
  "Knit Fabric",
  "Linen & Blends",
  "Yarn",
  "Trims & Accessories",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Specs {
  composition?: string; // "100% cotton", "65/35 PC"
  gsm?: number;
  widthInch?: number;
  count?: string; // "40x40", "30s", "150D"
  construction?: string; // "132x72"
  weave?: string; // poplin, twill, satin, jersey
  color?: string;
  finish?: string; // RFD, dyed, printed, mercerised
}

export interface CatalogEntry {
  id: string;
  sku: string;
  product: string;
  category: Category;
  hsn: string;
  specs: Specs;
  unit: Unit;
  price: number; // ex-mill price per unit, INR, pre-tax
  moq: number;
  stock: number;
  leadTimeDays: number;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  city: string;
  state: string;
  gstin: string;
  contactName: string;
  phone: string;
  email: string;
  categories: Category[];
  onTimeRate: number; // 0..1
  qualityScore: number; // 0..1
  paymentTerms: string;
  freightPerUnit: Partial<Record<Unit, number>>;
  catalog: CatalogEntry[];
  notes?: string;
  createdAt: string;
}

export interface CustomerInfo {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  city?: string;
  gstin?: string;
}

export interface RequirementItem {
  id: string;
  rawText: string;
  product: string;
  category: Category;
  specs: Specs;
  quantity: number;
  unit: Unit;
  targetPrice?: number | null;
  notes?: string;
  confidence: number; // 0..1
}

export interface ScoreBreakdown {
  price: number;
  lead: number;
  reliability: number;
  moq: number;
  match: number;
}

export interface Offer {
  supplierId: string;
  supplierName: string;
  city: string;
  catalogId: string;
  sku: string;
  product: string;
  unitPrice: number;
  freightPerUnit: number;
  landedCost: number;
  total: number;
  moq: number;
  stock: number;
  leadTimeDays: number;
  score: number; // 0..100
  breakdown: ScoreBreakdown;
  flags: string[];
}

export interface ItemComparison {
  itemId: string;
  offers: Offer[]; // sorted by score desc
  recommendedSupplierId: string | null;
  selectedSupplierId: string | null;
  marketAverage: number | null;
  savingsVsAverage: number | null; // INR on the full quantity
  reason: string;
  needsRfq: boolean;
}

export type OrderStatus =
  | "extracted"
  | "quoted"
  | "pending_approval"
  | "approved"
  | "sent"
  | "won"
  | "lost"
  | "rejected";

export interface TimelineEvent {
  at: string;
  kind: "ingest" | "extract" | "compare" | "quote" | "approval" | "send" | "edit" | "outcome" | "rfq";
  text: string;
  actor?: string;
}

export interface ExtractionMeta {
  engine: "claude" | "heuristic";
  model?: string;
  confidence: number;
  durationMs: number;
  summary: string;
  language?: string;
  warnings: string[];
}

export interface Order {
  id: string;
  ref: string;
  createdAt: string;
  updatedAt: string;
  source: { type: SourceType; fileName?: string; preview: string; chars: number };
  customer: CustomerInfo;
  items: RequirementItem[];
  deliveryBy?: string | null; // ISO date
  deliveryLocation?: string | null;
  paymentTerms?: string | null;
  notes?: string;
  clarifications: string[];
  extraction: ExtractionMeta;
  comparisons: ItemComparison[];
  quoteId?: string;
  status: OrderStatus;
  timeline: TimelineEvent[];
}

export interface QuoteLine {
  itemId: string;
  description: string;
  hsn: string;
  quantity: number;
  unit: Unit;
  supplierId: string | null;
  supplierName: string | null;
  costPrice: number; // landed cost per unit
  marginPct: number;
  unitPrice: number;
  amount: number;
  targetPrice?: number | null;
  note?: string;
}

export type QuoteStatus = "draft" | "pending_approval" | "approved" | "rejected" | "sent" | "won" | "lost";

export interface ApprovalEntry {
  at: string;
  by: string;
  action: "auto_approved" | "submitted" | "approved" | "rejected" | "sent" | "won" | "lost" | "revised";
  note?: string;
}

export interface Quote {
  id: string;
  number: string;
  orderId: string;
  orderRef: string;
  createdAt: string;
  updatedAt: string;
  validUntil: string;
  customer: CustomerInfo;
  lines: QuoteLine[];
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  cost: number;
  grossProfit: number;
  marginPct: number;
  deliveryBy?: string | null;
  terms: string[];
  status: QuoteStatus;
  requiresApproval: boolean;
  approvalReasons: string[];
  approvals: ApprovalEntry[];
  drafts: { whatsapp: string; email: { subject: string; body: string } };
  revision: number;
}

export interface Settings {
  business: {
    name: string;
    tagline: string;
    gstin: string;
    address: string;
    phone: string;
    email: string;
    bank: string;
    signatory: string;
  };
  pricing: {
    defaultMarginPct: number;
    categoryMargins: Partial<Record<Category, number>>;
    minMarginPct: number;
    roundTo: number; // round unit price to nearest N rupees (e.g. 0.5)
    taxRate: number; // GST %
    quoteValidityDays: number;
  };
  approval: {
    autoApproveBelow: number; // quote total in INR
    requireApprovalIfMarginBelow: number; // %
    requireApprovalIfConfidenceBelow: number; // 0..1
    approvers: string[];
  };
  weights: { price: number; lead: number; reliability: number; moq: number };
  plan: {
    tier: PlanTier;
    docsUsed: number;
    periodStart: string;
    seats: number;
  };
}

export type PlanTier = "starter" | "growth" | "mill";

export interface DB {
  version: number;
  settings: Settings;
  suppliers: Supplier[];
  orders: Order[];
  quotes: Quote[];
  counters: { order: number; quote: number };
  seeded?: boolean;
}

export type AgentStage = "receive" | "read" | "extract" | "match" | "compare" | "quote" | "approve";

export interface AgentEvent {
  stage: AgentStage | "done" | "error";
  status: "start" | "progress" | "done" | "error";
  message: string;
  data?: unknown;
  at: number;
}
