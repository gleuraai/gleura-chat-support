// app/routes/app.additional.jsx
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, Link, useActionData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

const PRICE_LABELS = {
  USD: {
    "Monthly Subscription": "$9.99 / month",
  },
};

const BASE_PLANS = [
  {
    key: "Monthly Subscription", chats: "Unlimited chats", bullets: [
      "1-day free trial", "Unlimited chats / month", "Order tracking & FAQ bot", "Email support", "Priority support"
    ], cta: "Start Free Trial"
  },
];

export async function loader({ request }) {
  const url = new URL(request.url);
  const installed = url.searchParams.get("installed") === "1";

  const { admin } = await authenticate.admin(request);
  const currency = "USD";

  return json({ currency, installed });
}

export default function AdditionalPage() {
  const { currency, installed } = useLoaderData();

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <Link to="/app" style={{ textDecoration: "none" }}>← Back to Dashboard</Link>
      <h1 style={{ marginTop: 8, fontSize: 24 }}>Plans & Billing</h1>

      {installed && (
        <div style={{
          marginTop: 12, padding: 12, borderRadius: 8,
          background: "#E3FCEF", color: "#03543F", border: "1px solid #84E1BC"
        }}>
          Subscription activated successfully.
        </div>
      )}

      <div style={{
        marginTop: 16,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 16
      }}>
        <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff" }}>
          <div style={{ padding: 16, borderBottom: "1px solid #F3F4F6" }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Monthly Subscription</h3>
            <div style={{ height: 8 }} />
            <div style={{ fontSize: 24, fontWeight: 600 }}>$9.99 / month</div>
            <div style={{ color: "#6B7280" }}>Unlimited chats</div>
          </div>

          <div style={{ padding: 16 }}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>1-day free trial</li>
              <li>Unlimited chats / month</li>
              <li>Order tracking & FAQ bot</li>
              <li>Email support</li>
              <li>Priority support</li>
            </ul>

            <div style={{
              marginTop: 12, padding: 12, background: "#F3F4F6", borderRadius: 6,
              fontSize: 14, color: "#4B5563", textAlign: "center"
            }}>
              Billing is managed by Shopify App Store
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}