import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { ProductsList } from "./ProductsList";

export const metadata: Metadata = {
  title: "マイページ - 出品一覧",
};

export const dynamic = "force-dynamic";

type App = {
  id: number;
  publicId: string;
  name: string;
  summary: string;
  rating: number;
  createdAt: string;
  appIconUrl: string | null;
  images: { imageUrl: string }[];
  salesPlans: { price: number; salesFormat: "S" | "P" }[];
  _count: {
    purchases: number;
  };
  isBewtsProjectApp?: boolean;
};

async function getUserApps(): Promise<App[]> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const userId = Number(session?.user.id);
    if (Number.isNaN(userId)) {
      return [];
    }

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
          select: {
            imageUrl: true,
          },
        },
        salesPlans: {
          select: {
            salesFormat: true,
            price: true,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    return apps.map((app) => ({
      id: app.id,
      publicId: app.publicId,
      name: app.name,
      summary: app.summary,
      rating: Number(app.rating),
      createdAt: app.createdAt.toISOString(),
      appIconUrl: app.appIconUrl,
      images: app.images,
      salesPlans: app.salesPlans,
      tags: app.tags.map((t) => ({ id: t.tagId, name: t.tag.name })),
      _count: app._count,
      isBewtsProjectApp: app.bewtsProjectId != null,
    }));
  } catch (err) {
    console.error("Failed to fetch user apps:", err);
    return [];
  }
}

export default async function ProductsPage() {
  const apps = await getUserApps();

  return <ProductsList initialApps={apps} />;
}
