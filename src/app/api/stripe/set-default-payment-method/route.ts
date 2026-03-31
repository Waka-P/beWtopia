import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { resolveStripeCustomer } from "@/lib/stripeCustomer";
import type Stripe from "stripe";

type Body = { paymentMethodId: string };

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return new Response("UNAUTHORIZED", { status: 401 });

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret)
      return new Response("Stripe not configured", { status: 500 });
    const stripe = getStripe(stripeSecret);

    const body = (await req.json()) as Body;
    if (!body?.paymentMethodId)
      return new Response("BAD_REQUEST", { status: 400 });

    const customer = await resolveStripeCustomer(stripe, session.user);
    let custId = customer.id;

    const paymentMethod = await stripe.paymentMethods.retrieve(
      body.paymentMethodId,
    );
    const attachedCustomerId =
      typeof paymentMethod.customer === "string"
        ? paymentMethod.customer
        : paymentMethod.customer?.id;

    if (attachedCustomerId && attachedCustomerId !== custId) {
      const attachedCustomer =
        await stripe.customers.retrieve(attachedCustomerId);
      const attachedPublicId = (attachedCustomer as Stripe.Customer).metadata
        ?.publicId;
      if (
        !session.user.publicId ||
        attachedPublicId !== session.user.publicId
      ) {
        return new Response(
          JSON.stringify({ error: "PAYMENT_METHOD_OWNER_MISMATCH" }),
          {
            status: 409,
            headers: { "content-type": "application/json" },
          },
        );
      }

      // 同一publicIdの顧客に既にアタッチ済みなら、その顧客を採用
      custId = attachedCustomerId;
    } else if (!attachedCustomerId) {
      await stripe.paymentMethods.attach(body.paymentMethodId, {
        customer: custId,
      });
    }

    await stripe.customers.update(custId, {
      invoice_settings: { default_payment_method: body.paymentMethodId },
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("Set default payment method error", e);
    return new Response("Internal Error", { status: 500 });
  }
}
