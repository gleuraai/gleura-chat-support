// app/routes/app.leads.jsx
import { json } from "@remix-run/node";
import { useLoaderData, Form, Link } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }) {
    const { session } = await authenticate.admin(request);
    const shop = session?.shop;

    if (!shop) {
        return json({ leads: [], error: "Shop not found" });
    }

    // Get leads from last 7 days only
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    try {
        const leads = await prisma.customerLead.findMany({
            where: {
                shop,
                createdAt: { gte: sevenDaysAgo }
            },
            orderBy: { createdAt: "desc" }
        });

        return json({ leads, shop });
    } catch (error) {
        console.error("Failed to fetch leads:", error);
        return json({ leads: [], error: error.message });
    }
}

export async function action({ request }) {
    const { session } = await authenticate.admin(request);
    const shop = session?.shop;
    const form = await request.formData();
    const leadId = form.get("leadId");
    const newStatus = form.get("status");

    if (!shop || !leadId) {
        return json({ error: "Invalid request" }, { status: 400 });
    }

    try {
        await prisma.customerLead.update({
            where: { id: leadId },
            data: { status: newStatus }
        });
        return json({ ok: true });
    } catch (error) {
        console.error("Failed to update lead:", error);
        return json({ error: "Failed to update" }, { status: 500 });
    }
}

export default function LeadsPage() {
    const { leads, error } = useLoaderData();

    const statusColors = {
        pending: { bg: "#FEF3C7", color: "#92400E", label: "Pending" },
        contacted: { bg: "#DBEAFE", color: "#1E40AF", label: "Contacted" },
        resolved: { bg: "#D1FAE5", color: "#065F46", label: "Resolved" }
    };

    return (
        <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
            <Link to="/app" style={{ textDecoration: "none", color: "#2563EB" }}>← Back to Dashboard</Link>
            <h1 style={{ marginTop: 8, fontSize: 24 }}>Customer Leads</h1>
            <p style={{ color: "#6B7280", marginTop: 4 }}>
                Customers who requested a callback. Showing last 7 days only.
            </p>

            {error && (
                <div style={{
                    marginTop: 16, padding: 12, borderRadius: 8,
                    background: "#FEE2E2", color: "#991B1B", border: "1px solid #FECACA"
                }}>
                    Error: {error}
                </div>
            )}

            <div style={{ marginTop: 20 }}>
                {leads.length === 0 ? (
                    <div style={{
                        padding: 24,
                        background: "#F9FAFB",
                        border: "1px dashed #D1D5DB",
                        borderRadius: 8,
                        textAlign: "center",
                        color: "#6B7280"
                    }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                        No leads in the last 7 days. When customers request callbacks, they'll appear here.
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {leads.map(lead => {
                            const status = statusColors[lead.status] || statusColors.pending;
                            const date = new Date(lead.createdAt);
                            const timeAgo = getTimeAgo(date);

                            return (
                                <div key={lead.id} style={{
                                    border: "1px solid #E5E7EB",
                                    borderRadius: 10,
                                    background: "#fff",
                                    overflow: "hidden"
                                }}>
                                    {/* Header */}
                                    <div style={{
                                        padding: "12px 16px",
                                        background: "#F9FAFB",
                                        borderBottom: "1px solid #E5E7EB",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center"
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 16, color: "#111827" }}>
                                                {lead.name}
                                            </div>
                                            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                                                {timeAgo} • {date.toLocaleDateString()}
                                            </div>
                                        </div>
                                        <span style={{
                                            padding: "4px 10px",
                                            borderRadius: 999,
                                            fontSize: 11,
                                            fontWeight: 600,
                                            background: status.bg,
                                            color: status.color,
                                            textTransform: "uppercase"
                                        }}>
                                            {status.label}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div style={{ padding: 16 }}>
                                        <div style={{ display: "grid", gap: 12 }}>
                                            {/* Contact Info */}
                                            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                                                <div>
                                                    <div style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase", marginBottom: 2 }}>Phone</div>
                                                    <a href={`tel:${lead.phone}`} style={{ color: "#2563EB", fontWeight: 500, textDecoration: "none" }}>
                                                        📞 {lead.phone}
                                                    </a>
                                                </div>
                                                {lead.email && (
                                                    <div>
                                                        <div style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase", marginBottom: 2 }}>Email</div>
                                                        <a href={`mailto:${lead.email}`} style={{ color: "#2563EB", fontWeight: 500, textDecoration: "none" }}>
                                                            ✉️ {lead.email}
                                                        </a>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Question */}
                                            <div>
                                                <div style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase", marginBottom: 4 }}>Question</div>
                                                <div style={{
                                                    background: "#F3F4F6",
                                                    padding: 10,
                                                    borderRadius: 6,
                                                    fontSize: 14,
                                                    color: "#374151",
                                                    lineHeight: 1.5
                                                }}>
                                                    {lead.question}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                                                {lead.status !== "contacted" && (
                                                    <Form method="post" style={{ display: "inline" }}>
                                                        <input type="hidden" name="leadId" value={lead.id} />
                                                        <input type="hidden" name="status" value="contacted" />
                                                        <button type="submit" style={{
                                                            padding: "8px 14px",
                                                            background: "#2563EB",
                                                            color: "#fff",
                                                            border: "none",
                                                            borderRadius: 6,
                                                            cursor: "pointer",
                                                            fontWeight: 500,
                                                            fontSize: 13
                                                        }}>
                                                            Mark as Contacted
                                                        </button>
                                                    </Form>
                                                )}
                                                {lead.status !== "resolved" && (
                                                    <Form method="post" style={{ display: "inline" }}>
                                                        <input type="hidden" name="leadId" value={lead.id} />
                                                        <input type="hidden" name="status" value="resolved" />
                                                        <button type="submit" style={{
                                                            padding: "8px 14px",
                                                            background: lead.status === "contacted" ? "#059669" : "#E5E7EB",
                                                            color: lead.status === "contacted" ? "#fff" : "#374151",
                                                            border: "none",
                                                            borderRadius: 6,
                                                            cursor: "pointer",
                                                            fontWeight: 500,
                                                            fontSize: 13
                                                        }}>
                                                            Mark as Resolved
                                                        </button>
                                                    </Form>
                                                )}
                                                {lead.status === "resolved" && (
                                                    <span style={{ padding: "8px 14px", color: "#059669", fontWeight: 500 }}>
                                                        ✓ Completed
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Stats */}
            {leads.length > 0 && (
                <div style={{
                    marginTop: 24,
                    padding: 16,
                    background: "#F9FAFB",
                    borderRadius: 8,
                    display: "flex",
                    gap: 24,
                    flexWrap: "wrap"
                }}>
                    <div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>{leads.length}</div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>Total Leads</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "#F59E0B" }}>
                            {leads.filter(l => l.status === "pending").length}
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>Pending</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "#2563EB" }}>
                            {leads.filter(l => l.status === "contacted").length}
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>Contacted</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "#059669" }}>
                            {leads.filter(l => l.status === "resolved").length}
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>Resolved</div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper function
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    const intervals = [
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 }
    ];

    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
        }
    }
    return 'Just now';
}
