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

const PLANS = [
  {
    name: "Basic Plan",
    price: "$9.99 / month",
    chats: "Up to 1,000 chats / month",
    features: [
      "1-day free trial",
      "Up to 1,000 chats / month",
      "Order tracking & FAQ bot",
      "Email support"
    ],
    cta: "Start Free Trial"
  },
  {
    name: "Pro",
    price: "$19.99 / month",
    chats: "Up to 2,500 chats / month",
    features: [
      "Up to 2,500 chats / month",
      "Order tracking & FAQ bot",
      "Priority Email support",
      "Removed Branding"
    ],
    cta: "Upgrade to Pro"
  },
  {
    name: "Enterprise",
    price: "$49.99 / month",
    chats: "Up to 5,000 chats / month",
    features: [
      "Up to 5,000 chats / month",
      "Order tracking & FAQ bot",
      "Dedicated Support",
      "Custom Features"
    ],
    cta: "Upgrade to Enterprise"
  }
];

export async function loader({ request }) {
  const { billing } = await authenticate.admin(request);
  const url = new URL(request.url);
  const installed = url.searchParams.get("installed") === "1";

  const billingCheck = await billing.check({
    isTest: true,
    plans: ["Basic Plan", "Pro", "Enterprise"],
    returnObject: true,
  });

  let activePlan = null;
  const activeSub = billingCheck?.appSubscriptions?.find(s => s.status === "ACTIVE");
  if (activeSub) {
    activePlan = activeSub.name;
  }

  return json({ activePlan, installed });
}

export async function action({ request }) {
  const { billing } = await authenticate.admin(request);
  const form = await request.formData();
  const plan = form.get("plan");

  if (!plan) {
    return json({ error: "No plan selected" }, { status: 400 });
  }

  let appUrl = process.env.SHOPIFY_APP_URL;
  if (appUrl) {
    appUrl = appUrl.trim().replace(/\/$/, "");
  } else {
    // Fallback if env var is missing (shouldn't happen in prod)
    appUrl = "https://j2paxwkmmd.eu-central-1.awsapprunner.com";
  }

  const returnUrl = `${appUrl}/app/additional?installed=1`;

  try {
    const { confirmationUrl } = await billing.request({
      plan: plan,
      isTest: true,
      returnUrl: returnUrl,
    });
    return redirect(confirmationUrl);
  } catch (error) {
    console.error("Billing request failed:", error);
    // Serialize the error to see the full details in the UI
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    return json({ error: `Billing failed: ${errorMessage}` }, { status: 500 });
  }
}

export default function AdditionalPage() {
  const { activePlan, installed } = useLoaderData();
  const actionData = useActionData();

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <Link to="/app" style={{ textDecoration: "none" }}>← Back to Dashboard</Link>
      <h1 style={{ marginTop: 8, fontSize: 24 }}>Plans & Billing</h1>

      {actionData?.error && (
        <div style={{
          marginTop: 12, padding: 12, borderRadius: 8,
          background: "#FEE", color: "#C00", border: "1px solid #FCC"
        }}>
          <strong>Error:</strong> {actionData.error}
        </div>
      )}

      {installed && (
        <div style={{
          marginTop: 12, padding: 12, borderRadius: 8,
          background: "#E3FCEF", color: "#03543F", border: "1px solid #84E1BC"
        }}>
          Subscription updated successfully.
        </div>
      )}

      <div style={{
        marginTop: 16,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 16
      }}>
        {PLANS.map((p) => {
          const isActive = p.name === activePlan;
          return (
            <div key={p.name} style={{ border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: 16, borderBottom: "1px solid #F3F4F6" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: 18 }}>{p.name}</h3>
                  {isActive && (
                    <span style={{ padding: "4px 8px", borderRadius: 999, background: "#E3FCEF", color: "#03543F", fontSize: 12, fontWeight: 600 }}>
                      Current Plan
                    </span>
                  )}
                </div>
                <div style={{ height: 8 }} />
                <div style={{ fontSize: 24, fontWeight: 600 }}>{p.price}</div>
                <div style={{ color: "#6B7280" }}>{p.chats}</div>
              </div>

              <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
                <ul style={{ margin: 0, paddingLeft: 18, flex: 1 }}>
                  {p.features.map((f, i) => (<li key={i} style={{ marginBottom: 4 }}>{f}</li>))}
                </ul>

                <Form method="post" style={{ marginTop: 16 }}>
                  <input type="hidden" name="plan" value={p.name} />
                  <button
                    type="submit"
                    disabled={isActive}
                    style={{
                      width: "100%", padding: "10px 12px",
                      border: "none", borderRadius: 6,
                      background: isActive ? "#E5E7EB" : "#111827",
                      color: isActive ? "#374151" : "#fff",
                      cursor: isActive ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      transition: "background 0.2s"
                    }}
                  >
                    {isActive ? "Active" : p.cta}
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