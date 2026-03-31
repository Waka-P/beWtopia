import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUserInput } from "@/utils/normalize";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ publicId: string; id: string }> },
) {
  const { publicId, id } = await params;

  if (!publicId || typeof publicId !== "string") {
    return NextResponse.json({ error: "Invalid app id" }, { status: 400 });
  }

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid review id" }, { status: 400 });
  }

  const app = await prisma.app.findUnique({ where: { publicId } });
  if (!app)
    return NextResponse.json({ error: "App not found" }, { status: 404 });

  const review = await prisma.appReview.findUnique({
    where: { id: Number(id) },
    include: { user: true },
  });

  if (!review)
    return NextResponse.json({ error: "Review not found" }, { status: 404 });

  if (review.appId !== app.id) {
    return NextResponse.json({ error: "Invalid app" }, { status: 400 });
  }

  // convert Decimal/date
  const out = {
    id: review.id,
    body: review.body,
    rating:
      typeof (review as any).rating === "object" &&
      "toNumber" in (review as any).rating
        ? (review as any).rating.toNumber()
        : review.rating,
    appId: review.appId,
    userId: review.userId,
    createdAt:
      review.createdAt instanceof Date
        ? review.createdAt.toISOString()
        : review.createdAt,
    user: review.user
      ? {
          id: review.user.id,
          publicId: review.user.publicId,
          name: review.user.name,
          image: review.user.image,
        }
      : null,
  };

  return NextResponse.json(out);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ publicId: string; id: string }> },
) {
  const { publicId, id } = await params;

  if (!publicId || typeof publicId !== "string") {
    return NextResponse.json({ error: "Invalid app id" }, { status: 400 });
  }

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid review id" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);

  const app = await prisma.app.findUnique({ where: { publicId } });
  if (!app)
    return NextResponse.json({ error: "App not found" }, { status: 404 });

  const review = await prisma.appReview.findUnique({
    where: { id: Number(id) },
  });
  if (!review)
    return NextResponse.json({ error: "Review not found" }, { status: 404 });

  if (review.appId !== app.id) {
    return NextResponse.json({ error: "Invalid app" }, { status: 400 });
  }

  if (review.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const rating = typeof body.rating === "number" ? body.rating : null;
  const text = typeof body.body === "string" ? body.body : undefined;
  const normalizedText = normalizeUserInput(text);

  try {
    const updated = await prisma.appReview.update({
      where: { id: Number(id) },
      data: {
        ...(rating !== null ? { rating } : {}),
        ...(typeof text === "string" ? { body: normalizedText } : {}),
      },
    });

    // 再計算
    const agg = await prisma.appReview.aggregate({
      _avg: { rating: true },
      where: { appId: app.id },
    });

    const avg = agg._avg.rating ?? 0;
    await prisma.app.update({ where: { id: app.id }, data: { rating: avg } });

    // 所有者のユーザー評価も再計算して保存
    if (app.ownerId != null) {
      const ownerAgg = await prisma.app.aggregate({
        _avg: { rating: true },
        where: { ownerId: app.ownerId },
      });
      const ownerAvg = ownerAgg._avg.rating ?? 0;
      await prisma.user.update({
        where: { id: app.ownerId },
        data: { rating: ownerAvg },
      });
    }

    return NextResponse.json({ ok: true, review: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to update review" },
      { status: 500 },
    );
  }
}
