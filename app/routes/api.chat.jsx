// app/routes/api.chat.jsx
import { json } from "@remix-run/node";
import shopify from "../shopify.server";

async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}
const normOrderName = v => String(v ?? "").trim().replace(/^#/, "");
const normPhone     = v => String(v ?? "").replace(/\D/g, "");

export const action = async ({ request }) => {
  const body   = await readBody(request);
  const action = body?.action;

  if (action === "ping") return json({ ok: true, pong: true });

  try {
    // App Proxy context → only take `admin`
    const { admin } = await shopify.authenticate.public.appProxy(request);

    if (action === "track_order") {
      const orderNumber = normOrderName(body?.orderNumber);
      const phone       = normPhone(body?.phoneNumber);

      if (!orderNumber) {
        return json({ ok:false, error:"BAD_INPUT", note:"orderNumber required" });
      }

      // Admin search query builder
      const makeQ = (withPhone = true) =>
        withPhone && phone
          ? `name:"#${orderNumber}" AND phone:${phone}`
          : `name:"#${orderNumber}"`;

      // Query with fulfillments (tracking info lives here)
      const QUERY = `#graphql
        query TrackOrder($q: String!) {
          orders(first: 1, query: $q, sortKey: PROCESSED_AT, reverse: true) {
            edges {
              node {
                id
                name
                processedAt
                displayFulfillmentStatus
                totalPriceSet { shopMoney { amount currencyCode } }
                shippingAddress { formatted }
                fulfillments {
                  status
                  trackingInfo { number url company }
                }
              }
            }
          }
        }
      `;

      // Try with phone, then fallback without phone
      async function run(q) {
        const r = await admin.graphql(QUERY, { variables: { q } });
        return await r.json();
      }
      let data = await run(makeQ(true));
      let order = data?.data?.orders?.edges?.[0]?.node ?? null;

      if (!order) {
        // fallback: match only by name
        data = await run(makeQ(false));
        order = data?.data?.orders?.edges?.[0]?.node ?? null;
      }

      if (!order) return json({ ok:false, error:"NOT_FOUND" });

      const shippingAddress = order.shippingAddress?.formatted?.join(", ") ?? null;

      // pick first fulfillment with tracking
      const fulf = (order.fulfillments || []).find(f => (f?.trackingInfo?.length ?? 0) > 0) || null;
      const trk  = fulf?.trackingInfo?.[0] ?? null;

      return json({
        ok: true,
        order: {
          name: order.name,
          date: order.processedAt,
          value: order.totalPriceSet?.shopMoney?.amount ?? null,
          currency: order.totalPriceSet?.shopMoney?.currencyCode ?? null,
          status: order.displayFulfillmentStatus ?? null,
          shippingAddress,
          trackingNumber: trk?.number ?? null,
          trackingUrl: trk?.url ?? null,
          carrier: trk?.company ?? null,
        },
      });
    }

    return json({ ok:false, error:"UNKNOWN_ACTION" });
  } catch (err) {
    return json({ ok:false, error:"INTERNAL_ERROR", note: err?.message || String(err) });
  }
};