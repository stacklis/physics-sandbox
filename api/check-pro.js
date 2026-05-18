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
    // Stripe customers.search: case-insensitive email match.
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
      if (paid) {
        return res.status(200).json({ ok: true, pro: true });
      }
    }
    return res.status(200).json({ ok: true, pro: false });
  } catch (err) {
    console.error('[check-pro]', err.message);
    return res.status(500).json({ ok: false, error: 'stripe_error' });
  }
}
