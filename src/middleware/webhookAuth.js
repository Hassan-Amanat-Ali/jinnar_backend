import crypto from 'crypto';

// Middleware to verify webhook requests using HMAC and to safely allow
// the ngrok browser-skip header only for verified requests.
//
// Usage: set env var PAWAPAY_WEBHOOK_SECRET (or generic WEBHOOK_SECRET)
// The webhook provider should send a header `x-webhook-signature` containing
// a hex HMAC-SHA256 of the raw body using the secret.

export default function verifyWebhook(options = {}) {
  const headerName = options.headerName || 'x-webhook-signature';
  const plainSecretHeader = options.secretHeader || 'x-pawapay-secret';
  const secret = process.env.PAWAPAY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || process.env.PAWAPAY_CALLBACK_SECRET;

  return async function (req, res, next) {
    try {
      if (!secret) {
        return res.status(403).json({ error: 'Webhook secret not configured' });
      }

      // We need the raw body to compute HMAC. If body parser already ran,
      // req.rawBody may be present (some setups capture it). Otherwise, try
      // to reconstruct from req.body for JSON payloads.
      let raw = req.rawBody;
      if (!raw) {
        if (req.body && typeof req.body === 'object') {
          raw = Buffer.from(JSON.stringify(req.body));
        } else if (typeof req.body === 'string') {
          raw = Buffer.from(req.body);
        }
      }

      if (!raw) raw = Buffer.from('');

      // 1) Check plain-secret header fallback
      const plainSecret = (req.headers[plainSecretHeader] || req.headers[plainSecretHeader.toLowerCase()]);
      if (plainSecret && secret && plainSecret === secret) {
        req.webhookVerified = true;
        return next();
      }

      // 2) HMAC signature verification (fallback)
      const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      const signature = (req.headers[headerName] || req.headers[headerName.toLowerCase()] || '').toString();

      const verified = signature && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

      if (!verified) {
        return res.status(401).json({ error: 'Invalid webhook signature or secret' });
      }

      // signature verified: allow request and mark verified flag
      req.webhookVerified = true;

      // If the ngrok skip header is present, it's allowed only when verified.
      if (req.headers['ngrok-skip-browser-warning']) {
        // nothing to do — it's fine for verified requests
      }

      return next();
    } catch (err) {
      console.error('Webhook verification error', err);
      return res.status(500).json({ error: 'Webhook verification error' });
    }
  };
}
