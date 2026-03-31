import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session)
      return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });

    const userId = Number(session.user.id);
    if (!Number.isInteger(userId) || userId <= 0)
      return new Response(JSON.stringify({ error: "INVALID_USER" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret)
      return new Response(JSON.stringify({ error: "STRIPE_NOT_CONFIGURED" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    const stripe = getStripe(stripeSecret);

    const body = (await req.json()) as { paymentIntentId?: string };
    const paymentIntentId = body?.paymentIntentId;
    if (!paymentIntentId)
      return new Response(
        JSON.stringify({ error: "MISSING_PAYMENT_INTENT_ID" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );

    // 最新のPIを取得し、成功しているか確認
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== "succeeded")
      return new Response(
        JSON.stringify({ error: "PAYMENT_NOT_SUCCEEDED", status: pi.status }),
        { status: 400, headers: { "content-type": "application/json" } },
      );

    // 初回インボイスのSubを辿る
    const invoiceId =
      typeof pi.invoice === "string" ? pi.invoice : (pi.invoice as any)?.id;
    let subscriptionId: string | null = null;
    if (invoiceId) {
      const inv = await stripe.invoices.retrieve(invoiceId);
      subscriptionId =
        typeof inv.subscription === "string"
          ? inv.subscription
          : ((inv.subscription as any)?.id ?? null);
    }

    if (!subscriptionId)
      return new Response(
        JSON.stringify({ error: "SUBSCRIPTION_NOT_FOUND_FROM_PI" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );

    // checkoutSessionを紐付けて完了処理
    const checkoutSession = await prisma.checkoutSession.findFirst({
      where: { userId, stripeSessionId: subscriptionId },
      include: { items: true },
    });
    if (!checkoutSession)
      return new Response(
        JSON.stringify({ error: "CHECKOUT_SESSION_NOT_FOUND" }),
        { status: 404, headers: { "content-type": "application/json" } },
      );

    if (checkoutSession.status !== "COMPLETED") {
      await prisma.checkoutSession.update({
        where: { id: checkoutSession.id },
        data: { status: "COMPLETED" },
      });
      for (const it of checkoutSession.items) {
        const exists = await prisma.purchaseHistory.findFirst({
          where: { userId, appId: it.appId, salesPlanId: it.salesPlanId },
        });
        if (!exists) {
          await prisma.purchaseHistory.create({
            data: { userId, appId: it.appId, salesPlanId: it.salesPlanId },
          });
        }
      }
      const cartIds = checkoutSession.items
        .map((i) => i.cartItemId)
        .filter((id): id is number => !!id);
      if (cartIds.length > 0)
        await prisma.cartItem.deleteMany({ where: { id: { in: cartIds } } });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("Finalize subscription error", e);
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
