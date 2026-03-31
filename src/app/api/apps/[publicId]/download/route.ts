import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { headers as nextHeaders } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  if (!publicId || typeof publicId !== "string") {
    return NextResponse.json({ error: "Invalid app id" }, { status: 400 });
  }

  // session check
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const userId = Number(session.user.id);

  const app = await prisma.app.findUnique({
    where: { publicId },
    select: {
      id: true,
      name: true,
      appFileKey: true,
      ownerId: true,
      trial: true,
    },
  });

  if (!app) {
    return NextResponse.json({ error: "App not found" }, { status: 404 });
  }

  // allow owner
  if (app.ownerId !== userId) {
    // validate purchase(s)
    const purchases = await prisma.purchaseHistory.findMany({
      where: { appId: app.id, userId },
      include: { salesPlan: true },
    });
    if (!purchases || purchases.length === 0) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    // If any buyout (買い切り) purchase exists, allow.
    const hasBuyout = purchases.some((p) => p.salesPlan.salesFormat === "P");
    if (!hasBuyout) {
      // If only subscription purchases exist, ensure an active checkoutSession (COMPLETED)
      const checkout = await prisma.checkoutSession.findFirst({
        where: {
          userId,
          mode: "S",
          status: "COMPLETED",
          stripeSessionId: { not: null },
          items: {
            some: {
              appId: app.id,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      if (!checkout) {
        return NextResponse.json(
          { error: "サブスクが解約済みのためダウンロードできません" },
          { status: 403 },
        );
      }
    }
  }

  const isTrial = req.nextUrl.searchParams.get("trial") === "true";
  const key = isTrial
    ? (app.trial?.trialFileKey ?? null)
    : (app.appFileKey ?? null);

  if (!key) {
    return NextResponse.json(
      { error: "ファイルが見つかりません" },
      { status: 404 },
    );
  }

  // fetch object from R2 by key and proxy it to the client
  try {
    const { getObjectFromR2 } = await import("@/lib/r2");
    const object = (await getObjectFromR2(
      key as string,
    )) as GetObjectCommandOutput;

    if (!object || !object.Body) {
      return NextResponse.json(
        { error: "ファイルが見つかりません" },
        { status: 404 },
      );
    }

    // determine filename from key (fallback to app name)
    let filename = `${app.name}.zip`;
    try {
      const parts = (key as string).split("/");
      const last = parts[parts.length - 1];
      if (last) filename = decodeURIComponent(last);
    } catch {
      /* ignore */
    }

    const headers: Record<string, string> = {};
    const contentType = object.ContentType ?? "application/zip";
    headers["Content-Type"] = contentType;
    headers["Content-Disposition"] =
      `attachment; filename="${filename.replace(/"/g, "")}"`;

    const body = object.Body as BodyInit;
    return new Response(body, { status: 200, headers });
  } catch (err) {
    console.error("R2 proxy download error", err);
    return NextResponse.json(
      { error: "ファイルのプロキシに失敗しました" },
      { status: 500 },
    );
  }
}
