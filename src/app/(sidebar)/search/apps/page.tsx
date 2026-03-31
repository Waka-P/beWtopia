import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import SearchAppsClient from "./SearchAppsClient";

export const metadata: Metadata = {
  title: "検索 - アプリ",
};

export default async function SearchAppsPage() {
  // 認証情報からユーザID取得
  const session = await auth.api.getSession({ headers: await headers() });
  const myId = session?.user?.id ? parseInt(session.user.id) : null;

  // 他ユーザが出品したアプリを取得
  const where: Prisma.AppWhereInput = myId
    ? {
        // 自分が出品者（通常 or ビューズメンバー）のアプリと、自分が非表示にしたアプリを除外
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
            {
              hiddenByUsers: {
                some: {
                  userId: myId,
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
      owner: {
        select: {
          name: true,
          image: true,
        },
      },
      salesPlans: {
        select: {
          salesFormat: true,
          price: true,
        },
      },
      images: {
        select: {
          imageUrl: true,
        },
      },
      tags: {
        include: {
          tag: true,
        },
      },
      _count: {
        select: {
          purchases: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // ログインユーザがお気に入り登録しているアプリを取得
  let favoriteAppIdSet = new Set<number>();
  if (myId && apps.length > 0) {
    const favorites = await prisma.appFavorite.findMany({
      where: {
        userId: myId,
        appId: { in: apps.map((a) => a.id) },
      },
      select: {
        appId: true,
      },
    });

    favoriteAppIdSet = new Set(favorites.map((f) => f.appId));
  }

  // データをシリアライズ可能な形式に変換
  const serializedApps = apps.map((app) => ({
    id: app.id,
    publicId: app.publicId,
    name: app.name,
    summary: app.summary,
    rating: app.rating ? Number(app.rating) : 0,
    createdAt: app.createdAt.toISOString(),
    appIconUrl: app.appIconUrl,
    images: app.images,
    salesPlans: app.salesPlans,
    tags: app.tags.map((t) => ({ id: t.tagId, name: t.tag.name })),
    owner: app.owner,
    _count: app._count,
    isBewtsProjectApp: app.bewtsProjectId != null,
    isFavorite: favoriteAppIdSet.has(app.id),
  }));

  return <SearchAppsClient initialApps={serializedApps} />;
}
