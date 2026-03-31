import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const reactionSchema = z.object({
  emoji: z.string().min(1).max(10),
});

// リアクション追加
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
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
    const { publicId } = await params;

    // リクエストが存在するか確認
    const request = await prisma.request.findUnique({
      where: { publicId },
    });

    if (!request) {
      return NextResponse.json(
        { error: "リクエストが見つかりません" },
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
    const existingReaction = await prisma.requestReaction.findUnique({
      where: {
        requestId_userId_emoji: {
          requestId: request.id,
          userId,
          emoji,
        },
      },
    });

    if (existingReaction) {
      // 既存のリアクションを削除（トグル）
      await prisma.$transaction(async (tx) => {
        await tx.requestReaction.delete({
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
        await tx.requestReaction.create({
          data: {
            emoji,
            requestId: request.id,
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
    }

    // 最新のリアクション状態を取得して返す
    const allReactions = await prisma.requestReaction.groupBy({
      by: ["emoji"],
      where: {
        requestId: request.id,
      },
      _count: {
        emoji: true,
      },
      _min: {
        createdAt: true,
      },
    });

    const userReactions = await prisma.requestReaction.findMany({
      where: {
        requestId: request.id,
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
      firstReactedAt: r._min?.createdAt ? r._min.createdAt.toISOString() : null,
      userReacted: userReactedEmojis.includes(r.emoji),
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
