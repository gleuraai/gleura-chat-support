// app/routes/app._index.jsx
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin, billing } = await authenticate.admin(request);
  const currency = "USD";

  // Active subscription
  const plans = ["Monthly Subscription"];
  const status = await billing.check({ isTest: true, plans });

  let activePlan = null;
  const activeSub = status?.subscriptions?.find(s =>
    ["ACTIVE", "PENDING"].includes(s.status)
  );
  if (activeSub?.name) activePlan = activeSub.name;

  return json({ currency, activePlan });
}

export default function AppIndex() {
  const { currency, activePlan } = useLoaderData();

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <h1 style={{ margin: 0, fontSize: 24 }}>Chat Support Dashboard</h1>

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
        <Link to="/app/additional"
          style={{
            display: "inline-block", marginTop: 8, padding: "8px 12px",
            background: "#111827", color: "#fff", borderRadius: 6, textDecoration: "none"
          }}>
          Open Plans & Billing
        </Link>
        {activePlan && (
          <div style={{ marginTop: 8, color: "#6B7280", fontSize: 13 }}>
            Current plan: <strong>{activePlan}</strong>
          </div>
        )}
      </div>

      {/* Your existing block */}
      <div style={{ marginTop: 24, padding: 16, border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff" }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Chat Support Management</h2>
        <p>Manage customer support conversations powered by AI</p>
        <div style={{ marginTop: 12, padding: 12, background: "#F8FAFC", border: "1px dashed #CBD5E1", borderRadius: 6 }}>
          <strong>Recent Conversations</strong>
          <p style={{ margin: 0, color: "#6B7280" }}>
            No conversations yet. Your chat support widget will appear on your storefront.
          </p>
        </div>
      </div>
    </div>
  );
}