export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import PurchasesClient from "./PurchasesClient";

export const metadata: Metadata = {
  title: "マイページ - 購入一覧",
};

type PurchaseItem = {
  id: number;
  purchasedAt: string;
  appPublicId: string;
  appName: string;
  appIconUrl: string | null;
  price: number;
  salesFormat: "買い切り" | "サブスク";
  rating: number;
  hasReviewed?: boolean;
  appDescription?: string | null;
  appThumbnailUrl?: string | null;
  sellerName?: string | null;
  sellerIconUrl?: string | null;
  tags?: { id: number; name: string }[];
  listingType?: "bewt" | "bewts";
};

async function getUserPurchases(): Promise<PurchaseItem[]> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const userId = Number(session?.user.id);
    if (Number.isNaN(userId)) {
      return [];
    }

    const purchases = await prisma.purchaseHistory.findMany({
      where: {
        userId,
        app: {
          hiddenByUsers: {
            none: {
              userId,
            },
          },
        },
      },
      include: {
        app: {
          include: {
            owner: true,
            images: {
              select: {
                imageUrl: true,
              },
              orderBy: {
                displayOrder: "asc",
              },
            },
            tags: {
              include: {
                tag: true,
              },
            },
          },
        },
        salesPlan: true,
      },
      orderBy: { purchasedAt: "desc" },
    });

    // Determine subscription-active flag per purchase (for サブスク)
    const result = await Promise.all(
      purchases.map(async (p) => {
        let isSubscriptionActive = false;
        try {
          if (p.salesPlan.salesFormat === "S") {
            const checkout = await prisma.checkoutSession.findFirst({
              where: {
                userId,
                mode: "S",
                status: "COMPLETED",
                stripeSessionId: { not: null },
                items: {
                  some: {
                    appId: p.appId,
                    salesPlanId: p.salesPlanId,
                  },
                },
              },
              orderBy: { createdAt: "desc" },
            });
            if (checkout) isSubscriptionActive = true;
          }
        } catch (e) {
          console.error("Failed to check subscription status", e);
        }

        const salesFormat: PurchaseItem["salesFormat"] =
          p.salesPlan.salesFormat === "P" ? "買い切り" : "サブスク";

        const listingType: PurchaseItem["listingType"] =
          p.app.bewtsProjectId != null ? "bewts" : "bewt";

        return {
          id: p.id,
          purchasedAt: p.purchasedAt.toISOString(),
          appPublicId: p.app.publicId,
          appName: p.app.name,
          appIconUrl: p.app.appIconUrl,
          price: p.salesPlan.price,
          salesFormat,
          rating: Number(p.app.rating ?? 0),
          // 自分が既にレビュー済みかどうかを判定
          hasReviewed: !!(await prisma.appReview.findUnique({
            where: { appId_userId: { appId: p.appId, userId } },
            select: { id: true },
          })),
          appDescription: p.app.summary,
          appThumbnailUrl: p.app.images[0]?.imageUrl ?? null,
          sellerName: p.app.owner?.name ?? null,
          sellerIconUrl: p.app.owner?.image ?? null,
          tags:
            p.app.tags?.map((t) => ({ id: t.tagId, name: t.tag.name })) ?? [],
          isSubscriptionActive,
          listingType,
        };
      }),
    );

    return result;
  } catch (err) {
    console.error("Failed to fetch purchases:", err);
    return [];
  }
}

export default async function PurchasesPage() {
  const items = await getUserPurchases();

  return <PurchasesClient initialItems={items} />;
}
