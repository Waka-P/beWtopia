import type https from "https";
import { HttpsProxyAgent } from "https-proxy-agent";
import Stripe from "stripe";

const proxy =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy;

/**
 * Return a Stripe client. If a proxy is configured via env vars,
 * create an HttpsProxyAgent and pass it to the Stripe client so
 * requests go through the corporate proxy.
 */
export function getStripe(secret?: string) {
  const key = secret ?? process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe secret not configured");

  let agent: https.Agent | undefined;
  if (proxy) {
    try {
      console.info("Stripe: using proxy:", proxy);
      agent = new HttpsProxyAgent(proxy) as unknown as https.Agent;
    } catch (e) {
      console.error("Failed to initialize Stripe proxy agent", e);
    }
  }

  // Passing `httpAgent` is accepted by stripe-node; cast to any to avoid
  // tight typing differences across versions.
  const opts: any = {};
  if (agent) opts.httpAgent = agent;

  return new Stripe(key, opts as any);
}

export default getStripe;
