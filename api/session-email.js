// Vercel serverless function. Given a Stripe Checkout Session ID (the one
// Stripe substitutes into the success URL via {CHECKOUT_SESSION_ID}), returns
// the customer's email + paid status. Client uses this to auto-store the
// email after a Stripe redirect so cross-device verification works later.
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

  const sessionId = String(req.query.session_id || '').trim();
  if (!sessionId.startsWith('cs_') || sessionId.length > 200) {
    return res.status(400).json({ ok: false, error: 'invalid_session_id' });
  }

  try {
    const session = await sk.checkout.sessions.retrieve(sessionId);
    const email = session.customer_details?.email || session.customer_email || null;
    const paid = session.payment_status === 'paid';
    return res.status(200).json({ ok: true, pro: paid, email });
  } catch (err) {
    console.error('[session-email]', err.message);
    return res.status(404).json({ ok: false, error: 'session_not_found' });
  }
}
