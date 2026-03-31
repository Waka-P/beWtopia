import { bewtSchemaAPI } from "@/app/schemas/bewtSchema";
import { auth } from "@/lib/auth";
import { createNotificationsWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import { normalizeUserInput } from "@/utils/normalize";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ publicId: string }>;
  },
) {
  const { publicId } = await params;
  if (!publicId || typeof publicId !== "string") {
    return NextResponse.json({ error: "Invalid app id" }, { status: 400 });
  }
  const session = await auth.api.getSession({
    // Next 15 以降は headers() も Promise
    headers: req.headers,
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
    return NextResponse.json({ error: "App not found" }, { status: 404 });
  }

  // expose an internal download endpoint (server will proxy R2 by key)
  // frontend should call `/api/apps/:publicId/download` to retrieve the file

  let isPurchased = false;
  if (userId) {
    const purchaseCount = await prisma.purchaseHistory.count({
      where: {
        appId: app.id,
        userId,
      },
    });
    isPurchased = purchaseCount > 0;
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

  // Compute current user's own review if available
  let myReview: { id: number; rating: number; body: string } | null = null;
  if (userId) {
    const r = app.reviews.find((rv) => rv.userId === userId);
    if (r) {
      myReview = { id: r.id, rating: r.rating.toNumber(), body: r.body };
    }
  }

  return NextResponse.json({
    ...app,
    rating: app.rating.toNumber(),
    downloadUrl: `/api/apps/${app.publicId}/download`,
    isPurchased,
    isInCart,
    myReview,
  });
}

export async function PUT(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ publicId: string }>;
  },
) {
  const { publicId } = await params;
  if (!publicId || typeof publicId !== "string") {
    return NextResponse.json({ error: "Invalid app id" }, { status: 400 });
  }

  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const userId = Number(session.user.id);

  const app = await prisma.app.findUnique({
    where: { publicId },
    include: {
      salesPlans: true,
      tags: true,
      images: true,
      paymentMethods: true,
      trial: true,
      bewtsProject: {
        select: {
          leaderId: true,
        },
      },
    },
  });

  if (!app) {
    return NextResponse.json({ error: "App not found" }, { status: 404 });
  }
  const isBewtsProjectApp = app.bewtsProject != null;
  const canEdit = isBewtsProjectApp
    ? app.bewtsProject?.leaderId === userId
    : app.ownerId === userId;

  if (!canEdit) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await req.json();
  const result = bewtSchemaAPI.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "不正なリクエストです",
        details: result.error,
      },
      { status: 400 },
    );
  }

  const data = result.data;
  const dataWithFile = data as typeof data & {
    appFileKey?: string | null;
    trial: typeof data.trial & { trialFileKey?: string | null };
  };
  const oldPriceByFormat = new Map(
    app.salesPlans.map((plan) => [plan.salesFormat, plan.price]),
  );
  const oldAppName = app.name;

  await prisma.$transaction(async (tx) => {
    const appFileKey = dataWithFile.appFileKey ?? null;
    const { name, description, summary, appFileSizeBytes, appIconUrl } = data;
    await tx.app.update({
      where: { id: app.id },
      data: {
        name: normalizeUserInput(name),
        description: normalizeUserInput(description),
        summary: normalizeUserInput(summary),
        appFileKey: appFileKey,
        appFileSizeBytes: appFileSizeBytes,
        appIconUrl: appIconUrl || null,
      },
    });

    await tx.appTag.deleteMany({ where: { appId: app.id } });

    await tx.appImage.deleteMany({ where: { appId: app.id } });

    // Delete only sales plans that are not referenced by purchase histories or checkout items
    const existingPlans = await tx.appSalesPlan.findMany({
      where: { appId: app.id },
      select: { id: true },
    });
    const existingPlanIds = existingPlans.map((p) => p.id);

    const referencedPurchases = await tx.purchaseHistory.findMany({
      where: { salesPlanId: { in: existingPlanIds } },
      select: { salesPlanId: true },
    });
    const referencedCheckouts = await tx.checkoutItem.findMany({
      where: { salesPlanId: { in: existingPlanIds } },
      select: { salesPlanId: true },
    });

    const referencedSet = new Set<number>();
    for (const r of referencedPurchases) referencedSet.add(r.salesPlanId);
    for (const r of referencedCheckouts) referencedSet.add(r.salesPlanId);

    const deletablePlanIds = existingPlanIds.filter(
      (id) => !referencedSet.has(id),
    );
    if (deletablePlanIds.length > 0) {
      await tx.appSalesPlan.deleteMany({
        where: { id: { in: deletablePlanIds } },
      });
    }

    await tx.appPaymentMethod.deleteMany({ where: { appId: app.id } });

    if (app.trial) {
      await tx.appTrial.deleteMany({ where: { appId: app.id } });
    }

    if (data.tags.length > 0) {
      await tx.appTag.createMany({
        data: data.tags.map((tagId) => ({
          appId: app.id,
          tagId,
        })),
      });
    }

    if (data.imageUrls.length > 0) {
      await tx.appImage.createMany({
        data: data.imageUrls.map((url, index) => ({
          appId: app.id,
          imageUrl: url,
          displayOrder: index + 1,
        })),
      });
    }

    const salesPlansToCreate = [
      ...(data.salesPlan.oneTimeEnabled && data.salesPlan.oneTimePrice
        ? [
            {
              salesFormat: "P" as const,
              price: data.salesPlan.oneTimePrice,
            },
          ]
        : []),
      ...(data.salesPlan.monthlyEnabled && data.salesPlan.monthlyPrice
        ? [
            {
              salesFormat: "S" as const,
              price: data.salesPlan.monthlyPrice,
            },
          ]
        : []),
    ];

    if (salesPlansToCreate.length > 0) {
      // avoid duplicate unique constraint: only create plans for formats not already present
      const existingFormats = (
        await tx.appSalesPlan.findMany({
          where: { appId: app.id },
          select: { salesFormat: true },
        })
      ).map((p) => p.salesFormat);

      const toCreate = salesPlansToCreate.filter(
        (p) => !existingFormats.includes(p.salesFormat),
      );

      if (toCreate.length > 0) {
        await tx.appSalesPlan.createMany({
          data: toCreate.map((p) => ({
            appId: app.id,
            salesFormat: p.salesFormat,
            price: p.price,
          })),
        });
      }
    }

    if (data.trial.trialEnabled) {
      const trialFileKey = dataWithFile.trial.trialFileKey ?? null;
      await tx.appTrial.create({
        data: {
          appId: app.id,
          trialDays: data.trial.trialDays,
          trialFileKey: trialFileKey,
        },
      });
    }

    const paymentMethodsToCreate = [
      ...(data.paymentMethod.cardEnabled ? [{ method: "C" as const }] : []),
      ...(data.paymentMethod.wCoinEnabled ? [{ method: "W" as const }] : []),
    ];

    if (paymentMethodsToCreate.length > 0) {
      await tx.appPaymentMethod.createMany({
        data: paymentMethodsToCreate.map((pm) => ({
          appId: app.id,
          method: pm.method,
        })),
      });
    }
  });

  const latestApp = await prisma.app.findUnique({
    where: { id: app.id },
    select: {
      id: true,
      name: true,
      salesPlans: {
        select: {
          salesFormat: true,
          price: true,
        },
      },
    },
  });

  if (latestApp) {
    const newPriceByFormat = new Map(
      latestApp.salesPlans.map((plan) => [plan.salesFormat, plan.price]),
    );

    let hasPriceUp = false;
    let hasPriceDown = false;

    for (const [format, oldPrice] of oldPriceByFormat) {
      const newPrice = newPriceByFormat.get(format);
      if (typeof newPrice !== "number") continue;
      if (newPrice > oldPrice) hasPriceUp = true;
      if (newPrice < oldPrice) hasPriceDown = true;
    }

    const appDisplayName = latestApp.name || oldAppName;

    const favoriteUsers = await prisma.appFavorite.findMany({
      where: { appId: app.id, userId: { not: userId } },
      select: { userId: true },
    });

    const cartUsers = await prisma.cartItem.findMany({
      where: { appId: app.id, cart: { userId: { not: userId } } },
      select: { cart: { select: { userId: true } } },
    });

    const favoriteUserIds = Array.from(
      new Set(favoriteUsers.map((row) => row.userId)),
    );
    const cartUserIds = Array.from(
      new Set(cartUsers.map((row) => row.cart.userId)),
    );

    let favoriteTitle = `お気に入り中の${appDisplayName}の詳細が変更されました`;
    let cartTitle = `カート追加中の${appDisplayName}の詳細が変更されました`;

    if (hasPriceUp && !hasPriceDown) {
      favoriteTitle = `お気に入り中の${appDisplayName}が値上がりしました`;
      cartTitle = `カート追加中の${appDisplayName}が値上がりしました`;
    } else if (!hasPriceUp && hasPriceDown) {
      favoriteTitle = `お気に入り中の${appDisplayName}が値下がりしました`;
      cartTitle = `カート追加中の${appDisplayName}が値下がりしました`;
    }

    const appRedirectUrl = `/apps/${publicId}`;

    if (favoriteUserIds.length > 0) {
      await createNotificationsWithUserSetting(
        prisma,
        favoriteUserIds.map((targetUserId) => ({
          userId: targetUserId,
          actorId: userId,
          type: "SYSTEM",
          title: favoriteTitle,
          message: null,
          redirectUrl: appRedirectUrl,
          appId: app.id,
        })),
      );
    }

    if (cartUserIds.length > 0) {
      await createNotificationsWithUserSetting(
        prisma,
        cartUserIds.map((targetUserId) => ({
          userId: targetUserId,
          actorId: userId,
          type: "SYSTEM",
          title: cartTitle,
          message: null,
          redirectUrl: appRedirectUrl,
          appId: app.id,
        })),
      );
    }

    if (app.bewtsProjectId) {
      const project = await prisma.bewtsProject.findUnique({
        where: { id: app.bewtsProjectId },
        select: {
          id: true,
          publicId: true,
          name: true,
          leaderId: true,
          rooms: {
            where: { isAllRoom: true },
            select: {
              members: {
                select: { userId: true },
              },
            },
          },
        },
      });

      if (project) {
        const memberUserIds = Array.from(
          new Set(
            [
              project.leaderId,
              ...(project.rooms[0]?.members?.map((member) => member.userId) ??
                []),
            ].filter((memberId) => memberId !== userId),
          ),
        );

        if (memberUserIds.length > 0) {
          await createNotificationsWithUserSetting(
            prisma,
            memberUserIds.map((targetUserId) => ({
              userId: targetUserId,
              actorId: userId,
              type: "SYSTEM",
              title: `${project.name}の詳細が変更されました`,
              message: null,
              redirectUrl: `/bewts/${project.publicId}`,
              bewtsProjectId: project.id,
            })),
          );
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: "アプリを更新しました",
  });
}
