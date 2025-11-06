// app/shopify.server.js
import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,

  // ✅ Billing plans (charge in INR for Indian stores, USD otherwise)
  // NOTE: For JS you can use the string enum for interval.
  billing: {
    // USD variants
    "Lite 400 USD":    { amount: 5.99,  currencyCode: "USD", interval: "EVERY_30_DAYS" },
    "Starter 1K USD":  { amount: 11.99, currencyCode: "USD", interval: "EVERY_30_DAYS" },
    "Growth 2.5K USD": { amount: 23.99, currencyCode: "USD", interval: "EVERY_30_DAYS" },
    "Scale 5K USD":    { amount: 47.99, currencyCode: "USD", interval: "EVERY_30_DAYS" },

    // INR variants
    "Lite 400 INR":    { amount: 499,   currencyCode: "INR", interval: "EVERY_30_DAYS" },
    "Starter 1K INR":  { amount: 999,   currencyCode: "INR", interval: "EVERY_30_DAYS" },
    "Growth 2.5K INR": { amount: 1999,  currencyCode: "INR", interval: "EVERY_30_DAYS" },
    "Scale 5K INR":    { amount: 3999,  currencyCode: "INR", interval: "EVERY_30_DAYS" },
  },

  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },

  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;