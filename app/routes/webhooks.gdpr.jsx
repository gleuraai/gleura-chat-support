// app/routes/webhooks.gdpr.jsx
import {json} from "@remix-run/node";
import crypto from "crypto";

const SECRET = process.env.SHOPIFY_API_SECRET ?? "";

function verifyHmac(rawBody, hmacHeader) {
  if (!SECRET || !hmacHeader) return false;
  const digest = crypto
    .createHmac("sha256", SECRET)
    .update(rawBody, "utf8")
    .digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

export async function action({ request }) {
  const topic = request.headers.get("x-shopify-topic") || "";
  const shop = request.headers.get("x-shopify-shop-domain") || "";
  const hmac = request.headers.get("x-shopify-hmac-sha256") || "";

  const raw = await request.text();
  if (!verifyHmac(raw, hmac)) return new Response("Invalid HMAC", { status: 401 });

  // Shopify sends JSON bodies for GDPR webhooks
  let payload = {};
  try { payload = JSON.parse(raw); } catch {}

  // TODO: replace these with your real data jobs
  switch (topic) {
    case "customers/data_request":
      // enqueue: compile customer data related to payload.customer.id for shop
      break;
    case "customers/redact":
      // enqueue: delete PII for payload.customer.id for shop
      break;
    case "shop/redact":
      // enqueue: delete all shop-scoped data for `shop`
      break;
    default:
      // ignore other topics if this URL is reused
      break;
  }

  return new Response(null, { status: 200 });
}

// Optional: simple 200 for GET pings
export function loader() {
  return json({ ok: true });
}