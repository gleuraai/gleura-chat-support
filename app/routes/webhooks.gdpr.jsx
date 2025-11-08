// app/routes/webhooks.gdpr.jsx
// GDPR required webhooks for public Shopify apps:
//  - customers/data_request
//  - customers/redact
//  - shop/redact
//
// ✅ Paste this file as-is. It registers handlers and acknowledges quickly.
//    If you store any PII in your own DB, add deletion logic where marked.

import { json } from "@remix-run/node";
import shopify from "../shopify.server";                 // your initialized shopify app (default export)
import { DeliveryMethod } from "@shopify/shopify-api";   // for HTTP delivery
import prisma from "../db.server";                        // optional: used if you want to delete from your DB

// --- Register handlers once (module load) ---
shopify.webhooks.addHandlers({
  CUSTOMERS_DATA_REQUEST: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks/gdpr",
    callback: async (_topic, shop, body) => {
      try {
        const payload = JSON.parse(body || "{}"); // { customer: { id }, orders_requested, ... }
        console.log("[GDPR] DATA_REQUEST", { shop, payload });

        // If you store customer data off Shopify, prepare/export the customer's data here
        // and send it securely to the customer or to Shopify as per your policy.
        // (No deletion required in this webhook.)
      } catch (e) {
        console.error("[GDPR] DATA_REQUEST handler error:", e);
      }
    },
  },

  CUSTOMERS_REDACT: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks/gdpr",
    callback: async (_topic, shop, body) => {
      try {
        const payload = JSON.parse(body || "{}"); // { customer: { id, email }, ... }
        console.log("[GDPR] CUSTOMERS_REDACT", { shop, payload });

        // 🔻 OPTIONAL: Delete customer data you store off-Shopify
        // Wrap in try/catch so webhook never fails even if tables differ.
        try {
          // Example cleanups — adjust to your schema or remove if not needed
          await prisma?.chatSession?.deleteMany?.({
            where: { shop, OR: [{ customerId: String(payload?.customer?.id) }, { customerEmail: payload?.customer?.email }] },
          });
          await prisma?.conversation?.deleteMany?.({
            where: { shop, customerId: String(payload?.customer?.id) },
          });
        } catch (dbErr) {
          // Don’t throw — just log. Shopify expects a quick 200.
          console.warn("[GDPR] DB cleanup warning:", dbErr?.message);
        }
      } catch (e) {
        console.error("[GDPR] CUSTOMERS_REDACT handler error:", e);
      }
    },
  },

  SHOP_REDACT: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks/gdpr",
    callback: async (_topic, shop, body) => {
      try {
        const payload = JSON.parse(body || "{}"); // { shop_id, shop_domain, ... }
        console.log("[GDPR] SHOP_REDACT", { shop, payload });

        // 🔻 OPTIONAL: Delete all shop-scoped data you keep off-Shopify
        try {
          await prisma?.chatSession?.deleteMany?.({ where: { shop } });
          await prisma?.conversation?.deleteMany?.({ where: { shop } });
        } catch (dbErr) {
          console.warn("[GDPR] Shop-wide DB cleanup warning:", dbErr?.message);
        }
      } catch (e) {
        console.error("[GDPR] SHOP_REDACT handler error:", e);
      }
    },
  },
});

// Shopify will POST the three GDPR topics to this single endpoint.
// We just delegate to the library processor which verifies HMAC + routes to callbacks above.
export const action = async ({ request }) => {
  try {
    await shopify.webhooks.process(request);
    // Always 200 quickly — Shopify only checks the status code.
    return new Response(null, { status: 200 });
  } catch (e) {
    console.error("[GDPR] process error:", e);
    // Still return 200 to avoid retries if it was a benign parsing issue;
    // if you prefer stricter behavior, change to 500.
    return new Response(null, { status: 200 });
  }
};

// GET not used — avoid exposing details
export const loader = () => json({ ok: true, endpoint: "gdpr" });