import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import AppDetailPageClient from "./AppDetailPageClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  if (!publicId || typeof publicId !== "string") notFound();

  const app = await prisma.app.findUnique({
    where: { publicId },
  });

  if (!app) {
    notFound();
  }
  return {
    title: `アプリ - ${app.name}`,
  };
}

type SalesPlan = {
  id: number;
  salesFormat: "P" | "S";
  price: number;
};

type AppImage = {
  id: number;
  imageUrl: string;
};

type Owner = {
  id: number;
  publicId: string;
  name: string;
  image: string | null;
};

export type AppDetail = {
  id: number;
  publicId: string;
  name: string;
  summary: string;
  description: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
  appIconUrl: string | null;
  // バイト単位のファイルサイズ（存在しない場合は null/undefined）
  appFileSizeBytes?: number | null;
  paymentMethods: { method: "W" | "C" }[];
  salesPlans: SalesPlan[];
  images: AppImage[];
  owner: Owner | null;
  _count: {
    purchases: number;
    reviews: number;
  };
  trial?: {
    trialDays: number;
  } | null;
  // ログイン済みユーザーのお試し残り時間（開始済みかつ期限内の場合のみセット）
  trialRemainingDays?: number | null;
  trialRemainingHours?: number | null;
  // お試し中（開始済みかつ期限内）かどうか
  isTrialInProgress?: boolean;
  // お試し利用可能かどうか（期限内か）
  isTrialAvailable?: boolean;
  isPurchased?: boolean;
  isInCart?: boolean;
  // このアプリをログイン中ユーザーがお気に入り済みかどうか
  isFavorite?: boolean;
  // サブスクプランで購入済みかどうか（少なくとも1回サブスク購入履歴がある）
  isSubscriptionPurchased?: boolean;
  // 現在サブスクが有効かどうか（キャンセル済みでなければ true）
  isSubscriptionActive?: boolean;
  // 自分が出品者かどうか
  isOwner?: boolean;
  // ビューズ共同出品アプリかどうか
  isBewtsProjectApp?: boolean;
  // ビューズプロジェクトのリーダーかどうか
  isBewtsLeader?: boolean;
  // 出品者向け統計情報
  stats?: {
    totalRevenueYen: number;
    monthlyRevenueYen: number;
    countOneTimePurchases: number;
    countSubscriptionRegistrations: number;
    totalSalesCount: number;
    favoritesCount?: number;
  };
  tags: {
    tag: {
      id: number;
      name: string;
    };
  }[];
  reviews: {
    id: number;
    body: string;
    rating: number;
    userId: number;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: number;
      publicId: string;
      name: string;
      image: string | null;
    } | null;
  }[];
  // ログイン中ユーザーが投稿済みのレビュー（あれば）
  myReview?: {
    id: number;
    rating: number;
    body: string;
  } | null;
};

