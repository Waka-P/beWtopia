import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { getWcoinSummary } from "@/lib/wcoin";
import type { Metadata } from "next";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { WcoinClient } from "./WcoinClient";

export const metadata: Metadata = {
  title: "マイページ - Wコイン",
};

export default async function Wcoin() {
  const headersList = await headers();

  const h = new Headers();
  headersList.forEach((value, key) => {
    h.append(key, value);
  });

  const session = await auth.api.getSession({ headers: h });

  if (!session) {
    return null;
  }

  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  const [{ balance, history }, savedCardAvailable] = await Promise.all([
    getWcoinSummary(userId),
    (async () => {
      const stripeSecret = process.env.STRIPE_SECRET_KEY;
      const email = session.user.email;

      if (!stripeSecret || !email) return false;

      const stripe = getStripe(stripeSecret);

      const list = await stripe.customers.list({ email, limit: 100 });
      // 共有シードでも自分の customer を優先して参照する
      const customer = list.data.find(
        (c) => c.metadata?.publicId === session.user.publicId,
      );
      if (!customer || ("deleted" in customer && customer.deleted)) {
        return false;
      }

      const cust = await stripe.customers.retrieve(customer.id, {
        expand: ["invoice_settings.default_payment_method"],
      });

      const pm = (cust as Stripe.Customer).invoice_settings
        .default_payment_method as
        | Stripe.PaymentMethod
        | string
        | null
        | undefined;
      if (!pm) return false;

      if (typeof pm === "string") return false;

      return !!pm.card;
    })(),
  ]);

  return (
    <WcoinClient
      initialBalance={balance}
      initialHistory={history}
      initialSavedCardAvailable={savedCardAvailable}
    />
  );
}
