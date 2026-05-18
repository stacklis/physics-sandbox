// Vercel serverless function. Given an email, asks Stripe if that email has
// a paid, non-refunded Charge for this account. Used to unlock Pro on any
// device — the user paid once on device A, enters their email on device B,
// we ask Stripe directly. No backing store, Stripe is the source of truth.
import Stripe from 'stripe';

let stripe = null;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const sk = getStripe();
  if (!sk) {
    return res.status(503).json({ ok: false, error: 'stripe_not_configured' });
  }

  const raw = req.query.email || (req.body && req.body.email) || '';
  const email = String(raw).toLowerCase().trim();
  if (!email || !email.includes('@') || email.length > 200) {
    return res.status(400).json({ ok: false, error: 'invalid_email' });
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
