import { createChatMessageSchema } from "@/app/schemas/chat";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ publicId: string; messagePublicId: string }>;
  },
) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const { publicId, messagePublicId } = await params;

  try {
    // ルームの存在確認とメンバーシップの確認
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

    // メッセージの存在確認と所有権の確認
    const message = await prisma.chatMessage.findUnique({
      where: {
        publicId: messagePublicId,
        roomId: room.id,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // メッセージの送信者のみが削除できる
    if (message.userId !== userId) {
      return NextResponse.json(
        { error: "You can only delete your own messages" },
        { status: 403 },
      );
    }

    // メッセージに関連するデータを削除（トランザクション内で）
    await prisma.$transaction([
      // リアクションを削除
      prisma.chatMessageReaction.deleteMany({
        where: { messageId: message.id },
      }),
      // 既読情報を削除
      prisma.chatMessageRead.deleteMany({
        where: { messageId: message.id },
      }),
      // 添付ファイルを削除
      prisma.chatMessageAttachment.deleteMany({
        where: { messageId: message.id },
      }),
      // メッセージ自体を削除
      prisma.chatMessage.delete({
        where: { id: message.id },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ publicId: string; messagePublicId: string }>;
  },
) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const { publicId, messagePublicId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validationResult = createChatMessageSchema.safeParse(body);
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    return NextResponse.json(
      { error: firstError?.message ?? "Validation failed" },
      { status: 400 },
    );
  }

  const { content, attachments } = validationResult.data;

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

    const message = await prisma.chatMessage.findFirst({
      where: { publicId: messagePublicId, roomId: room.id },
      select: { id: true, userId: true },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (message.userId !== userId) {
      return NextResponse.json(
        { error: "You can only edit your own messages" },
        { status: 403 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.chatMessageAttachment.deleteMany({
        where: { messageId: message.id },
      });

      await tx.chatMessage.update({
        where: { id: message.id },
        data: {
          content: content ?? null,
          attachments:
            attachments && attachments.length > 0
              ? {
                  create: attachments.map((att) => ({
                    url: att.url,
                    type: att.type,
                    name: att.name,
                  })),
                }
              : undefined,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating message:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
