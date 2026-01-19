import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

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

    // Widget calls this on load to check if it should show
    // Falls through to subscription check below which will return NO_SUBSCRIPTION if no plan
    if (action === "check_subscription") {
      // Continue to subscription check below - it will handle the response
    }

    // ========== SUBSCRIPTION CHECK ==========
    // Verify the merchant has an active subscription before processing
    if (shop && action !== "ping") {
      try {
        // Get the offline session for this shop
        const session = await prisma.session.findFirst({
          where: { shop, isOnline: false },
          orderBy: { expires: 'desc' }
        });

        if (session?.accessToken) {
          const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-01";

          // Check active subscriptions via GraphQL
          const billingQuery = `
            query {
              currentAppInstallation {
                activeSubscriptions {
                  status
                  name
                }
              }
            }
          `;

          const billingRes = await fetch(
            `https://${shop}/admin/api/${apiVersion}/graphql.json`,
            {
              method: "POST",
              headers: {
                "X-Shopify-Access-Token": session.accessToken,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ query: billingQuery }),
            }
          );

          if (billingRes.ok) {
            const billingData = await billingRes.json();
            const subscriptions = billingData?.data?.currentAppInstallation?.activeSubscriptions || [];
            const activeSub = subscriptions.find(sub => sub.status === "ACTIVE");

            if (!activeSub) {
              return json({
                ok: false,
                error: "NO_SUBSCRIPTION",
                message: "This store doesn't have an active subscription. Please subscribe to a plan to use Chat Assistant."
              });
            }

            // ========== CHAT LIMIT CHECK ==========
            // Define limits per plan
            const planLimits = {
              "Basic Plan": 1000,
              "Pro": 2500,
              "Enterprise": 5000
            };

            const planName = activeSub.name;
            const chatLimit = planLimits[planName] || 1000; // Default to Basic if unknown

            // Check current usage
            const currentMonth = new Date().toISOString().slice(0, 7);
            const usageRecord = await prisma.chatUsage.findUnique({ where: { shop } });
            const currentUsage = (usageRecord?.month === currentMonth) ? usageRecord.count : 0;

            if (currentUsage >= chatLimit && action !== "check_subscription") {
              return json({
                ok: false,
                error: "LIMIT_EXCEEDED",
                message: `You've reached your monthly chat limit (${chatLimit} chats). Please upgrade your plan for more chats.`
              });
            }
            // ========== END CHAT LIMIT CHECK ==========
          }
        }
      } catch (billingError) {
        console.error("Billing check error:", billingError);
        // Don't block on billing check errors - log and continue
        // This prevents breaking the widget if there's a temporary API issue
      }
    }
    // ========== END SUBSCRIPTION CHECK ==========

    // For check_subscription action, if we got here it means subscription is active
    if (action === "check_subscription") {
      return json({ ok: true, hasSubscription: true, shop });
    }

    // Helper to log usage
    const logUsage = async (responsePayload) => {
      if (shop && action !== "ping") {
        try {
          const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

          // 1. Save Session
          await prisma.chatSession.create({
            data: {
              shop,
              action: action || "unknown",
              payload: JSON.stringify(body),
              response: JSON.stringify(responsePayload)
            }
          });

          // 2. Update Usage
          const usage = await prisma.chatUsage.findUnique({ where: { shop } });

          if (usage && usage.month === currentMonth) {
            await prisma.chatUsage.update({
              where: { shop },
              data: { count: { increment: 1 } }
            });
          } else {
            // Reset or Create
            await prisma.chatUsage.upsert({
              where: { shop },
              update: { count: 1, month: currentMonth },
              create: { shop, count: 1, month: currentMonth }
            });
          }
        } catch (err) {
          console.error("Failed to log chat/usage:", err);
        }
      }
    };

    if (action === "track_order") {
      let finalPayload = {};

      if (!shop) {
        finalPayload = { ok: false, error: "MISSING_SHOP", message: "We are unable to identify the store. Please try refreshing the page." };
        await logUsage(finalPayload);
        return json(finalPayload);
      }
      if (!orderNumber || !phoneNumber) {
        finalPayload = { ok: false, error: "MISSING_PARAMS", message: "Please provide both your order number and phone number." };
        await logUsage(finalPayload);
        return json(finalPayload);
      }

      const adminToken = proxySession?.accessToken || process.env.SHOPIFY_ADMIN_TOKEN;
      const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-01";
      if (!adminToken) {
        finalPayload = { ok: false, error: "MISSING_ADMIN_TOKEN", message: "Configuration error: Store access token is missing. Please contact support." };
        await logUsage(finalPayload);
        return json(finalPayload);
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
        finalPayload = { ok: false, error: "ADMIN_API_ERROR", status: status, message: "We encountered a temporary issue checking your order. Please try again later." };
      } else {
        const last10 = (s) => String(s || "").replace(/\D/g, "").slice(-10);
        const phone10 = last10(phoneNumber);

        // Match by shipping phone OR customer phone
        const order = orders.find((o) => {
          const s1 = last10(o?.shipping_address?.phone);
          const s2 = last10(o?.customer?.phone);
          return s1 === phone10 || s2 === phone10;
        });

        if (!order) {
          // If we found orders but none matched the phone, give a hint
          if (orders.length > 0) {
            const foundPhones = orders.map(o => {
              const p1 = last10(o.shipping_address?.phone);
              const p2 = last10(o.customer?.phone);
              return p1 || p2 ? `...${(p1 || p2).slice(-4)}` : "No Phone";
            }).join(", ");

            finalPayload = {
              ok: false,
              error: "PHONE_MISMATCH",
              message: `Found order ${orders[0].name}, but the phone number didn't match. Registered phone ends in: ${foundPhones}.`
            };
          } else {
            finalPayload = {
              ok: false,
              error: "NOT_FOUND",
              message: "We couldn't find an order with those details. Please double-check your order number and the phone number used at checkout."
            };
          }
        } else {
          // Tracking (first fulfillment if present)
          const f = (order.fulfillments || [])[0] || {};
          const trackNum =
            f.tracking_number || (Array.isArray(f.tracking_numbers) && f.tracking_numbers[0]) || "";
          const trackUrl =
            f.tracking_url || (Array.isArray(f.tracking_urls) && f.tracking_urls[0]) || "";

          finalPayload = {
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
        }
      }

      await logUsage(finalPayload);
      return json(finalPayload);
    }

    // Handle discounts action
    if (action === "discounts") {
      const payload = {
        ok: true,
        response: "<b>Current Offers:</b><br>• SAVE10 — 10% off<br>• HOLIDAY20 — 20% off orders over ₹4,000<br>• NEWBIE15 — 15% off for new customers"
      };
      await logUsage(payload);
      return json(payload);
    }

    // ========== SMART MESSAGE HANDLING ==========
    // Keyword-based intent detection for free-text messages (zero API cost)
    const detectIntent = (message) => {
      if (!message) return { intent: "general", confidence: "low" };
      const lower = message.toLowerCase();

      // Price/Cost queries (English + Hindi/Hinglish)
      if (/price|cost|how much|kitna|kya rate|rate kya|pricing|charges/.test(lower)) {
        return { intent: "product_inquiry", confidence: "high" };
      }

      // How to order queries (English + Hindi/Hinglish)
      if (/how to order|kaise order|how to buy|kaise kharide|ordering|place order/.test(lower)) {
        return { intent: "how_to_order", confidence: "high" };
      }

      // Order status/tracking hints
      if (/where is my|track|status|kahan|kidhar|order aa gaya|delivery|shipped/.test(lower)) {
        return { intent: "order_status_hint", confidence: "high" };
      }

      // Cancellation/Refund queries
      if (/cancel|refund|money back|return|exchange|vapas|wapas/.test(lower)) {
        return { intent: "cancellation", confidence: "high" };
      }

      // Product recommendation queries
      if (/recommend|suggest|best|which|product for|skin|hair|dry|oily|acne/.test(lower)) {
        return { intent: "product_recommendation", confidence: "medium" };
      }

      // Contact/Support queries
      if (/contact|support|help|call|email|phone|whatsapp|talk to/.test(lower)) {
        return { intent: "contact_support", confidence: "high" };
      }

      // Discount queries
      if (/discount|coupon|offer|code|promo|deal|sale/.test(lower)) {
        return { intent: "discount_query", confidence: "high" };
      }

      // Greeting
      if (/^(hi|hello|hey|hii|hiii|namaste|good morning|good evening)/.test(lower)) {
        return { intent: "greeting", confidence: "high" };
      }

      return { intent: "general", confidence: "low" };
    };

    // Smart responses for each intent
    const getSmartResponse = (intent, originalMessage) => {
      const responses = {
        product_inquiry: {
          ok: true,
          response: "For product prices, please browse our store directly. You can find all products with their current prices on our website. Is there anything specific you're looking for?",
          action: "product_inquiry"
        },
        how_to_order: {
          ok: true,
          response: "<b>How to Place an Order:</b><br>1. Browse our products on the website<br>2. Add items to your cart<br>3. Click on Cart → Checkout<br>4. Enter your shipping details<br>5. Complete payment<br><br>Need help with something specific?",
          action: "how_to_order"
        },
        order_status_hint: {
          ok: true,
          response: "I can help you track your order! Please use the <b>Track Order</b> button and provide your order number and phone number to check your order status.",
          action: "order_status_hint"
        },
        cancellation: {
          ok: true,
          response: "For cancellations, returns, or refunds, please use the <b>Return / Exchange</b> option or contact our support team with your order number. We'll be happy to help!",
          action: "cancellation"
        },
        product_recommendation: {
          ok: true,
          response: "I'd love to help you find the right product! For personalized recommendations, please browse our product categories on the website or contact our support team who can guide you better.",
          action: "product_recommendation"
        },
        contact_support: {
          ok: true,
          response: "You can reach our support team using the <b>Connect to Support</b> button above. We're here to help!",
          action: "contact_support"
        },
        discount_query: {
          ok: true,
          response: "<b>Current Offers:</b><br>• SAVE10 — 10% off<br>• HOLIDAY20 — 20% off orders over ₹4,000<br>• NEWBIE15 — 15% off for new customers<br><br>Apply these codes at checkout!",
          action: "discount_query"
        },
        greeting: {
          ok: true,
          response: "Hello! 👋 I'm here to help you with:<br>• <b>Track Order</b> — Check your order status<br>• <b>Return/Exchange</b> — Start a return<br>• <b>Discounts</b> — View current offers<br>• <b>Shipping</b> — Delivery information<br>• <b>Support</b> — Connect with our team<br><br>How can I assist you today?",
          action: "greeting"
        },
        general: {
          ok: true,
          response: "I can help you with:<br>• <b>Track Order</b> — Check order status<br>• <b>Return/Exchange</b> — Returns & refunds<br>• <b>Discounts</b> — Current offers<br>• <b>Shipping</b> — Delivery info<br>• <b>Support</b> — Contact us<br><br>Please use the buttons above or tell me what you need!",
          action: "general_query"
        }
      };

      return responses[intent] || responses.general;
    };

    // Handle generic messages (missing action) with smart detection
    if (!action && body?.message) {
      const { intent } = detectIntent(body.message);
      const smartResponse = getSmartResponse(intent, body.message);

      const payload = {
        ok: smartResponse.ok,
        response: smartResponse.response
      };

      // Log with detected intent as action (not "unknown")
      await prisma.chatSession.create({
        data: {
          shop,
          action: smartResponse.action || intent,
          payload: JSON.stringify(body),
          response: JSON.stringify(payload)
        }
      });

      // Update usage count
      if (shop) {
        try {
          const currentMonth = new Date().toISOString().slice(0, 7);
          const usage = await prisma.chatUsage.findUnique({ where: { shop } });
          if (usage && usage.month === currentMonth) {
            await prisma.chatUsage.update({
              where: { shop },
              data: { count: { increment: 1 } }
            });
          } else {
            await prisma.chatUsage.upsert({
              where: { shop },
              update: { count: 1, month: currentMonth },
              create: { shop, count: 1, month: currentMonth }
            });
          }
        } catch (err) {
          console.error("Failed to update usage:", err);
        }
      }

      return json(payload);
    }

    // Unknown action (button-based actions that don't match)
    const responsePayload = { ok: false, error: "UNKNOWN_ACTION", message: "I didn't understand that action. Please try using the menu buttons." };
    await logUsage(responsePayload);
    return json(responsePayload);

  } catch (e) {
    console.error("api.chat error", e);
    // Always JSON — never HTML
    return json({ ok: false, error: "INTERNAL_ERROR", message: "Something went wrong on our end. Please try again later." });
  }
};