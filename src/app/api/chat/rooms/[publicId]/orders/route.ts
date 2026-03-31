import { createChatOrderSchema } from "@/app/schemas/chatOrder";
import { auth } from "@/lib/auth";
import { genPublicId } from "@/lib/id";
import { createNotificationWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const { publicId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createChatOrderSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((err) => ({
      path: err.path.join("."),
      message: err.message,
    }));

    return NextResponse.json(
      {
        error: "Validation failed",
        details: errors,
      },
      { status: 400 },
    );
  }

  const { title, description, price, deadline, priceUnit } = parsed.data;

  // 期限は YYYY-MM-DD のみ許容し、Date に変換
  let deadlineDate: Date | null = null;
  if (deadline) {
    const d = new Date(deadline);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "Invalid deadline date" },
        { status: 400 },
      );
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);

    if (d < today) {
      return NextResponse.json(
        { error: "過去の日付は希望納期に指定できません" },
        { status: 400 },
      );
    }
    deadlineDate = d;
  }

  try {
    const room = await prisma.chatRoom.findUnique({
      where: { publicId },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const isMember = room.members.some((m) => m.userId === userId);
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const opponentMember = room.members.find((m) => m.userId !== userId);
    if (!opponentMember) {
      return NextResponse.json(
        { error: "Opponent not found in room" },
        { status: 400 },
      );
    }

    const opponentId = opponentMember.userId;

    // ブロック状態を確認（どちらか一方でもブロックしている場合は送信不可）
    const block = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: opponentId },
          { blockerId: opponentId, blockedId: userId },
        ],
      },
    });

    if (block) {
      return NextResponse.json(
        { error: "このユーザとのチャットは現在無効化されています" },
        { status: 403 },
      );
    }

    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description).replace(/\n/g, "<br/>");
    const safePrice =
      typeof price === "number" && Number.isFinite(price) ? price : null;

    const deadlineLabel = deadlineDate
      ? deadlineDate.toISOString().slice(0, 10)
      : null;

    const contentHtmlParts: string[] = [];
    contentHtmlParts.push("<p><strong>オーダー</strong></p>");
    contentHtmlParts.push(`<p>タイトル：${safeTitle}</p>`);
    contentHtmlParts.push(`<p>内容：</p><p>${safeDescription}</p>`);
    if (safePrice != null) {
      const unit = priceUnit ?? "BOTH";
      let priceLabel = "";
      if (unit === "YEN") {
        priceLabel = `${safePrice.toLocaleString()}円`;
      } else if (unit === "BOTH") {
        priceLabel = `${safePrice.toLocaleString()}円 / ${safePrice.toLocaleString()} W`;
      } else {
        priceLabel = `${safePrice.toLocaleString()} W`;
      }
      contentHtmlParts.push(`<p>希望金額：${priceLabel}</p>`);
    }
    if (deadlineLabel) {
      contentHtmlParts.push(`<p>希望納期：${deadlineLabel}</p>`);
    }

    const contentHtml = contentHtmlParts.join("");

    const newMessage = await prisma.chatMessage.create({
      data: {
        publicId: genPublicId(),
        content: contentHtml,
        roomId: room.id,
        userId,
        order: {
          create: {
            publicId: genPublicId(),
            title,
            description,
            price: safePrice,
            priceUnit: priceUnit ?? "BOTH",
            deadline: deadlineDate,
            requesterUserId: userId,
            targetUserId: opponentId,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            publicId: true,
            name: true,
            image: true,
          },
        },
        attachments: true,
        reactions: true,
        order: true,
      },
    });

    const responseMsg = {
      id: newMessage.id,
      publicId: newMessage.publicId,
      content: newMessage.content,
      createdAt: newMessage.createdAt,
      user: newMessage.user,
      reactions: [],
      attachments: newMessage.attachments,
      isOwn: true,
      isRead: false,
      readBy: 0,
      order: newMessage.order
        ? {
            id: newMessage.order.id,
            publicId: newMessage.order.publicId,
            title: newMessage.order.title,
            description: newMessage.order.description,
            price: newMessage.order.price,
            priceUnit: newMessage.order.priceUnit,
            deadline: newMessage.order.deadline,
            status: newMessage.order.status,
            requesterUserId: newMessage.order.requesterUserId,
            targetUserId: newMessage.order.targetUserId,
          }
        : null,
    };

    await createNotificationWithUserSetting(prisma, {
      userId: opponentId,
      actorId: userId,
      type: "ORDER",
      title: `${newMessage.user.name}さんからオーダーが来ています`,
      message: title,
      redirectUrl: `/chat/${publicId}`,
      chatRoomId: room.id,
    });

    return NextResponse.json(responseMsg, { status: 201 });
  } catch (error) {
    console.error("Error creating chat order:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
