import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getUserPrivacyActions } from "../../lib/privacyActions";
import UserDetailPageClient, {
  type UserDetailData,
} from "./UserDetailPageClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  if (!publicId || typeof publicId !== "string") notFound();

  const user = await prisma.user.findUnique({
    where: { publicId },
    select: { name: true },
  });

  if (!user) {
    notFound();
  }

  return {
    title: `ユーザ - ${user.name}`,
  };
}

type PageProps = {
  params: Promise<{
    publicId: string;
  }>;
};

type PrismaWithUserFollow = typeof prisma & {
  userFollow: {
    findUnique(args: {
      where: {
        followerId_followingId: {
          followerId: number;
          followingId: number;
        };
      };
    }): Promise<unknown | null>;
  };
  userBlock: {
    findUnique(args: {
      where: {
        blockedId_blockerId: {
          blockedId: number;
          blockerId: number;
        };
      };
    }): Promise<unknown | null>;
  };
};

export default async function UserDetailPage({ params }: PageProps) {
  const { publicId } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const myId = parseInt(session.user.id, 10);

  const user = await prisma.user.findUnique({
    where: { publicId },
    include: {
      userTags: {
        include: {
          tag: true,
        },
      },
      jobs: {
        include: {
          job: true,
        },
      },
      apps: {
        include: {
          images: {
            orderBy: { displayOrder: "asc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    notFound();
  }

  let isFollowing = false;
  let isMe = false;
  let isBlocked = false;
  let isBlockedBy = false;

  if (Number.isFinite(myId)) {
    if (myId === user.id) {
      isMe = true;
    } else {
      const prismaWithUserFollow = prisma as PrismaWithUserFollow;

      const follow = await prismaWithUserFollow.userFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId: myId,
            followingId: user.id,
          },
        },
      });
      isFollowing = !!follow;

      const block = await prismaWithUserFollow.userBlock.findUnique({
        where: {
          blockedId_blockerId: {
            blockedId: user.id,
            blockerId: myId,
          },
        },
      });
      isBlocked = !!block;

      const blockedBy = await prismaWithUserFollow.userBlock.findUnique({
        where: {
          blockedId_blockerId: {
            blockedId: myId,
            blockerId: user.id,
          },
        },
      });
      isBlockedBy = !!blockedBy;
    }
  }

  const reviewsRaw = await prisma.appReview.findMany({
    where: {
      app: {
        OR: [
          { ownerId: user.id },
          {
            bewtsProject: {
              rooms: {
                some: {
                  members: {
                    some: {
                      userId: user.id,
                    },
                  },
                },
              },
            },
          },
        ],
      },
    },
    include: {
      app: true,
    },
    orderBy: {
      id: "desc",
    },
  });

  const privacyActionsRaw = await getUserPrivacyActions(user.id);

  const followerCount = await prisma.userFollow.count({
    where: { followingId: user.id },
  });

  const blockedRelation = isBlocked || isBlockedBy;
  const privacyActions = blockedRelation
    ? { follow: false, order: false, scout: false, tip: false }
    : privacyActionsRaw;

  const parseExternalLinks = (raw: string | null): string[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((v) => typeof v === "string")
          .map((v) => v.trim())
          .filter((v) => v.length > 0);
      }
    } catch {
      // JSON でなければ改行区切り扱い
    }
    return raw
      .split("\n")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  };

  const data: UserDetailData = {
    id: user.id,
    publicId: user.publicId,
    name: user.name,
    image: user.image,
    rating: user.rating ? Number(user.rating) : 0,
    followerCount,
    isFollowing,
    isBlocked,
    isBlockedBy,
    isMe,
    occupation:
      (user.jobs ?? [])
        .map((uj: { job: { name: string } | null }) => uj.job?.name)
        .filter(
          (v: unknown): v is string => typeof v === "string" && v.length > 0,
        )
        .join("／") || "",
    achievements: user.achievements ?? "",
    externalLinks: parseExternalLinks(user.externalLink),
    selfIntro: user.selfIntro ?? "",
    tags: user.userTags.map((ut: { tag: { name: string } }) => ut.tag.name),
    privacyActions,
    apps: [],
    reviews: reviewsRaw.map(
      (review: {
        id: number;
        rating: Prisma.Decimal;
        body: string;
        app: {
          id: number;
          publicId: string;
          name: string;
          summary: string;
          appIconUrl: string | null;
        };
      }) => ({
        id: review.id,
        rating: Number(review.rating),
        text: review.body,
        app: {
          id: review.app.id,
          publicId: review.app.publicId,
          name: review.app.name,
          summary: review.app.summary,
          iconUrl: review.app.appIconUrl,
        },
      }),
    ),
  };

  // ビューズ（Bewts）プロジェクト経由で共同出品しているアプリも含めた出品一覧を組み立て
  const bewtsApps = await prisma.app.findMany({
    where: {
      bewtsProject: {
        rooms: {
          some: {
            members: {
              some: {
                userId: user.id,
              },
            },
          },
        },
      },
    },
    include: {
      images: {
        orderBy: { displayOrder: "asc" },
        take: 1,
      },
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });

  const appMap = new Map<
    number,
    {
      id: number;
      publicId: string;
      name: string;
      summary: string;
      description: string;
      rating: number;
      iconUrl: string | null;
      thumbnailUrl: string | null;
      tags: { id: number; name: string }[];
      isBewtsProjectApp?: boolean;
    }
  >();

  const addApp = (app: {
    id: number;
    publicId: string;
    name: string;
    summary: string;
    description: string;
    rating: Prisma.Decimal | null;
    appIconUrl: string | null;
    images: { imageUrl: string | null }[];
    tags?: { tagId: number; tag: { name: string } }[];
    bewtsProjectId: number | null;
  }) => {
    if (appMap.has(app.id)) return;
    appMap.set(app.id, {
      id: app.id,
      publicId: app.publicId,
      name: app.name,
      summary: app.summary,
      description: app.description,
      rating: Number(app.rating ?? 0),
      iconUrl: app.appIconUrl,
      thumbnailUrl: app.images[0]?.imageUrl ?? null,
      tags: app.tags?.map((t) => ({ id: t.tagId, name: t.tag.name })) ?? [],
      isBewtsProjectApp: app.bewtsProjectId != null,
    });
  };

  user.apps.forEach(addApp);
  bewtsApps.forEach(addApp);

  data.apps = Array.from(appMap.values()).sort((a, b) => b.id - a.id);

  return <UserDetailPageClient data={data} />;
}
