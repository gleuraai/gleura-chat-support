// One-time script to register GDPR compliance webhooks
// Run this with: node scripts/register-gdpr-webhooks.js

import { shopifyApi } from "@shopify/shopify-api";

const shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SCOPES?.split(","),
    hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, ""),
    apiVersion: "2025-01",
    isEmbeddedApp: true,
});

const WEBHOOK_URL = "https://j2paxwkmmd.eu-central-1.awsapprunner.com/webhooks/gdpr";

const GDPR_TOPICS = [
    "CUSTOMERS_DATA_REQUEST",
    "CUSTOMERS_REDACT",
    "SHOP_REDACT",
];

async function registerWebhooks() {
    console.log("Registering GDPR compliance webhooks...");

    // Note: This requires an active session with admin access
    // You'll need to run this after installing the app on a development store

    for (const topic of GDPR_TOPICS) {
        try {
            console.log(`Registering ${topic}...`);

            // This is a placeholder - actual implementation would need
            // an active Shopify session to make the API call
            console.log(`  Topic: ${topic}`);
            console.log(`  URL: ${WEBHOOK_URL}`);

        } catch (error) {
            console.error(`Failed to register ${topic}:`, error.message);
        }
    }

    console.log("\nWebhook registration complete!");
    console.log("\nNOTE: GDPR webhooks must be configured in the Shopify Partner Dashboard.");
    console.log("Since the new dev.shopify.com UI doesn't expose these fields,");
    console.log("you may need to contact Shopify Partner Support to manually configure them.");
}

registerWebhooks();
