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
      const status = await billing.check({ isTest: true, plans });
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
        take: 5
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
                let details = "—";
                try {
                  const p = JSON.parse(chat.payload);
                  if (chat.action === "track_order") {
                    details = `Track Order ${p.orderNumber || ""} (Phone: ${p.phoneNumber || "—"})`;
                  } else if (chat.action === "discounts") {
                    details = "Requested discount codes";
                  } else if (p.message) {
                    details = `Message: "${p.message}"`;
                  } else {
                    details = JSON.stringify(p);
                  }
                } catch (e) {
                  details = chat.payload;
                }

                return (
                  <div key={chat.id} style={{ padding: 12, border: "1px solid #E5E7EB", borderRadius: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7280" }}>
                      <span>{new Date(chat.createdAt).toLocaleString()}</span>
                      <span style={{
                        textTransform: "uppercase", fontSize: 10, fontWeight: 700,
                        padding: "2px 6px", borderRadius: 4, background: "#F3F4F6", color: "#374151"
                      }}>
                        {chat.action?.replace("_", " ") || "UNKNOWN"}
                      </span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 14, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {details}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}