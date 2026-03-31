import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

type Body = {
  appPublicId: string;
};

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session)
      return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
        status: 401,
      });

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret)
      return new Response(JSON.stringify({ error: "STRIPE_NOT_CONFIGURED" }), {
        status: 500,
      });
    const stripe = getStripe(stripeSecret);

    const userId = Number(session.user.id);
    if (!Number.isInteger(userId) || userId <= 0)
      return new Response(JSON.stringify({ error: "INVALID_USER" }), {
        status: 400,
      });

    const body = (await req.json()) as Body;
    if (!body || !body.appPublicId)
      return new Response(JSON.stringify({ error: "INVALID_REQUEST" }), {
        status: 400,
      });

    const app = await prisma.app.findUnique({
      where: { publicId: body.appPublicId },
      include: { salesPlans: true },
    });

    if (!app)
      return new Response(JSON.stringify({ error: "APP_NOT_FOUND" }), {
        status: 404,
      });

    const subPlan = app.salesPlans.find((p) => p.salesFormat === "S");
    if (!subPlan)
      return new Response(
        JSON.stringify({ error: "SUBSCRIPTION_PLAN_NOT_FOUND" }),
        {
          status: 400,
        },
      );

    // ユーザーとアプリに紐づく最新のサブスクCheckoutSessionを取得
    const checkout = await prisma.checkoutSession.findFirst({
      where: {
        userId,
        mode: "S",
        status: "COMPLETED",
        stripeSessionId: { not: null },
        items: {
          some: {
            appId: app.id,
            salesPlanId: subPlan.id,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Stripe ベースのサブスクが見つからない場合は、実際にキャンセルする対象が
    // 存在しないだけなので、処理自体は成功扱いとする（idempotent な no-op）。
    if (!checkout || !checkout.stripeSessionId)
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const subscriptionId = checkout.stripeSessionId;

    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch (e) {
      console.error("Stripe subscription cancel error", e);
      return new Response(JSON.stringify({ error: "STRIPE_CANCEL_FAILED" }), {
        status: 500,
      });
    }

    await prisma.checkoutSession.update({
      where: { id: checkout.id },
      data: { status: "CANCELED" },
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("Cancel subscription error", e);
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
