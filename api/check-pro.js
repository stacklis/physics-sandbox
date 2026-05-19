// Vercel serverless function. Given an email, decides whether the user has
// Pro access by checking, in order:
//   1. Stacklis lifetime entitlement (stacklis.com/api/entitlement) — one $29
//      Lifetime purchase on the parent site unlocks every Stacklis app.
//   2. Stripe charges paid directly to this app's Stripe account — covers the
//      older Payment Link flow used before /access fulfillment existed.
// Either source counts as Pro. No backing store; both are sources of truth.
import Stripe from 'stripe';

const STACKLIS_ENTITLEMENT_URL =
  process.env.STACKLIS_ENTITLEMENT_URL || 'https://stacklis.com/api/entitlement';

async function hasStacklisEntitlement(email) {
  try {
    const url = `${STACKLIS_ENTITLEMENT_URL}?email=${encodeURIComponent(email)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json();
    // active flag is what /api/entitlement returns; productId tells us which
    // product. Lifetime unlocks Pro across every Stacklis app.
    return Boolean(
      data &&
        data.active === true &&
        (data.productId === 'stacklis-pro-lifetime' ||
          data.productId === 'stacklis-pro-monthly'),
    );
  } catch (err) {
    // Network/JSON errors should not block the user — fall through to the
    // Stripe-charge scan so legacy Payment-Link customers still unlock.
    console.warn('[check-pro] stacklis entitlement check failed:', err.message);
    return false;
  }
}

let stripe = null;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const raw = req.query.email || (req.body && req.body.email) || '';
  const email = String(raw).toLowerCase().trim();
  if (!email || !email.includes('@') || email.length > 200) {
    return res.status(400).json({ ok: false, error: 'invalid_email' });
  }

  // Stacklis-wide entitlement short-circuit — a Lifetime purchase on
  // stacklis.com/access unlocks this app immediately.
  if (await hasStacklisEntitlement(email)) {
    return res.status(200).json({ ok: true, pro: true, source: 'stacklis' });
  }

  const sk = getStripe();
  if (!sk) {
    // Without a local Stripe key we can only rely on Stacklis entitlement.
    // Since that already returned false, the user is not Pro here.
    return res.status(200).json({ ok: true, pro: false, source: 'stacklis' });
  }

  try {
    // Path 1 — customer-attached charges (Payment Link with customer_creation:always).
    const customers = await sk.customers.search({
      query: `email:"${email.replace(/"/g, '\\"')}"`,
      limit: 10,
    });
    for (const customer of customers.data) {
      const charges = await sk.charges.list({
        customer: customer.id,
        limit: 20,
      });
      const paid = charges.data.some(c =>
        c.status === 'succeeded' && c.paid === true && c.refunded === false
      );
      if (paid) return res.status(200).json({ ok: true, pro: true });
    }
    // Path 2 — older Payment Link runs (customer_creation:"if_required") created
    // charges with no Customer object. Scan recent charges by billing email.
    // Stripe Search API doesn't index billing_details.email so we paginate.
    let starting_after;
    let scanned = 0;
    const MAX_SCAN = 300; // hard ceiling to keep this cheap
    while (scanned < MAX_SCAN) {
      const page = await sk.charges.list({
        limit: 100,
        ...(starting_after ? { starting_after } : {}),
      });
      for (const c of page.data) {
        const bEmail = (c.billing_details?.email || '').toLowerCase().trim();
        if (bEmail === email && c.status === 'succeeded' && c.paid === true && c.refunded === false) {
          return res.status(200).json({ ok: true, pro: true });
        }
      }
      scanned += page.data.length;
      if (!page.has_more || page.data.length === 0) break;
      starting_after = page.data[page.data.length - 1].id;
    }
    return res.status(200).json({ ok: true, pro: false });
  } catch (err) {
    console.error('[check-pro]', err.message);
    return res.status(500).json({ ok: false, error: 'stripe_error' });
  }
}
