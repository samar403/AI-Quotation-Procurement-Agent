import type { PlanTier } from "./types";

export interface Plan {
  id: PlanTier;
  name: string;
  priceMonthly: number; // INR
  docsLimit: number; // documents processed per billing period
  seats: number;
  suppliers: number;
  blurb: string;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 2999,
    docsLimit: 150,
    seats: 2,
    suppliers: 15,
    blurb: "For a trading desk that quotes a few orders a day.",
    features: [
      "150 orders read / month",
      "WhatsApp chats, PDFs, emails & photos",
      "Supplier price comparison",
      "Branded PDF quotations",
      "2 team seats",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    priceMonthly: 7999,
    docsLimit: 750,
    seats: 8,
    suppliers: 100,
    blurb: "For wholesalers running multiple salespeople and mills.",
    highlight: true,
    features: [
      "750 orders read / month",
      "Everything in Starter",
      "Approval rules & margin guardrails",
      "Supplier RFQ drafts",
      "8 team seats",
    ],
  },
  {
    id: "mill",
    name: "Mill",
    priceMonthly: 19999,
    docsLimit: 5000,
    seats: 50,
    suppliers: 1000,
    blurb: "For manufacturers with an in-house procurement team.",
    features: [
      "5,000 orders read / month",
      "Everything in Growth",
      "Custom margin matrix per buyer",
      "Priority extraction queue",
      "50 team seats + SSO",
    ],
  },
];

export function planFor(tier: PlanTier): Plan {
  return PLANS.find((p) => p.id === tier) ?? PLANS[0];
}
