import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Gleura Chat Support</h1>
        <p className={styles.text}>
          AI-powered customer support for your Shopify store.
        </p>
        {showForm && (
          <div className={styles.form}>
            <p className={styles.text}>
              To use Gleura Chat Support, please install the app directly from the Shopify App Store.
            </p>
          </div>
        )}
        <ul className={styles.list}>
          <li>
            <strong>AI Chatbot</strong>. Automatically answer customer queries 24/7.
          </li>
          <li>
            <strong>Order Tracking</strong>. Let customers track their orders instantly.
          </li>
          <li>
            <strong>Seamless Integration</strong>. Works perfectly with your Shopify theme.
          </li>
        </ul>
      </div>
    </div>
  );
}
