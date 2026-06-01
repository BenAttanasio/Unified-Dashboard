import Stripe from "stripe";
import type { MetricValues } from "@/lib/constants";

// Stripe revenue metrics via a restricted read-only key.
// Computes: MRR (from active subscriptions), 30-day revenue + conversions
// (from charges), and active subscription count.

let client: Stripe | null = null;

function getClient(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2 });
  }
  return client;
}

export function isConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Normalize a recurring price amount (minor units) to a monthly figure. */
function toMonthly(amount: number, interval: string, intervalCount: number): number {
  const perInterval = amount;
  switch (interval) {
    case "month":
      return perInterval / intervalCount;
    case "year":
      return perInterval / (12 * intervalCount);
    case "week":
      return (perInterval * 52) / 12 / intervalCount;
    case "day":
      return (perInterval * 365) / 12 / intervalCount;
    default:
      return perInterval / intervalCount;
  }
}

export async function fetchStripe(): Promise<MetricValues> {
  const stripe = getClient();
  if (!stripe) throw new Error("Stripe: not configured");

  // --- MRR + active subscriptions ---
  let mrrMinor = 0;
  let activeSubs = 0;
  for await (const sub of stripe.subscriptions.list({ status: "active", limit: 100 })) {
    activeSubs += 1;
    for (const item of sub.items.data) {
      const price = item.price;
      if (price.recurring && typeof price.unit_amount === "number") {
        mrrMinor += toMonthly(
          price.unit_amount * (item.quantity ?? 1),
          price.recurring.interval,
          price.recurring.interval_count ?? 1,
        );
      }
    }
  }

  // --- 30-day revenue + conversions (paid charges) ---
  const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  let revenueMinor = 0;
  let conversions = 0;
  let scanned = 0;
  for await (const charge of stripe.charges.list({ created: { gte: since }, limit: 100 })) {
    if (++scanned > 5000) break; // safety cap
    if (charge.paid && charge.status === "succeeded") {
      revenueMinor += charge.amount - (charge.amount_refunded ?? 0);
      conversions += 1;
    }
  }

  return {
    mrr: Math.round(mrrMinor) / 100,
    revenue30d: Math.round(revenueMinor) / 100,
    customers: activeSubs,
    conversions,
  };
}
