import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import HomePageContent from "./components/HomePageContent";

export const metadata: Metadata = {
  title: "トップ",
};

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login"); // ログインしてなければリダイレクト
  }

  const currentUserId = Number(session.user.id);

  const baseOwnerWhere: Prisma.AppWhereInput = Number.isFinite(currentUserId)
    ? {
        // 自分が出品者（通常 or ビューズメンバー）のアプリと、ownerId が null のアプリ、および自分が非表示にしたアプリを除外
        AND: [
          {
            NOT: { ownerId: null },
          },
          {
            NOT: {
              OR: [
                { ownerId: currentUserId },
                {
                  bewtsProject: {
                    rooms: {
                      some: {
                        members: {
                          some: {
                            userId: currentUserId,
                          },
                        },
                      },
                    },
                  },
                },
                {
                  hiddenByUsers: {
                    some: {
                      userId: currentUserId,
                    },
                  },
                },
              ],
            },
          },
        ],
      }
    : {
        NOT: { ownerId: null },
      };

  const [recommendedRaw, popularRaw, subscriptionRaw, templateRaw, newRaw] =
    await Promise.all([
      // トップの「おすすめ」一覧（最新順）
      prisma.app.findMany({
        where: baseOwnerWhere,
        orderBy: { createdAt: "desc" },
        include: {
          images: {
            orderBy: { displayOrder: "asc" },
            take: 1,
          },
        },
        take: 6,
      }),
      // 人気: 評価が高い順
      prisma.app.findMany({
        where: baseOwnerWhere,
        orderBy: { rating: "desc" },
        include: {
          images: {
            orderBy: { displayOrder: "asc" },
            take: 1,
          },
        },
        take: 8,
      }),
      // サブスク: サブスク形式の販売プランを持つアプリ
      prisma.app.findMany({
        where: {
          ...baseOwnerWhere,
          salesPlans: {
            some: {
              salesFormat: "S",
            },
          },
        },
        include: {
          images: {
            orderBy: { displayOrder: "asc" },
            take: 1,
          },
        },
        take: 8,
      }),
      // テンプレート: 「テンプレート」タグが付いているアプリ
      prisma.app.findMany({
        where: {
          ...baseOwnerWhere,
          tags: {
            some: {
              tag: {
                name: "テンプレート",
              },
            },
          },
        },
        include: {
          images: {
            orderBy: { displayOrder: "asc" },
            take: 1,
          },
        },
        take: 8,
      }),
      // 新規: 作成日の新しい順
      prisma.app.findMany({
        where: baseOwnerWhere,
        orderBy: { createdAt: "desc" },
        include: {
          images: {
            orderBy: { displayOrder: "asc" },
            take: 1,
          },
        },
        take: 8,
      }),
    ]);

  // ログインユーザがお気に入り登録しているアプリをまとめて取得
  const allAppIds = [
    ...recommendedRaw,
    ...popularRaw,
    ...subscriptionRaw,
    ...templateRaw,
    ...newRaw,
  ].map((app) => app.id);

  const favoriteAppIdSet = new Set<number>();

  if (Number.isFinite(currentUserId) && allAppIds.length > 0) {
    const favorites = await prisma.appFavorite.findMany({
      where: {
        userId: currentUserId,
        appId: { in: allAppIds },
      },
      select: {
        appId: true,
      },
    });

    for (const f of favorites) {
      favoriteAppIdSet.add(f.appId);
    }
  }

  const toHomePageApp = (app: any) => ({
    publicId: app.publicId,
    name: app.name,
    summary: app.summary,
    description: app.description,
    rating: Number(app.rating ?? 0),
    iconUrl: app.appIconUrl,
    thumbnailUrl: app.images[0]?.imageUrl ?? null,
    isFavorite: favoriteAppIdSet.has(app.id),
  });

  const recommendedApps = recommendedRaw.map(toHomePageApp);

  const carouselApps = {
    popular: popularRaw.map(toHomePageApp),
    subscription: subscriptionRaw.map(toHomePageApp),
    template: templateRaw.map(toHomePageApp),
    new: newRaw.map(toHomePageApp),
  } as const;

  return (
    <HomePageContent
      userName={session.user.name}
      apps={recommendedApps}
      carouselApps={carouselApps}
    />
  );
}
