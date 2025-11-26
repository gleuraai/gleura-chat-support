// app/routes/webhooks.gdpr.jsx
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  // authenticate.webhook automatically verifies HMAC signatures
  // If the signature is invalid, it throws a 401 error
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Handle mandatory GDPR compliance webhooks
  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      console.log("Customer data request received");
      // TODO: If you store customer data, process the request here
      // For this chat widget app, we just acknowledge the request
      break;

    case "CUSTOMERS_REDACT":
      console.log("Customer data redact received");
      // TODO: Remove any stored customer data for payload.customer_id
      break;

    case "SHOP_REDACT":
      console.log("Shop data redact received");
      // TODO: Remove all shop-scoped data (happens 48 hours after uninstall)
      break;

    default:
      console.log(`Unhandled webhook topic: ${topic}`);
      break;
  }

  return new Response(null, { status: 200 });
}