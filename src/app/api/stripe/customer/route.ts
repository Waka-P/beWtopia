import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { resolveStripeCustomer } from "@/lib/stripeCustomer";
import type Stripe from "stripe";

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return new Response("UNAUTHORIZED", { status: 401 });

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret)
      return new Response("Stripe not configured", { status: 500 });
    const stripe = getStripe(stripeSecret);

    const customer = await resolveStripeCustomer(stripe, session.user);

    const cust = await stripe.customers.retrieve(customer.id, {
      expand: ["invoice_settings.default_payment_method"],
    });

    const pm = (cust as Stripe.Customer).invoice_settings
      .default_payment_method as Stripe.PaymentMethod | null | undefined;
    if (!pm || typeof pm === "string") {
      return new Response(JSON.stringify({ hasDefault: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const details = pm.card
      ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        }
      : null;

    return new Response(JSON.stringify({ hasDefault: !!details, details }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("Get customer default PM error", e);
    // カード情報が取得できない場合も、致命的エラーにはせず
    // 「デフォルトのカードなし」として扱う
    return new Response(JSON.stringify({ hasDefault: false }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
}
