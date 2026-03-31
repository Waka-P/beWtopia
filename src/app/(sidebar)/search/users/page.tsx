import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import SearchUsersClient from "./SearchUsersClient";

export const metadata: Metadata = {
  title: "検索 - ユーザ",
};

export default async function SearchUsersPage() {
  // 認証中のユーザは検索結果から除外
  const session = await auth.api.getSession({ headers: await headers() });
  const myId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  // 「ユーザ一覧への表示」が false のユーザを除外
  const visibilityCategory = await prisma.privacyCategory.findFirst({
    where: { name: "ユーザ一覧への表示" },
  });

  const followCategory = await prisma.privacyCategory.findFirst({
    where: { name: "フォロー" },
  });

  const where: Prisma.UserWhereInput = (() => {
    const base: Prisma.UserWhereInput = myId ? { id: { not: myId } } : {};
    if (!visibilityCategory) return base;
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
      jobs: {
        include: { job: true },
      },
      privacySettings: followCategory
        ? {
            where: {
              privacyCategoryId: followCategory.id,
            },
          }
        : false,
    },
    orderBy: { createdAt: "desc" },
  });

  let followingSet = new Set<number>();
  let blockedSet = new Set<number>();
  let blockedBySet = new Set<number>();
  if (myId && users.length > 0) {
    const ids = users.map((u) => u.id);

    const followRows = await prisma.$queryRaw<{ followingId: number }[]>`
      SELECT f_following_id AS followingId
      FROM user_follows
      WHERE f_follower_id = ${myId}
        AND f_following_id IN (${Prisma.join(ids)})
    `;

    followingSet = new Set(followRows.map((row) => row.followingId));

    const blockedRows = await prisma.userBlock.findMany({
      where: {
        blockerId: myId,
        blockedId: { in: ids },
      },
      select: {
        blockedId: true,
      },
    });

    blockedSet = new Set(blockedRows.map((row) => row.blockedId));

    const blockedByRows = await prisma.userBlock.findMany({
      where: {
        blockedId: myId,
        blockerId: { in: ids },
      },
      select: {
        blockerId: true,
      },
    });

    blockedBySet = new Set(blockedByRows.map((row) => row.blockerId));
  }

  // 自分がブロックしている/されているユーザと、自分が非表示にしたユーザを除外
  let hiddenSet = new Set<number>();
  if (myId && users.length > 0) {
    const ids = users.map((u) => u.id);
    const hiddenRows = await prisma.hiddenUser.findMany({
      where: {
        userId: myId,
        hiddenUserId: { in: ids },
      },
      select: { hiddenUserId: true },
    });
    hiddenSet = new Set(hiddenRows.map((row) => row.hiddenUserId));
  }

  const visibleUsers = users.filter(
    (user) =>
      !blockedBySet.has(user.id) &&
      !blockedSet.has(user.id) &&
      !hiddenSet.has(user.id),
  );

  // ビューズ（Bewts）プロジェクト経由で共同出品しているアプリも取得
  const userIds = visibleUsers.map((u) => u.id);
  const bewtsApps = await prisma.app.findMany({
    where: {
      bewtsProject: {
        rooms: {
          some: {
            members: {
              some: {
                userId: { in: userIds },
              },
            },
          },
        },
      },
    },
    select: {
      id: true,
      publicId: true,
      appIconUrl: true,
      bewtsProject: {
        select: {
          rooms: {
            select: {
              members: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const bewtsAppsByUser = new Map<
    number,
    { publicId: string; appIconUrl: string | null }[]
  >();

  for (const app of bewtsApps) {
    const memberIds = Array.from(
      new Set(
        (app.bewtsProject?.rooms ?? []).flatMap((room) =>
          room.members.map((member) => member.userId),
        ),
      ),
    );

    for (const uid of memberIds) {
      if (!userIds.includes(uid)) continue;
      const list = bewtsAppsByUser.get(uid) ?? [];
      if (!list.some((a) => a.publicId === app.publicId)) {
        list.push({ publicId: app.publicId, appIconUrl: app.appIconUrl });
      }
      bewtsAppsByUser.set(uid, list);
    }
  }

  // データをシリアライズ可能な形式に変換
  const serializedUsers = visibleUsers.map(
    (user: {
      id: number;
      publicId: string;
      name: string;
      selfIntro: string | null;
      rating: Prisma.Decimal | null;
      image: string | null;
      createdAt: Date;
      apps: { publicId: string; appIconUrl: string | null }[];
      jobs?: { jobId: number; job: { name: string } | null }[];
      privacySettings?: { isEnabled: boolean }[];
    }) => {
      const extraBewtsApps =
        bewtsAppsByUser.get(user.id) ??
        ([] as { publicId: string; appIconUrl: string | null }[]);
      const mergedApps = [
        ...user.apps,
        ...extraBewtsApps.filter(
          (ba) => !user.apps.some((a) => a.publicId === ba.publicId),
        ),
      ];

      return {
        id: user.id,
        publicId: user.publicId,
        name: user.name,
        selfIntro: user.selfIntro,
        rating: user.rating?.toNumber() ?? null,
        image: user.image,
        createdAt: user.createdAt.toISOString(),
        apps: mergedApps,
        jobs:
          user.jobs?.map((uj) => ({
            id: uj.jobId,
            name: uj.job?.name ?? "",
          })) ?? [],
        canFollow:
          (!followCategory ||
            !user.privacySettings?.some(
              (s: { isEnabled: boolean }) => s.isEnabled === false,
            )) &&
          !blockedSet.has(user.id) &&
          !blockedBySet.has(user.id),
        isFollowed: followingSet.has(user.id),
        canBlock: true,
        isBlocked: blockedSet.has(user.id),
      };
    },
  );

  return <SearchUsersClient initialUsers={serializedUsers} />;
}
