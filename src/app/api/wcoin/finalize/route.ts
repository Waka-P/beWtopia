import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type FinalizeBody = {
  paymentIntentId: string;
};

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const body = (await req.json()) as FinalizeBody;
    const paymentIntentId = body?.paymentIntentId;
    if (!paymentIntentId) {
      return new Response(
        JSON.stringify({ error: "MISSING_PAYMENT_INTENT_ID" }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret)
      return new Response("Stripe not configured", { status: 500 });
    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe(stripeSecret);

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== "succeeded") {
      return new Response(JSON.stringify({ error: "NOT_SUCCEEDED" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const meta = pi.metadata || {};
    if (meta.type !== "coin_charge") {
      return new Response(JSON.stringify({ error: "NOT_COIN_CHARGE" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const userId = Number(meta.userId);
    const coins = Number(meta.coins);
    if (
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !Number.isInteger(coins) ||
      coins <= 0
    ) {
      return new Response(JSON.stringify({ error: "INVALID_META" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // 二重反映防止（PI IDでメモ識別）
    const existing = await prisma.coinTransaction.findFirst({
      where: { memo: { equals: `coin_charge:${pi.id}` } },
    });
    if (existing) {
      return new Response(JSON.stringify({ ok: true, duplicated: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { coinBalance: { increment: coins } },
      }),
      prisma.coinTransaction.create({
        data: {
          amount: coins,
          memo: `coin_charge:${pi.id}`,
          receiverUserId: userId,
          senderUserId: null,
        },
      }),
    ]);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Finalize coin charge error", err);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
