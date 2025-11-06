// app/routes/api.chat.jsx — FINAL (no OpenAI)
// - Exact order match (no partials)
// - Phone verification against shipping phone (10-digit compare OK across country codes)
// - Clean HTML response with clickable tracking link
// - Scripted replies for discounts / help

import { json } from "@remix-run/node";

const chatSessions = new Map();

// Env
const SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://gleura-ai.myshopify.com", // <-- update to your live shop domain(s)
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Credentials": "true",
};

// ---------- Utils ----------
function normalizePhone(s = "") {
  return s.replace(/[^\d+]/g, "").replace(/^00/, "+");
}
function lastNDigits(s = "", n = 10) {
  return (s || "").replace(/\D/g, "").slice(-n);
}
const isPhone = (s="") => /^[+]?[\d\s\-()]{7,}$/.test(s.trim());

function asCurrency(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(amount));
  } catch {
    return `${currency || ""} ${amount}`;
  }
}
function trackingHrefFromOrder(order) {
  const f = Array.isArray(order.fulfillments) ? order.fulfillments[0] : null;
  if (!f) return null;
  if (f.tracking_url) return f.tracking_url;
  if (f.tracking_number) {
    return `https://www.aftership.com/track/${encodeURIComponent(f.tracking_number)}`;
  }
  return null;
}

// ---------- Shopify helpers ----------
async function shopifyApiCall(endpoint, method = "GET", body = null) {
  if (!SHOPIFY_SHOP_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
    console.warn("⚠️ Shopify creds missing, returning mock");
    return { orders: [], customers: [] };
  }
  const url = `https://${SHOPIFY_SHOP_DOMAIN}/admin/api/2023-10/${endpoint}`;
  const headers = {
    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
    "Content-Type": "application/json",
  };
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
  if (!res.ok) throw new Error(`Shopify API error ${res.status} on ${endpoint}`);
  return await res.json();
}

/**
 * Find order by number (exact) then verify contact against shipping.phone.
 * We compare using normalized + last 10 digits to tolerate country codes.
 */
async function findOrderByNumberAndContact(orderNumberRaw, contactRaw) {
  const orderNumber = String(orderNumberRaw || "").replace(/^#/, "");
  const contact = (contactRaw || "").trim();

  try {
    // Search by name (#1001) then fallback to order_number
    let resp = await shopifyApiCall(`orders.json?status=any&name=%23${encodeURIComponent(orderNumber)}`);
    let orders = resp.orders || [];

    if (!orders.length) {
      resp = await shopifyApiCall(`orders.json?status=any&order_number=${encodeURIComponent(orderNumber)}`);
      orders = resp.orders || [];
    }

    // 🔒 Exact match only
    orders = orders.filter(
      (o) =>
        o?.name === `#${orderNumber}` ||
        String(o?.order_number || "") === orderNumber
    );

    if (!orders.length) return { found: false, message: "Order not found." };

    const order = orders[0];
    const shippingPhone = order?.shipping_address?.phone || "";

    // Phone only (as per your latest flow)
    let verified = false;
    if (isPhone(contact)) {
      const cand = normalizePhone(contact);
      const ship = normalizePhone(shippingPhone || "");
      verified = !!ship && (cand === ship || lastNDigits(cand) === lastNDigits(ship));
    }

    if (!verified) {
      return { found: false, message: "Order found, but the provided phone doesn’t match the shipping phone." };
    }

    return { found: true, order };
  } catch (error) {
    console.error("❌ Order lookup error:", error);
    return { found: false, message: "Unable to retrieve order information right now." };
  }
}

function formatOrderResponseHTML(result) {
  if (!result.found) return result.message || "Order not found.";

  const o = result.order;

  // Status mapping (cancelled wins)
  let status = "Processing";
  if (o.cancelled_at) status = "Cancelled";
  else if (o.fulfillment_status === "fulfilled") status = "Shipped";
  else if (o.fulfillment_status === "partial") status = "Partially Shipped";
  else if (o.financial_status === "refunded") status = "Refunded";

  const orderNo = o.name ? String(o.name).replace(/^#/, "") : (o.order_number ?? "—");
  const date = o.created_at ? new Date(o.created_at).toLocaleDateString() : "—";
  const total = o.total_price ? asCurrency(o.total_price, o.currency || "USD") : "—";

  const addr = o.shipping_address || {};
  const addressLine = [addr.city, addr.province, addr.country].filter(Boolean).join(", ") || "—";

  const tn = (Array.isArray(o.fulfillments) && o.fulfillments[0]?.tracking_number) || null;
  const link = trackingHrefFromOrder(o);

  let html = "";
  html += `Order Date: ${date}<br>`;
  html += `Order No: ${orderNo}<br>`;
  html += `Order Value: ${total}<br>`;
  html += `Status: ${status}<br>`;
  html += `Shipping Address: ${addressLine}<br>`;
  if (tn) {
    html += `Tracking: <a href="${link}" target="_blank" rel="noopener noreferrer">${tn}</a><br>`;
  } else {
    html += `Tracking: —<br>`;
  }
  html += `<br>Anything else I can help you with?`;

  return html;
}

function helpResponseHTML() {
  return [
    "I can help with:",
    "• Track Order",
    "• Return / Exchange",
    "• Discounts",
    "• Shipping & Delivery",
    "• Connect to Support"
  ].join("<br>");
}

// ---------- Remix exports ----------
export const headers = () => corsHeaders;

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const req = await request.json();
    const {
      message,
      sessionId,
      action: actionType,
      orderNumber,
      phoneNumber,
    } = req;

    let session = chatSessions.get(sessionId) || { step: "initial" };
    let response = "";

    if (actionType === "track_order" && orderNumber && phoneNumber) {
      const result = await findOrderByNumberAndContact(orderNumber, phoneNumber);
      response = formatOrderResponseHTML(result);
      session = { step: "initial" };
    } else if (actionType === "discounts") {
      // Scripted/managed by you; can swap to theme-config if desired
      response = "Current discount codes:<br>• SAVE10 — 10% off<br>• HOLIDAY20 — 20% off $50+<br>• NEWBIE15 — 15% off first order";
    } else if (actionType === "handoff") {
      response = "I’m connecting you with a human agent. You’ll get a follow-up shortly.";
    } else if (message) {
      // No OpenAI: return a simple help guide
      response = helpResponseHTML();
    } else {
      response = helpResponseHTML();
    }

    chatSessions.set(sessionId, session);
    return json({ response, sessionId, timestamp: new Date().toISOString() }, { headers: corsHeaders });
  } catch (error) {
    console.error("❌ Chat API error:", error);
    return json({ error: "Failed to process message" }, { status: 500, headers: corsHeaders });
  }
};

export const loader = async () =>
  json({ message: "Chat API endpoint (Shopify only, no AI)" }, { headers: corsHeaders });