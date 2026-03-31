import { auth } from "@/lib/auth";
import { createNotificationWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";

type PurchaseOption = "買い切り" | "サブスク";

type WcoinCheckoutItem = {
  cartItemId: number;
  option: PurchaseOption;
};

type WcoinCheckoutBody = {
  items: WcoinCheckoutItem[];
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

    const body = (await req.json()) as WcoinCheckoutBody;
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return new Response(JSON.stringify({ error: "NO_ITEMS" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // 買い切り・サブスクの両方をWコイン決済対象にする
    const cartItemIds = body.items.map((i) => i.cartItemId);

    const cartItems = await prisma.cartItem.findMany({
      where: {
        id: { in: cartItemIds },
        cart: { userId },
      },
      include: {
        app: {
          include: {
            salesPlans: true,
            paymentMethods: true,
            bewtsProject: {
              include: {
                roles: true,
                rooms: {
                  include: {
                    members: {
                      select: { userId: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (cartItems.length === 0) {
      return new Response(JSON.stringify({ error: "ITEMS_NOT_FOUND" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const cartItemById = new Map(cartItems.map((ci) => [ci.id, ci]));

    // Wコイン決済対象となるアイテムのみ抽出（決済方法にWコインが含まれていることを確認）
    const eligibleItems = body.items.filter((reqItem) => {
      const ci = cartItemById.get(reqItem.cartItemId);
      if (!ci) return false;
      const supportsWcoin = ci.app.paymentMethods.some(
        (pm) => pm.method === "W",
      );
      return supportsWcoin;
    });

    if (eligibleItems.length === 0) {
      return new Response(
        JSON.stringify({ error: "NO_WCOIN_ELIGIBLE_ITEMS" }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { coinBalance: true, name: true },
      });

      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      let remaining = user.coinBalance;
      const purchasedCartItemIds: number[] = [];
      const purchaseDetails: Array<{
        cartItemId: number;
        appId: number;
        appPublicId: string;
        salesPlanId: number;
        price: number;
        option: PurchaseOption;
        ownerUserId: number | null;
        appName: string;
        bewtsRoles: Array<{
          userIds: number[];
          percentage: number;
          isLeader: boolean;
        }>;
      }> = [];

      for (const reqItem of eligibleItems) {
        const ci = cartItemById.get(reqItem.cartItemId);
        if (!ci) continue;

        const plan = ci.app.salesPlans.find((p) =>
          reqItem.option === "買い切り"
            ? p.salesFormat === "P"
            : p.salesFormat === "S",
        );
        if (!plan) continue;

        const price = plan.price;
        if (price <= 0) continue;

        if (remaining < price) {
          continue;
        }

        remaining -= price;
        purchasedCartItemIds.push(ci.id);
        purchaseDetails.push({
          cartItemId: ci.id,
          appId: ci.appId,
          appPublicId: ci.app.publicId,
          salesPlanId: plan.id,
          price,
          option: reqItem.option,
          ownerUserId: ci.app.ownerId ?? null,
          appName: ci.app.name,
          bewtsRoles:
            ci.app.bewtsProject?.roles.map((role) => {
              const roleRoom = ci.app.bewtsProject?.rooms.find(
                (room) => room.roleId === role.id,
              );
              return {
                userIds: Array.from(
                  new Set(
                    (roleRoom?.members ?? []).map((member) => member.userId),
                  ),
                ),
                percentage: role.percentage,
                isLeader: role.isLeader,
              };
            }) ?? [],
        });
      }

      if (purchaseDetails.length === 0) {
        return {
          purchasedCartItemIds: [] as number[],
          skippedCartItemIds: cartItemIds,
          newBalance: user.coinBalance,
        };
      }

      // 残高更新（購入者から減算）
      await tx.user.update({
        where: { id: userId },
        data: { coinBalance: remaining },
      });

      // 販売者/メンバーごとの売上Wコインを集計して加算
      const sellerTotals = new Map<number, number>();

      // 購入履歴作成 + カートから削除 + Wコイン取引履歴
      for (const d of purchaseDetails) {
        // ビューズプロジェクトの利益分配（メンバーごと）
        const roleDistributions = (d.bewtsRoles ?? []).filter(
          (role) => role.percentage > 0 && role.userIds.length > 0,
        );

        const distributions: Array<{ userId: number; amount: number }> = [];

        if (roleDistributions.length > 0) {
          const totalPercent = roleDistributions.reduce(
            (sum, role) => sum + role.percentage,
            0,
          );

          if (totalPercent > 0) {
            let allocated = 0;
            roleDistributions.forEach((role, index) => {
              let share: number;
              if (index === roleDistributions.length - 1) {
                share = d.price - allocated;
              } else {
                share = Math.floor((d.price * role.percentage) / totalPercent);
                allocated += share;
              }
              if (share > 0) {
                const members = role.userIds.filter((id) => id !== userId);
                if (members.length === 0) return;

                let memberAllocated = 0;
                members.forEach((memberId, memberIndex) => {
                  let memberShare: number;
                  if (memberIndex === members.length - 1) {
                    memberShare = share - memberAllocated;
                  } else {
                    memberShare = Math.floor(share / members.length);
                    memberAllocated += memberShare;
                  }

                  if (memberShare > 0) {
                    distributions.push({
                      userId: memberId,
                      amount: memberShare,
                    });
                  }
                });
              }
            });
          }
        }

        // ビューズ分配が無い場合は従来通りオーナーへの一括配分
        if (
          distributions.length === 0 &&
          d.ownerUserId &&
          d.ownerUserId !== userId
        ) {
          distributions.push({ userId: d.ownerUserId, amount: d.price });
        }

        for (const dist of distributions) {
          const prev = sellerTotals.get(dist.userId) ?? 0;
          sellerTotals.set(dist.userId, prev + dist.amount);
        }

        const exists = await tx.purchaseHistory.findFirst({
          where: {
            userId,
            appId: d.appId,
            salesPlanId: d.salesPlanId,
          },
        });

        if (!exists) {
          await tx.purchaseHistory.create({
            data: {
              userId,
              appId: d.appId,
              salesPlanId: d.salesPlanId,
            },
          });
        }

        const memo = `wcoin_purchase:${
          d.option === "サブスク" ? "sub" : "buy"
        }:appName=${encodeURIComponent(d.appName)}:cartItem:${d.cartItemId}`;

        if (distributions.length > 0) {
          // 購入者(sender) → 各メンバー(receiver) へのWコイン送金として記録
          for (const dist of distributions) {
            await tx.coinTransaction.create({
              data: {
                amount: dist.amount,
                memo,
                receiverUserId: dist.userId,
                senderUserId: userId,
              },
            });

            await createNotificationWithUserSetting(tx, {
              userId: dist.userId,
              actorId: userId,
              type: "PURCHASE",
              title: `${user.name}さんが${d.appName}を購入しました`,
              message: `${dist.amount} W を受け取りました`,
              redirectUrl: `/apps/${d.appPublicId}`,
              appId: d.appId,
            });
          }
        } else {
          // 外部への分配がない場合は従来通り自己取引として記録
          await tx.coinTransaction.create({
            data: {
              amount: d.price,
              memo,
              receiverUserId: userId,
              senderUserId: userId,
            },
          });
        }
      }

      // 集計した売上をまとめてメンバーの残高に反映
      for (const [sellerId, total] of sellerTotals) {
        await tx.user.update({
          where: { id: sellerId },
          data: { coinBalance: { increment: total } },
        });
      }

      await tx.cartItem.deleteMany({
        where: { id: { in: purchasedCartItemIds } },
      });

      const skippedCartItemIds = cartItemIds.filter(
        (id) => !purchasedCartItemIds.includes(id),
      );

      return {
        purchasedCartItemIds,
        skippedCartItemIds,
        newBalance: remaining,
      };
    });

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("Wcoin checkout error", e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
