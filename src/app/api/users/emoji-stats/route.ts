import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// ユーザーのよく使う絵文字を取得
export async function GET(req: NextRequest) {
  try {
    // ユーザー認証チェック
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ emojis: [] }, { status: 200 });
    }

    const userId = parseInt(session.user.id, 10);

    // 使用回数が多い順に5つ取得
    const stats = await prisma.userEmojiStats.findMany({
      where: {
        userId,
        useCount: { gt: 0 },
      },
      orderBy: {
        useCount: "desc",
      },
      take: 5,
      select: {
        emoji: true,
      },
    });

    return NextResponse.json({ emojis: stats.map((s) => s.emoji) });
  } catch (error) {
    console.error("絵文字統計取得エラー:", error);
    return NextResponse.json({ emojis: [] }, { status: 200 });
  }
}
