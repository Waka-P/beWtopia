import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";

type PurchaseOption = "買い切り" | "サブスク";

type CreateCheckoutBody = {
  items: Array<{
    cartItemId: number;
    option: PurchaseOption; // 現在の選択（買い切り or サブスク）
  }>;
};

function getOriginFromHeaders(h: Headers): string {
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  try {
    const origin = getOriginFromHeaders(req.headers);

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

    const body = (await req.json()) as CreateCheckoutBody;
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return new Response(JSON.stringify({ error: "NO_ITEMS" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // 1種類のモードのみ許容（買い切り or サブスク）
    const hasBuy = body.items.some((i) => i.option === "買い切り");
    const hasSub = body.items.some((i) => i.option === "サブスク");
    if (hasBuy && hasSub) {
      return new Response(
        JSON.stringify({ error: "MIXED_MODES_NOT_SUPPORTED" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    const mode: "payment" | "subscription" = hasSub
      ? "subscription"
      : "payment";

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return new Response(JSON.stringify({ error: "MISSING_STRIPE_SECRET_KEY" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe(stripeSecret);

    // カートアイテム取得＆検証
    const cartItems = await prisma.cartItem.findMany({
      where: {
        id: { in: body.items.map((i) => i.cartItemId) },
        cart: { userId },
      },
      include: {
        app: {
          include: { salesPlans: true },
        },
      },
    });

    if (cartItems.length !== body.items.length) {
      return new Response(
        JSON.stringify({ error: "ITEMS_NOT_FOUND_OR_NOT_OWNED" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const purchasedItems: Array<{
      cartItemId: number;
      appId: number;
      salesPlanId: number;
      type: "P" | "S";
      name: string;
    }> = [];

    for (const reqItem of body.items) {
      const cartItem = cartItems.find((ci) => ci.id === reqItem.cartItemId)!;
      const type = reqItem.option === "買い切り" ? "P" : "S";
      const plan = cartItem.app.salesPlans.find((p) => p.salesFormat === type);
      if (!plan) {
        return new Response(JSON.stringify({ error: "MISSING_SALES_PLAN" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      const unitAmount = plan.price; // JPYはゼロ小数通貨のためそのまま

      const productData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData.ProductData =
        {
          name: cartItem.app.name,
          images: cartItem.app.appIconUrl ? [cartItem.app.appIconUrl] : [],
          metadata: {
            appId: String(cartItem.appId),
            salesPlanId: String(plan.id),
            type,
          },
        };

      const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData =
        {
          currency: "jpy",
          unit_amount: unitAmount,
          product_data: productData,
          ...(mode === "subscription"
            ? { recurring: { interval: "month" } }
            : {}),
        };

      line_items.push({ price_data: priceData, quantity: 1 });
      purchasedItems.push({
        cartItemId: cartItem.id,
        appId: cartItem.appId,
        salesPlanId: plan.id,
        type,
        name: cartItem.app.name,
      });
    }

    // 事前にCheckoutSession + itemsを作成
    const checkoutSessionDb = await prisma.checkoutSession.create({
      data: {
        mode: hasSub ? "S" : "P",
        userId,
        items: {
          create: purchasedItems.map((i) => ({
            appId: i.appId,
            salesPlanId: i.salesPlanId,
            cartItemId: i.cartItemId,
          })),
        },
      },
      include: { items: true },
    });

    // 成功時はセッションIDを付けたフォールバックAPIへ
    const successUrl = `${origin}/api/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/checkout?status=cancel&cid=${checkoutSessionDb.id}`;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode,
      line_items,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: String(userId),
      metadata: {
        userId: String(userId),
        publicId: session.user.publicId,
        checkoutId: String(checkoutSessionDb.id),
      },
    });

    // DBにStripeのセッションIDを反映
    await prisma.checkoutSession.update({
      where: { id: checkoutSessionDb.id },
      data: { stripeSessionId: checkoutSession.id },
    });

    return new Response(
      JSON.stringify({ id: checkoutSession.id, url: checkoutSession.url }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (e) {
    console.error("Checkout session error", e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
