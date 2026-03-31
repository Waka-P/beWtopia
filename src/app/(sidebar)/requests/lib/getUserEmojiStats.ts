import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function getUserEmojiStats(): Promise<string[]> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return [];
    }

    const userId = parseInt(session.user.id, 10);

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

    return stats.map((s) => s.emoji);
  } catch (error) {
    console.error("絵文字統計取得エラー:", error);
    return [];
  }
}
