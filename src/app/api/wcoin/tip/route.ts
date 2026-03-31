import { auth } from "@/lib/auth";
import { createNotificationWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";

type TipBody = {
  receiverUserId: number;
  amount: number;
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

    const senderUserId = Number(session.user.id);
    if (!Number.isInteger(senderUserId) || senderUserId <= 0) {
      return new Response(JSON.stringify({ error: "INVALID_USER" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const body = (await req.json()) as TipBody;
    const receiverUserId = Number(body?.receiverUserId);
    const amount = Number(body?.amount);

    if (!Number.isInteger(receiverUserId) || receiverUserId <= 0) {
      return new Response(JSON.stringify({ error: "INVALID_RECEIVER" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (receiverUserId === senderUserId) {
      return new Response(JSON.stringify({ error: "CANNOT_TIP_SELF" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return new Response(JSON.stringify({ error: "INVALID_AMOUNT" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const sender = await prisma.user.findUnique({
      where: { id: senderUserId },
      select: { coinBalance: true },
    });
    if (!sender) {
      return new Response(JSON.stringify({ error: "SENDER_NOT_FOUND" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    if (sender.coinBalance < amount) {
      return new Response(JSON.stringify({ error: "INSUFFICIENT_FUNDS" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const receiverExists = await prisma.user.findUnique({
      where: { id: receiverUserId },
      select: { id: true, name: true },
    });
    if (!receiverExists) {
      return new Response(JSON.stringify({ error: "RECEIVER_NOT_FOUND" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    // 残高更新 + 取引記録（同一トランザクション）
    const actor = await prisma.user.findUnique({
      where: { id: senderUserId },
      select: { name: true },
    });

    const updatedSender = await prisma.$transaction(async (tx) => {
      const senderAfterUpdate = await tx.user.update({
        where: { id: senderUserId },
        data: { coinBalance: { decrement: amount } },
      });

      await tx.user.update({
        where: { id: receiverUserId },
        data: { coinBalance: { increment: amount } },
      });

      await tx.coinTransaction.create({
        data: {
          amount,
          receiverUserId,
          senderUserId: senderUserId,
        },
      });

      await createNotificationWithUserSetting(tx, {
        userId: receiverUserId,
        actorId: senderUserId,
        type: "CHAT",
        title: `${actor?.name ?? "ユーザー"}さんから投げ銭を受け取りました`,
        message: `${amount} W`,
        redirectUrl: "/mypage/wcoin",
      });

      return senderAfterUpdate;
    });

    return new Response(
      JSON.stringify({ ok: true, newBalance: updatedSender.coinBalance }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (e) {
    console.error("Tip error", e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
