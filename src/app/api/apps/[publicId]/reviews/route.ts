import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUserInput } from "@/utils/normalize";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUserId = Number(session.user.id);

  const body = await req.json().catch(() => ({}));
  const rating = typeof body.rating === "number" ? body.rating : null;
  const text = typeof body.body === "string" ? body.body : "";
  const normalizedText = normalizeUserInput(text);

  if (!publicId) {
    return NextResponse.json({ error: "Invalid app" }, { status: 400 });
  }

  const app = await prisma.app.findUnique({ where: { publicId } });
  if (!app)
    return NextResponse.json({ error: "App not found" }, { status: 404 });

  // 購入確認: 購入履歴があるユーザーのみレビュー可能
  const purchase = await prisma.purchaseHistory.findFirst({
    where: { appId: app.id, userId: currentUserId },
  });

  if (!purchase) {
    return NextResponse.json(
      { error: "Purchase required to post review" },
      { status: 403 },
    );
  }

  // 1件しか許可しないので upsert
  const where = { appId_userId: { appId: app.id, userId: currentUserId } };

  try {
    const upserted = await prisma.appReview.upsert({
      where,
      create: {
        appId: app.id,
        userId: currentUserId,
        rating: rating ?? 0,
        body: normalizedText,
      },
      update: {
        rating: rating ?? 0,
        body: normalizedText,
      },
    });

    // 平均評価を再計算して App.rating に保存
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

    return NextResponse.json({ ok: true, review: upserted });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to save review" },
      { status: 500 },
    );
  }
}
