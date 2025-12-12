// app/routes/app.setup.jsx
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
    const { session } = await authenticate.admin(request);
    const shop = session?.shop;
    const shopName = shop ? shop.replace(".myshopify.com", "") : "my-store";

    return json({ shopName });
}

export default function SetupPage() {
    const { shopName } = useLoaderData();

    // Deep link to open theme editor with app embeds section
    const themeEditorUrl = `https://admin.shopify.com/store/${shopName}/themes/current/editor?context=apps`;

    return (
        <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
            <Link to="/app" style={{ textDecoration: "none" }}>← Back to Dashboard</Link>
            <h1 style={{ marginTop: 8, fontSize: 24 }}>Setup Instructions</h1>

            <div style={{ marginTop: 24, padding: 20, border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff" }}>
                <h2 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Enable Chat Assistant on Your Store</h2>
                <p style={{ marginTop: 12, color: "#6B7280", lineHeight: 1.6 }}>
                    Follow these simple steps to activate the chat widget on your storefront.
                </p>

                <div style={{ marginTop: 24 }}>
                    <ol style={{ paddingLeft: 24, color: "#374151", lineHeight: 2, fontSize: 15 }}>
                        <li>
                            Click the <strong>"Open Theme Editor"</strong> button below.
                        </li>
                        <li>
                            In the Theme Editor sidebar, find <strong>"Chat Assistant"</strong> under App embeds.
                        </li>
                        <li>
                            Toggle the switch to <strong>ON</strong>.
                        </li>
                        <li>
                            Click <strong>Save</strong> in the top right corner.
                        </li>
                        <li>
                            <strong>Done!</strong> The chat widget is now live on your store.
                        </li>
                    </ol>
                </div>

                <a
                    href={themeEditorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: "inline-block",
                        marginTop: 24,
                        padding: "12px 24px",
                        background: "#2563EB",
                        color: "#fff",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontWeight: 600,
                        fontSize: 15,
                        transition: "background 0.2s"
                    }}
                >
                    Open Theme Editor
                </a>
            </div>

            <div style={{ marginTop: 24, padding: 20, border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff" }}>
                <h2 style={{ margin: 0, fontSize: 18, color: "#111827" }}>Customization Options</h2>
                <p style={{ marginTop: 12, color: "#6B7280", lineHeight: 1.6 }}>
                    Once enabled, you can customize the chat widget directly in the Theme Editor:
                </p>
                <ul style={{ marginTop: 16, paddingLeft: 24, color: "#374151", lineHeight: 1.8 }}>
                    <li><strong>Primary Color</strong> – Match your brand colors</li>
                    <li><strong>Widget Title</strong> – Customize the chat header text</li>
                    <li><strong>Return/Exchange Message</strong> – Set your policy response</li>
                    <li><strong>Shipping Info</strong> – Configure delivery information</li>
                    <li><strong>Discount Codes</strong> – Add active promo codes</li>
                    <li><strong>Support Contact</strong> – Phone, email, and hours</li>
                </ul>
            </div>
        </div>
    );
}
