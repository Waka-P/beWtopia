import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";

type CreateChargeBody = {
  coins: number; // チャージするWコイン数（1コイン=¥1）
  useSavedCard?: boolean; // 既存の保存カードを使う
  confirmNow?: boolean; // サーバー側で直ちに確定（3Dセキュア等が不要な場合）
  memo?: string; // 取引メモ
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

    const userId = Number(session.user.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return new Response(JSON.stringify({ error: "INVALID_USER" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const body = (await req.json()) as CreateChargeBody;
    const coins = Number(body?.coins ?? 0);
    if (!Number.isInteger(coins) || coins <= 0) {
      return new Response(JSON.stringify({ error: "INVALID_COINS" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // 1コイン=¥1（JPYは0小数通貨）
    const amount = coins;

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return new Response(JSON.stringify({ error: "STRIPE_NOT_CONFIGURED" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe(stripeSecret);

    let paymentIntent: Stripe.PaymentIntent;

    if (body.useSavedCard) {
      // 顧客の既存デフォルトカードでオフセッション決済
      const email = session.user.email;
      let customer: Stripe.Customer | null = null;
      if (email) {
        const list = await stripe.customers.list({ email, limit: 100 });
        // metadata.publicId が一致する顧客を優先して使う
        customer =
          (list.data.find(
            (c) => c.metadata?.publicId === session.user.publicId,
          ) as Stripe.Customer) ?? null;
      }
      if (!customer) {
        customer = await stripe.customers.create({
          email: session.user.email ?? undefined,
          metadata: {
            userId: String(session.user.id),
            publicId: session.user.publicId,
          },
        });
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
      const pmId = typeof pm === "string" ? pm : pm?.id;
      if (!pmId) {
        return new Response(JSON.stringify({ error: "NO_SAVED_CARD" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "jpy",
        customer: customer.id,
        payment_method: pmId,
        off_session: true,
        confirm: !!body.confirmNow,
        metadata: {
          type: "coin_charge",
          userId: String(userId),
          publicId: session.user.publicId,
          coins: String(coins),
          memo: body.memo ?? "",
        },
      });
    } else {
      // Payment Elementでカード入力→フロントでconfirm
      paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "jpy",
        automatic_payment_methods: { enabled: true },
        metadata: {
          type: "coin_charge",
          userId: String(userId),
          publicId: session.user.publicId,
          coins: String(coins),
          memo: body.memo ?? "",
        },
      });
    }

    // すでに成功なら即座に残高反映（webhook不要でも体験良く）
    if (paymentIntent.status === "succeeded") {
      const existing = await prisma.coinTransaction.findFirst({
        where: { memo: { equals: `coin_charge:${paymentIntent.id}` } },
      });
      if (!existing) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: { coinBalance: { increment: coins } },
          }),
          prisma.coinTransaction.create({
            data: {
              amount: coins,
              memo: `coin_charge:${paymentIntent.id}`,
              receiverUserId: userId,
              senderUserId: null,
            },
          }),
        ]);
      }
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
        paymentIntentId: paymentIntent.id,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (e) {
    console.error("Create coin charge intent error", e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
