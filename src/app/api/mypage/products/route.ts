import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);

    // ログインユーザーの出品アプリを取得
    // - 通常出品: ownerId === userId
    // - ビューズ出品: 紐づく BewtsProject の役割に自分が含まれているアプリ
    const apps = await prisma.app.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            bewtsProject: {
              rooms: {
                some: {
                  members: {
                    some: {
                      userId,
                    },
                  },
                },
              },
            },
          },
        ],
      },
      include: {
        images: {
          orderBy: {
            displayOrder: "asc",
          },
          take: 1,
        },
        salesPlans: {
          select: {
            price: true,
          },
        },
        _count: {
          select: {
            purchases: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ apps });
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 },
    );
  }
}
