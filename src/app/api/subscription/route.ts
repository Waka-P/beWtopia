import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { resolveStripeCustomer } from "@/lib/stripeCustomer";
import type Stripe from "stripe";

type PurchaseOption = "買い切り" | "サブスク";

type Body = {
  items: Array<{ cartItemId: number; option: PurchaseOption }>;
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
    if (!body || !Array.isArray(body.items) || body.items.length === 0)
      return new Response(JSON.stringify({ error: "NO_ITEMS" }), {
        status: 400,
      });

    // サブスクのみ許可
    const hasSub = body.items.every((i) => i.option === "サブスク");
    if (!hasSub)
      return new Response(
        JSON.stringify({ error: "ONLY_SUBSCRIPTION_ALLOWED" }),
        { status: 400 },
      );

    // カートアイテムの検証
    const cartItems = await prisma.cartItem.findMany({
      where: {
        id: { in: body.items.map((i) => i.cartItemId) },
        cart: { userId },
      },
      include: { app: { include: { salesPlans: true } } },
    });
    if (cartItems.length !== body.items.length)
      return new Response(
        JSON.stringify({ error: "ITEMS_NOT_FOUND_OR_NOT_OWNED" }),
        { status: 400 },
      );

    // CheckoutSessionとCheckoutItemsを作成
    const purchasedItems: Array<{
      cartItemId: number;
      appId: number;
      salesPlanId: number;
      name: string;
      price: number;
    }> = [];
    for (const reqItem of body.items) {
      const ci = cartItems.find((x) => x.id === reqItem.cartItemId);
      if (!ci)
        return new Response(JSON.stringify({ error: "ITEM_NOT_FOUND" }), {
          status: 400,
        });
      const plan = ci.app.salesPlans.find((p) => p.salesFormat === "S");
      if (!plan)
        return new Response(JSON.stringify({ error: "MISSING_SALES_PLAN" }), {
          status: 400,
        });
      purchasedItems.push({
        cartItemId: ci.id,
        appId: ci.appId,
        salesPlanId: plan.id,
        name: ci.app.name,
        price: plan.price,
      });
    }

    const checkoutSession = await prisma.checkoutSession.create({
      data: {
        mode: "S",
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

    // 顧客の取得・デフォルト支払い方法確認
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
    if (!pmId)
      return new Response(JSON.stringify({ error: "NO_SAVED_CARD" }), {
        status: 400,
      });

    // 各アイテムのPriceを作成（サブスクはinlineのprice_dataが使えないため）
    const prices = await Promise.all(
      purchasedItems.map((it) =>
        stripe.prices.create({
          currency: "jpy",
          unit_amount: it.price,
          recurring: { interval: "month" },
          product_data: {
            name: it.name,
            metadata: {
              appId: String(it.appId),
              salesPlanId: String(it.salesPlanId),
            },
          },
        }),
      ),
    );

    // サブスク作成（複数アイテム対応）
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: prices.map((p) => ({ price: p.id })),
      payment_behavior: "default_incomplete",
      collection_method: "charge_automatically",
      payment_settings: { payment_method_types: ["card"] },
      metadata: {
        userId: String(userId),
        publicId: session.user.publicId,
        checkoutId: String(checkoutSession.id),
      },
      expand: ["latest_invoice.payment_intent"],
    });

    // CheckoutSessionにサブスクIDを保存（後続の確定APIやWebhookで参照）
    await prisma.checkoutSession.update({
      where: { id: checkoutSession.id },
      data: { stripeSessionId: subscription.id },
    });

    const latest = subscription.latest_invoice as Stripe.Invoice | null;
    const pi = latest?.payment_intent as
      | Stripe.PaymentIntent
      | null
      | undefined;
    let status: string | undefined = pi?.status;
    // オフセッションで決済試行（必要なら）
    if (
      pi &&
      (pi.status === "requires_action" ||
        pi.status === "requires_payment_method")
    ) {
      try {
        const confirmed = await stripe.paymentIntents.confirm(pi.id, {
          off_session: true,
        });
        status = confirmed.status;
      } catch {
        // 3Dセキュアなどの追加認証が必要
        status = "requires_action";
      }
    }

    if (
      status === "succeeded" ||
      subscription.status === "active" ||
      subscription.status === "trialing"
    ) {
      // 成功扱い：購入履歴作成・カート削除・セッション完了
      await prisma.checkoutSession.update({
        where: { id: checkoutSession.id },
        data: { status: "COMPLETED" },
      });
      for (const it of checkoutSession.items) {
        await prisma.purchaseHistory.create({
          data: { userId, appId: it.appId, salesPlanId: it.salesPlanId },
        });
      }
      const cartIds = checkoutSession.items
        .map((i) => i.cartItemId)
        .filter((id): id is number => !!id);
      if (cartIds.length > 0)
        await prisma.cartItem.deleteMany({ where: { id: { in: cartIds } } });
      return new Response(
        JSON.stringify({ ok: true, subscriptionId: subscription.id }),
        { status: 200 },
      );
    }

    // 認証が必要などの未完了ケース
    return new Response(
      JSON.stringify({
        error: "REQUIRES_ACTION_OR_FAILED",
        status: status ?? subscription.status,
        clientSecret: pi?.client_secret ?? null,
        paymentIntentId: pi?.id ?? null,
        invoiceId: latest?.id ?? null,
        invoiceUrl: latest?.hosted_invoice_url ?? null,
        message:
          status === "requires_action"
            ? "追加認証が必要です。画面の案内に従って認証を完了してください。"
            : undefined,
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  } catch (e) {
    console.error("Create subscription error", e);
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
