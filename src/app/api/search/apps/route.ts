import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  // 認証情報からユーザID取得
  const session = await auth.api.getSession({ headers: req.headers });
  const myId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  const where = myId
    ? {
        // 自分が出品者（通常 or ビューズメンバー）のアプリは検索結果から除外
        NOT: {
          OR: [
            { ownerId: myId },
            {
              bewtsProject: {
                rooms: {
                  some: {
                    members: {
                      some: {
                        userId: myId,
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      }
    : {};

  const apps = await prisma.app.findMany({
    where,
    include: {
      owner: true,
      salesPlans: true,
      images: true,
      tags: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(apps);
}
