import {
  createChatMessageSchema,
  hasSendableContent,
} from "@/app/schemas/chat";
import { auth } from "@/lib/auth";
import { genPublicId } from "@/lib/id";
import { createNotificationsWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import { sanitizeAndNormalizeTiptapHtml } from "@/utils/normalize";
import { NextResponse } from "next/server";

export async function GET(
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

  try {
    // Verify room access and get my member record (deletedAt を考慮するため)
    const room = await prisma.chatRoom.findUnique({
      where: { publicId },
      include: {
        members: {
          select: { userId: true, deletedAt: true },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const myMember = room.members.find((m) => m.userId === (userId as number));
    if (!myMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deletedAt = myMember?.deletedAt ?? null;

    const messages = await prisma.chatMessage.findMany({
      where: {
        roomId: room.id,
        ...(deletedAt ? { createdAt: { gt: deletedAt } } : {}),
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
        attachments: {
          orderBy: { displayOrder: "asc" },
        },
        reactions: true,
        order: true,
        reads: {
          select: {
            userId: true,
            readAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc", // Oldest first for chat log
      },
    });

    // 自分が送っていないメッセージを自動的に既読にする
    const unreadMessageIds = messages
      .filter((msg) => msg.userId !== userId)
      .filter((msg) => !msg.reads.some((r) => r.userId === userId))
      .map((msg) => msg.id);

    if (unreadMessageIds.length > 0) {
      await prisma.chatMessageRead.createMany({
        data: unreadMessageIds.map((messageId) => ({
          messageId,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    const formattedMessages = messages.map((msg) => {
      // Group reactions
      const reactionMap = new Map<
        string,
        { count: number; userReacted: boolean }
      >();

      msg.reactions.forEach((r) => {
        const current = reactionMap.get(r.emoji) || {
          count: 0,
          userReacted: false,
        };
        current.count++;
        if (r.userId === userId) {
          current.userReacted = true;
        }
        reactionMap.set(r.emoji, current);
      });

      const reactions = Array.from(reactionMap.entries()).map(
        ([emoji, val]) => ({
          emoji,
          count: val.count,
          userReacted: val.userReacted,
        }),
      );

      return {
        id: msg.id,
        publicId: msg.publicId,
        content: msg.content,
        createdAt: msg.createdAt,
        user: msg.user,
        reactions,
        attachments: msg.attachments,
        isOwn: msg.userId === userId,
        isRead: msg.reads.some(
          (r) => r.userId !== userId && r.userId !== msg.userId,
        ), // 相手が読んだか
        readBy: msg.reads.filter((r) => r.userId !== msg.userId).length, // 何人が読んだか
        order: msg.order
          ? {
              id: msg.order.id,
              publicId: msg.order.publicId,
              title: msg.order.title,
              description: msg.order.description,
              price: msg.order.price,
              priceUnit: msg.order.priceUnit,
              deadline: msg.order.deadline,
              status: msg.order.status,
              requesterUserId: msg.order.requesterUserId,
              targetUserId: msg.order.targetUserId,
            }
          : null,
      };
    });

    return NextResponse.json(formattedMessages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
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

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Zodでバリデーション
    const validationResult = createChatMessageSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((err) => ({
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

    const { content, attachments } = validationResult.data;
    const normalizedContent = content
      ? sanitizeAndNormalizeTiptapHtml(content)
      : null;
    const hasAttachments = (attachments ?? []).length > 0;

    if (!hasSendableContent(normalizedContent) && !hasAttachments) {
      return NextResponse.json(
        { error: "メッセージまたは添付ファイルが必要です" },
        { status: 400 },
      );
    }

    // Checking room and membership
    const room = await prisma.chatRoom.findUnique({
      where: { publicId },
      include: {
        members: { select: { userId: true } },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const isMember = room.members.some((m) => m.userId === userId);
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ブロック状態を確認（どちらか一方でもブロックしている場合は送信不可）
    const opponentMember = room.members.find((m) => m.userId !== userId);
    if (opponentMember) {
      const opponentId = opponentMember.userId;

      const block = await prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: opponentId },
            { blockerId: opponentId, blockedId: userId },
          ],
        },
      });

      if (block) {
        // どちら側の視点でもクライアントには共通エラーメッセージを返す
        return NextResponse.json(
          { error: "このユーザとのチャットは現在無効化されています" },
          { status: 403 },
        );
      }
    }

    const newMessage = await prisma.chatMessage.create({
      data: {
        publicId: genPublicId(),
        content: normalizedContent,
        roomId: room.id,
        userId: userId,
        attachments: {
          create:
            attachments?.map(
              (att: { url: string; type: string; name: string }) => ({
                url: att.url,
                type: att.type,
                name: att.name,
              }),
            ) || [],
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
        reactions: true, // will be empty
      },
    });

    // Format response
    const responseMsg = {
      id: newMessage.id,
      publicId: newMessage.publicId,
      content: newMessage.content,
      createdAt: newMessage.createdAt,
      user: newMessage.user,
      reactions: [],
      isRead: false,
      readBy: 0,
      attachments: newMessage.attachments,
      isOwn: true,
    };

    const plainText = (newMessage.content || "").replace(/<[^>]+>/g, "").trim();
    const previewText = plainText
      ? plainText.slice(0, 80)
      : "新着メッセージがあります";
    const recipientIds = room.members
      .map((member) => member.userId)
      .filter((id) => id !== userId);

    if (recipientIds.length > 0) {
      await createNotificationsWithUserSetting(
        prisma,
        recipientIds.map((targetUserId) => ({
          userId: targetUserId,
          actorId: userId,
          type: "CHAT",
          title: `${newMessage.user.name}さんからのチャット`,
          message: previewText,
          redirectUrl: `/chat/${publicId}?messagePublicId=${newMessage.publicId}`,
          chatRoomId: room.id,
        })),
      );
    }

    return NextResponse.json(responseMsg);
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
