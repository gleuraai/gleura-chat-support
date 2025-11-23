import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * ALWAYS reply JSON (even on errors) so the widget never tries to parse HTML.
 * Uses a Storefront App Proxy: /apps/chat  →  https://<your-amplify-domain>/api/chat
 *
 * For quick unblocking, this uses a store-level Admin API token from a
 * custom app (read_orders, read_customers). Add it in your deploy env:
 *   SHOPIFY_ADMIN_TOKEN = <admin access token>
 *   SHOPIFY_API_VERSION = 2025-01   (or your chosen version)
 *
 * If you later want to use your public app’s offline token instead,
 * you can swap the fetch() for Admin API calls using your shopify object.
 */

export const loader = () =>
  json({ ok: false, error: "POST_ONLY" }, { status: 405 });

export const action = async ({ request }) => {
  try {
    const url = new URL(request.url);

    // Attempt to authenticate via App Proxy to get the session token
    let proxySession = null;
    try {
      const authResult = await authenticate.public.appProxy(request);
      proxySession = authResult.session;
    } catch (e) {
      // Not a proxy request or auth failed; fall back to manual params
    }

    // App Proxy sends ?shop=gleura-ai.myshopify.com
    const shop =
      proxySession?.shop ||
      url.searchParams.get("shop") ||
      process.env.SHOP_DOMAIN ||
      ""; // fallback for testing

    // Parse JSON body safely
    let body = {};
    try {
      body = await request.json();
    } catch {
      /* no-op */
    }

    const { action, orderNumber, phoneNumber } = body || {};

    // Simple health check so you can test quickly in DevTools:
    // fetch('/apps/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'ping'})}).then(r=>r.json()).then(console.log)
    if (action === "ping") {
      return json({ ok: true, pong: true, shop });
    }

    if (action === "track_order") {
      if (!shop) return json({ ok: false, error: "MISSING_SHOP", message: "Debug: Missing shop parameter" });
      if (!orderNumber || !phoneNumber)
        return json({ ok: false, error: "MISSING_PARAMS", message: "Debug: Missing orderNumber or phoneNumber" });

      const adminToken = proxySession?.accessToken || process.env.SHOPIFY_ADMIN_TOKEN;
      const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-01";
      if (!adminToken) {
        return json({ ok: false, error: "MISSING_ADMIN_TOKEN", message: "Debug: Could not find Admin Token (checked session and SHOPIFY_ADMIN_TOKEN)" });
      }

      // Shopify order "name" includes a leading # (e.g. #1001)
      // But some stores might not use it, or the user might input it differently.
      // We'll try searching for the exact input, and with/without #.

      const rawInput = String(orderNumber).trim();
      const withHash = rawInput.startsWith("#") ? rawInput : `#${rawInput}`;
      const withoutHash = rawInput.replace(/^#/, "");

      // We will try to find the order using the "name" filter which is exact match usually.
      // To be safe, we can try fetching with the "name" param set to the withHash version first.
      // If that fails, we could try the withoutHash version. 
      // However, a single request with multiple names isn't supported by standard "name" filter in all versions (it takes one string).
      // So let's try the most common one (#1001) and if that returns empty, try the other.

      const fetchOrders = async (searchName) => {
        const qs = new URLSearchParams({
          name: searchName,
          status: "any",
          fields:
            "id,name,created_at,total_price,currency,financial_status,fulfillment_status,shipping_address,customer,fulfillments",
        }).toString();

        const res = await fetch(
          `https://${shop}/admin/api/${apiVersion}/orders.json?${qs}`,
          {
            headers: {
              "X-Shopify-Access-Token": adminToken,
              "Content-Type": "application/json",
            },
          }
        );
        if (!res.ok) return { ok: false, status: res.status };
        const data = await res.json();
        return { ok: true, orders: data.orders || [] };
      };

      // 1. Try with hash (e.g. #1001)
      let { ok, orders, status } = await fetchOrders(withHash);

      // 2. If no orders found, try without hash (e.g. 1001)
      if (ok && orders.length === 0 && withHash !== withoutHash) {
        const secondTry = await fetchOrders(withoutHash);
        if (secondTry.ok) {
          orders = secondTry.orders;
        }
      }

      if (!ok) {
        return json({ ok: false, error: "ADMIN_API_ERROR", status: status, message: `Debug: Admin API error ${status}` });
      }

      const last10 = (s) => String(s || "").replace(/\D/g, "").slice(-10);
      const phone10 = last10(phoneNumber);

      // Match by shipping phone OR customer phone
      const order = orders.find((o) => {
        const s1 = last10(o?.shipping_address?.phone);
        const s2 = last10(o?.customer?.phone);
        return s1 === phone10 || s2 === phone10;
      });

      if (!order) {
        // DEBUG: Fetch the last 3 orders to see what their names look like
        let debugNames = "";
        let fetchStatus = "skipped";
        let fetchError = "";
        let scopes = "unknown";

        try {
          // 1. Fetch recent orders
          const debugRes = await fetch(`https://${shop}/admin/api/${apiVersion}/orders.json?status=any&limit=3&fields=name`, {
            headers: { "X-Shopify-Access-Token": adminToken, "Content-Type": "application/json" }
          });
          fetchStatus = debugRes.status;
          if (debugRes.ok) {
            const debugData = await debugRes.json();
            debugNames = (debugData.orders || []).map(o => o.name).join(", ");
          } else {
            fetchError = await debugRes.text();
          }

          // 2. Fetch access scopes to verify permissions
          const scopeRes = await fetch(`https://${shop}/admin/oauth/access_scopes.json`, {
            headers: { "X-Shopify-Access-Token": adminToken, "Content-Type": "application/json" }
          });
          if (scopeRes.ok) {
            const scopeData = await scopeRes.json();
            scopes = (scopeData.access_scopes || []).map(s => s.handle).join(", ");
          }
        } catch (e) {
          fetchError += " | " + e.message;
        }

        return json({
          ok: false,
          error: "NOT_FOUND",
          message: `Debug: Order not found. 
          Shop: ${shop}
          Token: ${adminToken ? "Present (" + adminToken.slice(0, 5) + "...)" : "Missing"}
          Scopes: ${scopes}
          Search: "${withHash}" / "${withoutHash}"
          Matches: ${orders.length}
          Phone: ...${phone10}
          Recent Fetch: ${fetchStatus}
          Recent Orders: [${debugNames}]
          Fetch Error: ${fetchError.slice(0, 100)}`
        });
      }

      // Tracking (first fulfillment if present)
      const f = (order.fulfillments || [])[0] || {};
      const trackNum =
        f.tracking_number || (Array.isArray(f.tracking_numbers) && f.tracking_numbers[0]) || "";
      const trackUrl =
        f.tracking_url || (Array.isArray(f.tracking_urls) && f.tracking_urls[0]) || "";

      const payload = {
        order: {
          name: order.name,
          date: order.created_at,
          value: order.total_price,
          currency: order.currency,
          status:
            order.fulfillment_status ||
            order.financial_status ||
            "—",
          city: order.shipping_address?.city || "",
          zip: order.shipping_address?.zip || "",
          tracking: trackNum
            ? { number: String(trackNum), url: trackUrl || null }
            : null,
        },
      };

      return json(payload);
    }

    // Handle generic messages (missing action)
    if (!action && body?.message) {
      return json({
        ok: true,
        response: "I can help with Track Order, Return/Exchange, Discounts, Shipping & Delivery, or Connect to Support."
      });
    }

    // Unknown action
    return json({ ok: false, error: "UNKNOWN_ACTION", message: "Debug: Unknown action. Please use the buttons." });
  } catch (e) {
    console.error("api.chat error", e);
    // Always JSON — never HTML
    return json({ ok: false, error: "INTERNAL_ERROR", message: `Debug: Internal Error: ${e.message}` });
  }
};