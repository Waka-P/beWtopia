import { auth } from "@/lib/auth";
import { createNotificationWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import { resolveStripeCustomer } from "@/lib/stripeCustomer";
import type Stripe from "stripe";

type PurchaseOption = "買い切り" | "サブスク";

type CreateIntentBody = {
  items: Array<{
    cartItemId: number;
    option: PurchaseOption;
  }>;
  useSavedCard?: boolean;
  confirmNow?: boolean;
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

    const body = (await req.json()) as CreateIntentBody;
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return new Response(JSON.stringify({ error: "NO_ITEMS" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const hasBuy = body.items.some((i) => i.option === "買い切り");
    const hasSub = body.items.some((i) => i.option === "サブスク");
    if (hasBuy && hasSub) {
      return new Response(
        JSON.stringify({ error: "MIXED_MODES_NOT_SUPPORTED" }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (hasSub && !hasBuy) {
      // Payment Elementでのサブスクは別フローが必要なため、現時点では未対応
      return new Response(
        JSON.stringify({
          error: "SUBSCRIPTION_NOT_SUPPORTED_WITH_PAYMENT_ELEMENT",
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return new Response(JSON.stringify({ error: "STRIPE_NOT_CONFIGURED" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe(stripeSecret);

    const cartItems = await prisma.cartItem.findMany({
      where: {
        id: { in: body.items.map((i) => i.cartItemId) },
        cart: { userId },
      },
      include: { app: { include: { salesPlans: true } } },
    });

    if (cartItems.length !== body.items.length) {
      return new Response(
        JSON.stringify({ error: "ITEMS_NOT_FOUND_OR_NOT_OWNED" }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }

    // 買い切り価格の合計を算出
    let amount = 0;
    const purchasedItems: Array<{
      cartItemId: number;
      appId: number;
      salesPlanId: number;
    }> = [];
    for (const reqItem of body.items) {
      if (reqItem.option !== "買い切り") continue;
      const ci = cartItems.find((x) => x.id === reqItem.cartItemId);
      if (!ci) {
        return new Response(JSON.stringify({ error: "ITEM_NOT_FOUND" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      const plan = ci.app.salesPlans.find((p) => p.salesFormat === "P");
      if (!plan) {
        return new Response(JSON.stringify({ error: "MISSING_SALES_PLAN" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      amount += plan.price;
      purchasedItems.push({
        cartItemId: ci.id,
        appId: ci.appId,
        salesPlanId: plan.id,
      });
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: "ZERO_AMOUNT" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // 決済レコード（CheckoutSession）を生成して紐付け
    const checkoutSession = await prisma.checkoutSession.create({
      data: {
        mode: "P",
        userId,
        items: {
          create: purchasedItems.map((it) => ({
            appId: it.appId,
            salesPlanId: it.salesPlanId,
            cartItemId: it.cartItemId,
          })),
        },
      },
      include: { items: true },
    });

    let paymentIntent: Stripe.PaymentIntent;

    if (body.useSavedCard) {
      // 既存の顧客とデフォルトカードでPIを作成
      const customer = await resolveStripeCustomer(stripe, session.user);

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

      // サーバー側でオフセッション即時決済
      paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "jpy",
        customer: customer.id,
        payment_method: pmId,
        off_session: true,
        confirm: !!body.confirmNow,
        metadata: {
          userId: String(userId),
          publicId: session.user.publicId,
          checkoutId: String(checkoutSession.id),
        },
      });
    } else {
      paymentIntent = await stripe.paymentIntents.create({
        amount, // JPYはゼロ小数通貨
        currency: "jpy",
        metadata: {
          userId: String(userId),
          publicId: session.user.publicId,
          checkoutId: String(checkoutSession.id),
        },
        // Payment Elementでカード入力
        automatic_payment_methods: { enabled: true },
      });
    }

    // 便宜的にstripeSessionIdへPIのIDを保存（既存フィールドの再利用）
    await prisma.checkoutSession.update({
      where: { id: checkoutSession.id },
      data: { stripeSessionId: paymentIntent.id },
    });

    // サーバー側で決済成功時に同期的に購入確定（webhook未設定でも反映されるように）
    if (paymentIntent.status === "succeeded") {
      await prisma.checkoutSession.update({
        where: { id: checkoutSession.id },
        data: { status: "COMPLETED" },
      });
      const buyer = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      for (const it of checkoutSession.items) {
        const exists = await prisma.purchaseHistory.findFirst({
          where: { userId, appId: it.appId, salesPlanId: it.salesPlanId },
        });
        if (!exists) {
          await prisma.purchaseHistory.create({
            data: { userId, appId: it.appId, salesPlanId: it.salesPlanId },
          });

          const app = await prisma.app.findUnique({
            where: { id: it.appId },
            select: { id: true, publicId: true, name: true, ownerId: true },
          });

          if (app?.ownerId && app.ownerId !== userId) {
            await createNotificationWithUserSetting(prisma, {
              userId: app.ownerId,
              actorId: userId,
              type: "PURCHASE",
              title: `${buyer?.name ?? "ユーザー"}さんが${app.name}を購入しました`,
              message: null,
              redirectUrl: `/apps/${app.publicId}`,
              appId: app.id,
            });
          }
        }
      }
      const cartIds = checkoutSession.items
        .map((i) => i.cartItemId)
        .filter((id): id is number => !!id);
      if (cartIds.length > 0) {
        await prisma.cartItem.deleteMany({ where: { id: { in: cartIds } } });
      }
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
        checkoutId: checkoutSession.id,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (e) {
    console.error("Create payment intent error", e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
