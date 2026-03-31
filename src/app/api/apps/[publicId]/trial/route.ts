import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;

  if (!publicId || typeof publicId !== "string") {
    return NextResponse.json({ error: "Invalid app id" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const userId = Number(session.user.id);

  const app = await prisma.app.findUnique({
    where: { publicId },
    select: { id: true, trial: true },
  });

  if (!app || !app.trial) {
    return NextResponse.json(
      { error: "トライアルがありません" },
      { status: 404 },
    );
  }

  // create or ensure trial usage exists
  const usage = await prisma.appTrialUsage.upsert({
    where: { appId_userId: { appId: app.id, userId } },
    update: {},
    create: { appId: app.id, userId },
  });

  return NextResponse.json({ ok: true, usage });
}
