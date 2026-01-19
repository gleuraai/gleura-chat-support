// app/routes/app._index.jsx
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }) {
  try {
    const { admin, billing, session } = await authenticate.admin(request);
    const currency = "USD";
    const shop = session.shop;

    // Active subscription
    const plans = ["Basic Plan", "Pro", "Enterprise"];
    let activePlan = null;
    try {
      const status = await billing.check({ isTest: false, plans });
      const activeSub = status?.appSubscriptions?.find(s => s.status === "ACTIVE");
      if (activeSub) activePlan = activeSub.name;
    } catch (e) {
      console.error("Billing check failed:", e);
    }

    // Fetch Usage & Recent Chats
    let usageCount = 0;
    let recentChats = [];

    try {
      const usageRecord = await prisma.chatUsage.findUnique({ where: { shop } });
      usageCount = usageRecord?.count || 0;

      recentChats = await prisma.chatSession.findMany({
        where: { shop },
        orderBy: { createdAt: "desc" },
        take: 10
      });
    } catch (error) {
      console.error("Dashboard Loader Error (Prisma):", error);
    }

    return json({ currency, activePlan, usageCount, recentChats, shopName: shop.replace('.myshopify.com', '') });

  } catch (fatalError) {
    // Important: Re-throw redirects (Response objects) so auth works
    if (fatalError instanceof Response) {
      throw fatalError;
    }

    console.error("Fatal Dashboard Error:", fatalError);
    return json({
      currency: "USD",
      activePlan: null,
      usageCount: 0,
      recentChats: [],
      error: fatalError.message || "Unknown error"
    });
  }
}

