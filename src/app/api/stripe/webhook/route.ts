import { createNotificationWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

export async function POST(req: Request) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return new Response("Server Misconfigured", { status: 500 });
  }
  const stripe = getStripe(stripeSecret);

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    if (!webhookSecret || !sig) {
      // 署名検証が設定されていない場合は直接パース（開発用途のみ）
      event = JSON.parse(rawBody) as Stripe.Event;
    } else {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    }
  } catch (err) {
    console.error("Webhook signature verification failed.", err);
    return new Response("Bad Request", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const cs = event.data.object as Stripe.Checkout.Session;
        const meta = cs.metadata || {};
        const userId = Number(meta.userId || cs.client_reference_id);
        if (!Number.isInteger(userId) || userId <= 0) break;
        const buyer = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });

        // メタデータのcheckoutIdからDBレコードを取得
        const checkoutId = meta.checkoutId
          ? Number(meta.checkoutId)
          : undefined;
        if (checkoutId && Number.isInteger(checkoutId)) {
          const checkout = await prisma.checkoutSession.findUnique({
            where: { id: checkoutId },
            include: { items: true },
          });

          if (checkout) {
            // 成功ステータス更新
            await prisma.checkoutSession.update({
              where: { id: checkout.id },
              data: { status: "COMPLETED" },
            });

            // 購入履歴作成 & カート削除
            if (checkout.items.length > 0) {
              for (const it of checkout.items) {
                const exists = await prisma.purchaseHistory.findFirst({
                  where: {
                    userId,
                    appId: it.appId,
                    salesPlanId: it.salesPlanId,
                  },
                });
                if (!exists) {
                  await prisma.purchaseHistory.create({
                    data: {
                      userId,
                      appId: it.appId,
                      salesPlanId: it.salesPlanId,
                    },
                  });

                  const app = await prisma.app.findUnique({
                    where: { id: it.appId },
                    select: {
                      id: true,
                      publicId: true,
                      name: true,
                      ownerId: true,
                    },
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

              await prisma.cartItem.deleteMany({
                where: {
                  id: {
                    in: checkout.items
                      .map((item) => item.cartItemId)
                      .filter((id): id is number => typeof id === "number"),
                  },
                },
              });
            }
          }
        }

        break;
      }
      case "payment_intent.succeeded": {
        // Payment Element（買い切り）の成功時に購入確定
        const pi = event.data.object as Stripe.PaymentIntent;
        const meta = pi.metadata || {};
        const userId = Number(meta.userId);
        // Wコインチャージ（metadata.type === "coin_charge"）か、通常の買い切りかを分岐
        if (meta.type === "coin_charge") {
          const coins = Number(meta.coins);
          if (
            !Number.isInteger(userId) ||
            userId <= 0 ||
            !Number.isInteger(coins) ||
            coins <= 0
          )
            break;
          const existing = await prisma.coinTransaction.findFirst({
            where: { memo: { equals: `coin_charge:${pi.id}` } },
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
                  memo: `coin_charge:${pi.id}`,
                  receiverUserId: userId,
                  senderUserId: null,
                },
              }),
            ]);
          }
        } else {
          const checkoutId = meta.checkoutId
            ? Number(meta.checkoutId)
            : undefined;
          if (
            !Number.isInteger(userId) ||
            userId <= 0 ||
            !Number.isInteger(checkoutId)
          )
            break;
          const checkout = await prisma.checkoutSession.findUnique({
            where: { id: checkoutId },
            include: { items: true },
          });
          if (!checkout) break;
          const buyer = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          });
          if (checkout.status !== "COMPLETED") {
            await prisma.checkoutSession.update({
              where: { id: checkout.id },
              data: { status: "COMPLETED" },
            });
            if (checkout.items.length > 0) {
              for (const it of checkout.items) {
                const exists = await prisma.purchaseHistory.findFirst({
                  where: {
                    userId,
                    appId: it.appId,
                    salesPlanId: it.salesPlanId,
                  },
                });
                if (!exists) {
                  await prisma.purchaseHistory.create({
                    data: {
                      userId,
                      appId: it.appId,
                      salesPlanId: it.salesPlanId,
                    },
                  });

                  const app = await prisma.app.findUnique({
                    where: { id: it.appId },
                    select: {
                      id: true,
                      publicId: true,
                      name: true,
                      ownerId: true,
                    },
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
              await prisma.cartItem.deleteMany({
                where: {
                  id: {
                    in: checkout.items
                      .map((item) => item.cartItemId)
                      .filter((id): id is number => typeof id === "number"),
                  },
                },
              });
            }
          }
        }
        break;
      }
      case "invoice.payment_succeeded": {
        // サブスク更新時などの支払い成功。必要なら拡張。
        break;
      }
      default:
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("Webhook handler error", err);
    return new Response("Internal Error", { status: 500 });
  }
}