export async function getAppDetail(
  publicId: string,
): Promise<AppDetail | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session?.user?.id ? Number(session.user.id) : null;

  const app = await prisma.app.findUnique({
    where: { publicId },
    include: {
      owner: true,
      salesPlans: true,
      images: true,
      trial: true,
      paymentMethods: true,
      bewtsProject: {
        include: {
          roles: true,
          rooms: {
            select: {
              roleId: true,
              members: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      },
      tags: {
        include: {
          tag: true,
        },
      },
      reviews: {
        include: {
          user: true,
        },
      },
      _count: {
        select: {
          purchases: true,
          reviews: true,
        },
      },
    },
  });

  if (!app) {
    return null;
  }

  let isPurchased = false;
  let isSubscriptionPurchased = false;
  let isSubscriptionActive = false;
  let isFavorite = false;
  if (userId) {
    const [purchaseCount, subscriptionPurchaseCount, favoriteRecord] =
      await Promise.all([
        prisma.purchaseHistory.count({
          where: {
            appId: app.id,
            userId,
          },
        }),
        prisma.purchaseHistory.count({
          where: {
            appId: app.id,
            userId,
            salesPlan: { salesFormat: "S" },
          },
        }),
        prisma.appFavorite.findUnique({
          where: {
            appId_userId: {
              appId: app.id,
              userId,
            },
          },
        }),
      ]);
    isPurchased = purchaseCount > 0;
    isSubscriptionPurchased = subscriptionPurchaseCount > 0;
    isFavorite = Boolean(favoriteRecord);

    if (isSubscriptionPurchased) {
      const activeSubSession = await prisma.checkoutSession.findFirst({
        where: {
          userId,
          mode: "S",
          status: "COMPLETED",
          items: {
            some: {
              appId: app.id,
              salesPlan: { salesFormat: "S" },
            },
          },
        },
      });
      isSubscriptionActive = Boolean(activeSubSession);
    }
  }

  let isInCart = false;
  if (userId) {
    const cartItemCount = await prisma.cartItem.count({
      where: {
        appId: app.id,
        cart: {
          userId,
        },
      },
    });
    isInCart = cartItemCount > 0;
  }

  // 自分が出品者かどうか
  const isOwner =
    !!userId &&
    (app.ownerId === userId ||
      (app.bewtsProject?.rooms?.some(
        (room) =>
          typeof room.roleId === "number" &&
          room.members.some((member) => member.userId === userId),
      ) ??
        false));
  const isBewtsProjectApp = app.bewtsProjectId != null;
  const isBewtsLeader =
    !!userId && !!app.bewtsProject && app.bewtsProject.leaderId === userId;
  let isTrialAvailable: boolean | undefined;
  let isTrialInProgress: boolean | undefined;
  let trialRemainingDays: number | undefined;
  let trialRemainingHours: number | undefined;
  if (app.trial && typeof app.trial.trialDays === "number") {
    if (!userId) {
      // 未ログイン時はユーザー別の開始日時が不明なので、とりあえず有効とみなす
      isTrialAvailable = true;
    } else {
      const usage = await prisma.appTrialUsage.findUnique({
        where: {
          appId_userId: {
            appId: app.id,
            userId,
          },
        },
      });

      if (!usage) {
        // まだお試しを開始していないユーザーは利用可能
        isTrialAvailable = true;
      } else {
        const trialEndAt = new Date(
          usage.startedAt.getTime() + app.trial.trialDays * 24 * 60 * 60 * 1000,
        );
        const now = new Date();
        isTrialAvailable = now < trialEndAt;

        if (isTrialAvailable) {
          const remainingMs = trialEndAt.getTime() - now.getTime();
          const totalHours = Math.floor(remainingMs / (1000 * 60 * 60));
          const days = Math.floor(totalHours / 24);
          const hours = totalHours % 24;

          isTrialInProgress = true;
          trialRemainingDays = days;
          trialRemainingHours = hours;
        }
      }
    }
  }

  // 出品者向け統計情報を計算
  let stats: AppDetail["stats"] | undefined;
  if (isOwner) {
    const oneTimePlan = app.salesPlans.find((p) => p.salesFormat === "P");
    const subPlan = app.salesPlans.find((p) => p.salesFormat === "S");

    const [countP, countS, favoritesCount] = await Promise.all([
      prisma.purchaseHistory.count({
        where: { appId: app.id, salesPlan: { salesFormat: "P" } },
      }),
      prisma.purchaseHistory.count({
        where: { appId: app.id, salesPlan: { salesFormat: "S" } },
      }),
      prisma.appFavorite.count({
        where: { appId: app.id },
      }),
    ]);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [monthlyCountP, monthlyCountS] = await Promise.all([
      prisma.purchaseHistory.count({
        where: {
          appId: app.id,
          purchasedAt: { gte: startOfMonth, lt: startOfNextMonth },
          salesPlan: { salesFormat: "P" },
        },
      }),
      prisma.purchaseHistory.count({
        where: {
          appId: app.id,
          purchasedAt: { gte: startOfMonth, lt: startOfNextMonth },
          salesPlan: { salesFormat: "S" },
        },
      }),
    ]);

    const totalRevenueYen =
      (oneTimePlan?.price || 0) * countP + (subPlan?.price || 0) * countS;
    const monthlyRevenueYen =
      (oneTimePlan?.price || 0) * monthlyCountP +
      (subPlan?.price || 0) * monthlyCountS;

    stats = {
      totalRevenueYen,
      monthlyRevenueYen,
      countOneTimePurchases: countP,
      countSubscriptionRegistrations: countS,
      totalSalesCount: app._count.purchases,
      favoritesCount,
    };
  }

  return {
    ...app,
    rating: app.rating.toNumber(),
    createdAt: app.createdAt.toISOString(),
    // also expose updatedAt for owner display
    updatedAt:
      (app as any).updatedAt instanceof Date
        ? (app as any).updatedAt.toISOString()
        : app.createdAt.toISOString(),
    trialRemainingDays,
    trialRemainingHours,
    isTrialInProgress,
    isTrialAvailable,
    isPurchased,
    isInCart,
    isSubscriptionPurchased,
    isSubscriptionActive,
    isOwner,
    isBewtsProjectApp,
    isBewtsLeader,
    isFavorite,
    stats,
    // owner の rating(Decimal) を含めないようにプレーンなオブジェクトで渡す
    owner: app.owner
      ? {
          id: app.owner.id,
          publicId: app.owner.publicId,
          name: app.owner.name,
          image: app.owner.image ?? null,
        }
      : null,
    // reviews 内の user をプレーンオブジェクト化して Decimal を除去
    reviews: app.reviews.map((r) => ({
      id: r.id,
      body: r.body,
      rating: r.rating.toNumber(),
      userId: r.userId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      user: r.user
        ? {
            id: r.user.id,
            publicId: r.user.publicId,
            name: r.user.name,
            image: r.user.image ?? null,
          }
        : null,
    })),
    myReview: isOwner
      ? undefined
      : app.reviews
            .map((r) => ({ ...r, rating: r.rating.toNumber() }))
            .find((r) => r.userId === userId)
        ? (() => {
            const r = app.reviews.find((rv) => rv.userId === userId);
            return { id: r?.id, rating: r?.rating.toNumber(), body: r?.body };
          })()
        : null,
  } as AppDetail;
}

type AppDetailPageProps = {
  params: Promise<{
    publicId: string;
  }>;
};

export default async function AppDetailPage({ params }: AppDetailPageProps) {
  const { publicId } = await params;

  if (!publicId || typeof publicId !== "string") {
    notFound();
  }

  const app = await getAppDetail(publicId);

  if (!app) {
    notFound();
  }

  return <AppDetailPageClient app={app} />;
}
