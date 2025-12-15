// app/routes/app.pricing.jsx
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import { authenticate } from "../shopify.server";

// Display labels
const PRICE_LABELS = {
  USD: {
    "Free Trial": "$0",
    "Lite 400": "$5.99 / month",
    "Starter 1K": "$11.99 / month",
    "Growth 2.5K": "$23.99 / month",
    "Scale 5K": "$47.99 / month",
  },
  INR: {
    "Free Trial": "₹0",
    "Lite 400": "₹499 / month",
    "Starter 1K": "₹999 / month",
    "Growth 2.5K": "₹1,999 / month",
    "Scale 5K": "₹3,999 / month",
  },
};

const BASE_PLANS = [
  { key: "Free Trial", chats: "50 (one-time)", bullets: ["50 chats (one-time per store)", "Order tracking & FAQ bot", "Logo + color customization"], cta: "Start Free Trial" },
  { key: "Lite 400", chats: "400 / mo", bullets: ["400 chats / month", "Order tracking & FAQ bot", "Email support"], cta: "Subscribe" },
  { key: "Starter 1K", chats: "1,000 / mo", bullets: ["1,000 chats / month", "Everything in Lite", "Email support"], cta: "Subscribe" },
  { key: "Growth 2.5K", chats: "2,500 / mo", bullets: ["2,500 chats / month", "Priority support"], cta: "Subscribe" },
  { key: "Scale 5K", chats: "5,000 / mo", bullets: ["5,000 chats / month", "Priority support"], cta: "Subscribe" },
];

export async function loader({ request }) {
  const { admin, billing } = await authenticate.admin(request);

  // Currency
  const res = await admin.graphql(`{ shop { currencyCode } }`);
  const jsonRes = await res.json();
  const currency = jsonRes?.data?.shop?.currencyCode === "INR" ? "INR" : "USD";

  // Active sub
  const planNames = [
    "Lite 400 USD", "Starter 1K USD", "Growth 2.5K USD", "Scale 5K USD",
    "Lite 400 INR", "Starter 1K INR", "Growth 2.5K INR", "Scale 5K INR",
  ];
  const status = await billing.check({ isTest: false, plans: planNames });

  let activePlan = null;
  const activeSub = status?.subscriptions?.find((s) =>
    ["ACTIVE", "PENDING"].includes(s.status)
  );
  if (activeSub?.name) activePlan = activeSub.name.replace(" USD", "").replace(" INR", "");

  return json({ currency, activePlan });
}

export async function action({ request }) {
  const form = await request.formData();
  const basePlan = String(form.get("plan") || "");
  const { admin, billing } = await authenticate.admin(request);

  if (basePlan === "Free Trial") {
    return redirect("/app?trial=started");
  }

  // Currency
  const res = await admin.graphql(`{ shop { currencyCode } }`);
  const jsonRes = await res.json();
  const currency = jsonRes?.data?.shop?.currencyCode === "INR" ? "INR" : "USD";
  const planName = `${basePlan} ${currency}`;

  const { confirmationUrl } = await billing.request({
    plan: planName,
    isTest: false,
    returnUrl: `${process.env.SHOPIFY_APP_URL}/app/pricing?installed=1`,
  });

  return redirect(confirmationUrl);
}

export default function PricingPage() {
  const { currency, activePlan } = useLoaderData();
  const price = PRICE_LABELS[currency] || PRICE_LABELS.USD;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <a href="/app" style={{ textDecoration: "none" }}>← Back</a>
      <h1 style={{ marginTop: 8, fontSize: 22 }}>Plans &amp; Billing</h1>

      <div style={{
        marginTop: 16,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 16
      }}>
        {BASE_PLANS.map((p) => {
          const isActive = p.key === activePlan;
          return (
            <div key={p.key} style={{ border: "1px solid #ddd", borderRadius: 10, background: "#fff" }}>
              <div style={{ padding: 16, borderBottom: "1px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: 18 }}>{p.key}</h3>
                  {isActive && (
                    <span style={{ padding: "4px 8px", borderRadius: 999, background: "#e3fcef", color: "#006644", fontSize: 12 }}>
                      Current Plan
                    </span>
                  )}
                </div>
                <div style={{ height: 8 }} />
                <div style={{ fontSize: 24, fontWeight: 600 }}>{price[p.key]}</div>
                <div style={{ color: "#666" }}>{p.chats}</div>
              </div>

              <div style={{ padding: 16 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {p.bullets.map((b, i) => (<li key={i}>{b}</li>))}
                </ul>

                <Form method="post">
                  <input type="hidden" name="plan" value={p.key} />
                  <button type="submit"
                    disabled={isActive}
                    style={{
                      marginTop: 12, width: "100%", padding: "10px 12px",
                      border: "none", borderRadius: 6,
                      background: isActive ? "#e5e7eb" : "#111827",
                      color: isActive ? "#374151" : "#fff",
                      cursor: isActive ? "not-allowed" : "pointer",
                      fontWeight: 600
                    }}>
                    {isActive ? "Current Plan" : p.cta}
                  </button>
                </Form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}