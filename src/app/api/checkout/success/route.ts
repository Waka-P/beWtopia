import { createNotificationWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("session_id");
    if (!sessionId) {
      return new Response("Missing session_id", { status: 400 });
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return new Response("Stripe secret not configured", { status: 500 });
    }

    const stripe = getStripe(stripeSecret);
    const cs = await stripe.checkout.sessions.retrieve(sessionId);

    // 成功判定（買い切り: payment_status=paid、サブスク: status=complete）
    const isPaid = cs.payment_status === "paid" || cs.status === "complete";
    if (!isPaid) {
      return new Response("Session not paid", { status: 400 });
    }

    const checkoutIdStr = cs.metadata?.checkoutId;
    const userIdStr =
      cs.metadata?.userId || cs.client_reference_id || undefined;
    const checkoutId = checkoutIdStr ? Number(checkoutIdStr) : undefined;
    const userId = userIdStr ? Number(userIdStr) : undefined;

    if (
      !checkoutId ||
      !Number.isInteger(checkoutId) ||
      !userId ||
      !Number.isInteger(userId)
    ) {
      // まだ購入一覧へは遷移させる
      return Response.redirect(
        new URL("/mypage/purchases?status=success", req.url),
        302,
      );
    }

    const checkout = await prisma.checkoutSession.findUnique({
      where: { id: checkoutId },
      include: {
        items: {
          include: {
            app: {
              select: {
                id: true,
                publicId: true,
                name: true,
                ownerId: true,
              },
            },
          },
        },
      },
    });

    if (!checkout) {
      return Response.redirect(
        new URL("/mypage/purchases?status=success", req.url),
        302,
      );
    }

    if (checkout.status !== "COMPLETED") {
      // 成功ステータス更新
      await prisma.checkoutSession.update({
        where: { id: checkout.id },
        data: { status: "COMPLETED", stripeSessionId: cs.id },
      });

      // 購入履歴作成
      if (checkout.items.length > 0) {
        const buyer = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });

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

            if (it.app.ownerId && it.app.ownerId !== userId) {
              await createNotificationWithUserSetting(prisma, {
                userId: it.app.ownerId,
                actorId: userId,
                type: "PURCHASE",
                title: `${buyer?.name ?? "ユーザー"}さんが${it.app.name}を購入しました`,
                message: null,
                redirectUrl: `/apps/${it.app.publicId}`,
                appId: it.app.id,
              });
            }
          }
        }

        // カートから削除（存在するもののみ）
        const cartIds = checkout.items
          .map((i) => i.cartItemId)
          .filter((id): id is number => !!id);
        if (cartIds.length > 0) {
          await prisma.cartItem.deleteMany({ where: { id: { in: cartIds } } });
        }
      }
    }

    // 購入一覧へリダイレクト
    return Response.redirect(
      new URL("/mypage/purchases?status=success", req.url),
      302,
    );
  } catch (e) {
    console.error("Checkout success finalize error", e);
    // 失敗時も購入一覧へ戻す（UIでエラー表示を検討）
    return Response.redirect(
      new URL("/mypage/purchases?status=error", req.url),
      302,
    );
  }
}