export default function AppIndex() {
  const { currency, activePlan, usageCount, recentChats, error } = useLoaderData();

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <h1 style={{ margin: 0, fontSize: 24 }}>Chat Support Dashboard</h1>

      {error && (
        <div style={{
          marginTop: 16, padding: 12, borderRadius: 8,
          background: "#FEF2F2", color: "#991B1B", border: "1px solid #FCA5A5"
        }}>
          <strong>Dashboard Error:</strong> {error}
          <br />
          <small>Please refresh or contact support if this persists.</small>
        </div>
      )}

      {/* Plans & Billing */}
      <div style={{ marginTop: 24, padding: 16, border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Plans &amp; Billing</h2>
          <span style={{
            padding: "4px 8px", borderRadius: 999,
            background: activePlan ? "#E3FCEF" : "#F3F4F6",
            color: activePlan ? "#03543F" : "#374151", fontSize: 12
          }}>
            {activePlan || "No active plan"}
          </span>
        </div>
        <p style={{ marginTop: 8, color: "#6B7280" }}>Prices shown in {currency}. Manage or upgrade your plan.</p>

        {activePlan && (() => {
          // Define limits per plan
          const planLimits = {
            "Basic Plan": 1000,
            "Pro": 2500,
            "Enterprise": 5000
          };
          const chatLimit = planLimits[activePlan] || 1000;
          const usagePercent = Math.min((usageCount / chatLimit) * 100, 100);
          const isNearLimit = usagePercent >= 80;
          const isOverLimit = usageCount >= chatLimit;

          return (
            <div style={{ marginTop: 12, padding: 12, background: "#F9FAFB", borderRadius: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Current Usage</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>Resets monthly</div>
              </div>

              <div style={{ fontSize: 24, fontWeight: 700, color: isOverLimit ? "#DC2626" : "#111827", marginTop: 4 }}>
                {usageCount.toLocaleString()} / {chatLimit.toLocaleString()} chats
              </div>

              {/* Progress Bar */}
              <div style={{ marginTop: 8, height: 8, background: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  width: `${usagePercent}%`,
                  height: "100%",
                  background: isOverLimit ? "#DC2626" : isNearLimit ? "#F59E0B" : "#10B981",
                  borderRadius: 4,
                  transition: "width 0.3s ease"
                }} />
              </div>

              {isOverLimit && (
                <div style={{
                  marginTop: 12, padding: 10, borderRadius: 6,
                  background: "#FEE2E2", color: "#991B1B", border: "1px solid #FECACA"
                }}>
                  <strong>⚠️ Chat limit reached!</strong> Your chat widget is disabled.
                  <Link to="/app/additional" style={{ marginLeft: 4, color: "#991B1B", fontWeight: 600 }}>Upgrade your plan</Link>
                </div>
              )}

              {isNearLimit && !isOverLimit && (
                <div style={{
                  marginTop: 12, padding: 10, borderRadius: 6,
                  background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A"
                }}>
                  <strong>⚠️ Approaching limit!</strong> You've used {Math.round(usagePercent)}% of your monthly chats.
                </div>
              )}
            </div>
          );
        })()}

        <Link to="/app/additional"
          style={{
            display: "inline-block", marginTop: 12, padding: "8px 12px",
            background: "#111827", color: "#fff", borderRadius: 6, textDecoration: "none"
          }}>
          Open Plans & Billing
        </Link>
      </div>

      {/* Recent Conversations */}
      <div style={{ marginTop: 24, padding: 16, border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff" }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Recent Conversations</h2>
        <div style={{ marginTop: 12 }}>
          {recentChats.length === 0 ? (
            <div style={{ padding: 12, background: "#F8FAFC", border: "1px dashed #CBD5E1", borderRadius: 6, color: "#6B7280" }}>
              No conversations yet. Your chat support widget will appear on your storefront.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentChats.map(chat => {
                // Parse payload and response
                let customerMessage = "—";
                let botResponse = "—";
                try {
                  const p = JSON.parse(chat.payload);
                  if (chat.action === "track_order") {
                    customerMessage = `Order #${p.orderNumber || "—"} (Phone: ${p.phoneNumber || "—"})`;
                  } else if (p.message) {
                    customerMessage = p.message;
                  } else if (p.orderNumber) {
                    customerMessage = `Order: ${p.orderNumber}`;
                  }
                } catch (e) {
                  customerMessage = chat.payload || "—";
                }

                try {
                  const r = JSON.parse(chat.response);
                  if (r.response) {
                    // Strip HTML tags for preview
                    botResponse = r.response.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                  } else if (r.message) {
                    botResponse = r.message;
                  } else if (r.order) {
                    botResponse = `Order ${r.order.name} - ${r.order.status || "Found"}`;
                  } else if (r.error) {
                    botResponse = `Error: ${r.error}`;
                  }
                } catch (e) {
                  botResponse = "—";
                }

                // Better action labels with colors
                const actionLabels = {
                  "track_order": { label: "Track Order", bg: "#DBEAFE", color: "#1E40AF" },
                  "discounts": { label: "Discounts", bg: "#FEF3C7", color: "#92400E" },
                  "product_inquiry": { label: "Product Inquiry", bg: "#E0E7FF", color: "#3730A3" },
                  "how_to_order": { label: "How to Order", bg: "#D1FAE5", color: "#065F46" },
                  "order_status_hint": { label: "Order Status", bg: "#DBEAFE", color: "#1E40AF" },
                  "cancellation": { label: "Return/Cancel", bg: "#FEE2E2", color: "#991B1B" },
                  "product_recommendation": { label: "Product Help", bg: "#FCE7F3", color: "#9D174D" },
                  "contact_support": { label: "Support", bg: "#E0E7FF", color: "#3730A3" },
                  "discount_query": { label: "Discounts", bg: "#FEF3C7", color: "#92400E" },
                  "greeting": { label: "Greeting", bg: "#D1FAE5", color: "#065F46" },
                  "general_query": { label: "General", bg: "#F3F4F6", color: "#374151" },
                  "unknown": { label: "Query", bg: "#F3F4F6", color: "#374151" }
                };

                const actionInfo = actionLabels[chat.action] || actionLabels.unknown;

                return (
                  <details key={chat.id} style={{
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "#fff"
                  }}>
                    <summary style={{
                      padding: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      listStyle: "none"
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: "#6B7280" }}>
                            {new Date(chat.createdAt).toLocaleString()}
                          </span>
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            padding: "3px 8px", borderRadius: 4,
                            background: actionInfo.bg, color: actionInfo.color,
                            textTransform: "uppercase", letterSpacing: "0.5px"
                          }}>
                            {actionInfo.label}
                          </span>
                        </div>
                        <div style={{
                          marginTop: 6,
                          fontSize: 14,
                          color: "#111827",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}>
                          <strong>Customer:</strong> {customerMessage.length > 60 ? customerMessage.slice(0, 60) + "..." : customerMessage}
                        </div>
                        <div style={{
                          marginTop: 4,
                          fontSize: 13,
                          color: "#6B7280",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}>
                          <strong>Bot:</strong> {botResponse.length > 70 ? botResponse.slice(0, 70) + "..." : botResponse}
                        </div>
                      </div>
                      <span style={{ color: "#9CA3AF", fontSize: 12, flexShrink: 0 }}>▼</span>
                    </summary>
                    <div style={{
                      padding: "12px 16px",
                      borderTop: "1px solid #E5E7EB",
                      background: "#F9FAFB",
                      fontSize: 13,
                      lineHeight: 1.6
                    }}>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}>Customer Message:</div>
                        <div style={{ color: "#111827", background: "#fff", padding: 8, borderRadius: 6, border: "1px solid #E5E7EB" }}>
                          {customerMessage}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}>Bot Response:</div>
                        <div style={{ color: "#111827", background: "#fff", padding: 8, borderRadius: 6, border: "1px solid #E5E7EB" }}
                          dangerouslySetInnerHTML={{ __html: botResponse }}
                        />
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}