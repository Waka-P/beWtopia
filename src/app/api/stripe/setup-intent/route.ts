import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { resolveStripeCustomer } from "@/lib/stripeCustomer";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return new Response("UNAUTHORIZED", { status: 401 });

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret)
      return new Response("Stripe not configured", { status: 500 });
    const stripe = getStripe(stripeSecret);

    const customer = await resolveStripeCustomer(stripe, session.user);

    const si = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        userId: String(session.user.id),
        publicId: session.user.publicId,
      },
    });

    return new Response(JSON.stringify({ clientSecret: si.client_secret }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("Create setup intent error", e);
    return new Response("Internal Error", { status: 500 });
  }
}
