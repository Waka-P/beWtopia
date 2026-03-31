import { auth } from "@/lib/auth";
import { createNotificationWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const reactionSchema = z.object({
  emoji: z.string().min(1).max(10),
});

export async function GET(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ publicId: string; messagePublicId: string }> },
) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);
    const { messagePublicId } = await params;
    const emoji = req.nextUrl.searchParams.get("emoji") ?? "👍";

    const message = await prisma.chatMessage.findUnique({
      where: { publicId: messagePublicId },
      select: {
        id: true,
      },
    });

    if (!message) {
      return NextResponse.json(
        { error: "メッセージが見つかりません" },
        { status: 404 },
      );
    }

    const existingReaction = await prisma.chatMessageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: message.id,
          userId,
          emoji,
        },
      },
      select: { id: true },
    });

    return NextResponse.json({
      userReacted: Boolean(existingReaction),
      emoji,
    });
  } catch (error) {
    console.error("リアクション状態取得エラー:", error);
    return NextResponse.json(
      { error: "リアクション状態の取得に失敗しました" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ publicId: string; messagePublicId: string }> },
) {
  try {
    // ユーザー認証チェック
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);
    const { publicId, messagePublicId } = await params;

    // メッセージが存在するか確認
    const message = await prisma.chatMessage.findUnique({
      where: { publicId: messagePublicId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!message) {
      return NextResponse.json(
        { error: "メッセージが見つかりません" },
        { status: 404 },
      );
    }

    // リクエストボディを取得
    const body = await req.json();
    const result = reactionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "不正なリクエストです", details: result.error },
        { status: 400 },
      );
    }

    const { emoji } = result.data;

    // 既に同じリアクションが存在するか確認
    const existingReaction = await prisma.chatMessageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: message.id,
          userId,
          emoji,
        },
      },
    });

    if (existingReaction) {
      // 既存のリアクションを削除（トグル）
      await prisma.$transaction(async (tx) => {
        await tx.chatMessageReaction.delete({
          where: { id: existingReaction.id },
        });

        const stats = await tx.userEmojiStats.findUnique({
          where: {
            userId_emoji: {
              userId,
              emoji,
            },
          },
        });

        if (stats && stats.useCount > 0) {
          await tx.userEmojiStats.update({
            where: { id: stats.id },
            data: { useCount: { decrement: 1 } },
          });
        }
      });
    } else {
      // リアクションを追加
      await prisma.$transaction(async (tx) => {
        await tx.chatMessageReaction.create({
          data: {
            emoji,
            messageId: message.id,
            userId,
          },
        });

        await tx.userEmojiStats.upsert({
          where: {
            userId_emoji: {
              userId,
              emoji,
            },
          },
          update: {
            useCount: { increment: 1 },
          },
          create: {
            userId,
            emoji,
            useCount: 1,
          },
        });
      });

      if (message.userId !== userId) {
        const actor = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });

        if (actor) {
          await createNotificationWithUserSetting(prisma, {
            userId: message.userId,
            actorId: userId,
            type: "CHAT",
            title: `${actor.name}さんがリアクションしました`,
            message: emoji,
            redirectUrl: `/chat/${publicId}?messagePublicId=${messagePublicId}&notifKind=reaction`,
          });
        }
      }
    }

    // 最新のリアクション状態を取得して返す
    const allReactions = await prisma.chatMessageReaction.groupBy({
      by: ["emoji"],
      where: {
        messageId: message.id,
      },
      _count: {
        emoji: true,
      },
      _min: {
        createdAt: true,
      },
    });

    const userReactions = await prisma.chatMessageReaction.findMany({
      where: {
        messageId: message.id,
        userId,
      },
      select: {
        emoji: true,
      },
    });

    const userReactedEmojis = userReactions.map((r) => r.emoji);

    const reactions = allReactions.map((r) => ({
      emoji: r.emoji,
      count: r._count.emoji,
      userReacted: userReactedEmojis.includes(r.emoji),
      firstReactedAt: r._min?.createdAt ? r._min.createdAt.toISOString() : null,
    }));

    return NextResponse.json({
      action: existingReaction ? "removed" : "added",
      reactions,
      userReactedEmojis,
    });
  } catch (error) {
    console.error("リアクション追加エラー:", error);
    return NextResponse.json(
      { error: "リアクションの追加に失敗しました" },
      { status: 500 },
    );
  }
}
