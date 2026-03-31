import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  // 認証中のユーザは検索結果から除外
  const session = await auth.api.getSession({ headers: req.headers });
  const myId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  // 「ユーザ一覧への表示」カテゴリのIDを取得
  const visibilityCategory = await prisma.privacyCategory.findFirst({
    where: { name: "ユーザ一覧への表示" },
  });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  const where = (() => {
    let base: any = myId ? { id: { not: myId } } : {};

    if (query) {
      base = {
        ...base,
        OR: [
          { name: { contains: query } }, // 名前で検索
          { selfIntro: { contains: query } }, // PublicIDで検索
        ],
      };
    }

    if (!visibilityCategory) return base; // カテゴリ未設定なら従来通り全件
    // 明示的に false の設定があるユーザを除外（未設定 or true は含める）
    return {
      ...base,
      NOT: {
        privacySettings: {
          some: {
            privacyCategoryId: visibilityCategory.id,
            isEnabled: false,
          },
        },
      },
    };
  })();

  const users = await prisma.user.findMany({
    where,
    include: {
      apps: {
        select: {
          publicId: true,
          appIconUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const response = users.map((user) => {
    const description = user.selfIntro ?? "";

    return {
      id: user.id,
      publicId: user.publicId,
      name: user.name,
      description,
      listDescription: description,
      rating: user.rating ? Number(user.rating) : 0,
      iconUrl: user.image,
      createdAt: user.createdAt.toISOString(),
      apps: user.apps.map((app) => ({
        publicId: app.publicId,
        iconUrl: app.appIconUrl,
      })),
    };
  });

  return NextResponse.json(response);
}
