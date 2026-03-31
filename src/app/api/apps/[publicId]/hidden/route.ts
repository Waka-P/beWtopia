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

  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const app = await prisma.app.findUnique({ where: { publicId } });

  if (!app) {
    return NextResponse.json({ error: "App not found" }, { status: 404 });
  }

  await prisma.hiddenApp.upsert({
    where: {
      userId_appId: {
        userId,
        appId: app.id,
      },
    },
    update: {},
    create: {
      userId,
      appId: app.id,
    },
  });

  return NextResponse.json({ ok: true, hidden: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;

  if (!publicId || typeof publicId !== "string") {
    return NextResponse.json({ error: "Invalid app id" }, { status: 400 });
  }

  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const app = await prisma.app.findUnique({ where: { publicId } });

  if (!app) {
    return NextResponse.json({ error: "App not found" }, { status: 404 });
  }

  try {
    await prisma.hiddenApp.delete({
      where: {
        userId_appId: {
          userId,
          appId: app.id,
        },
      },
    });
  } catch {
    // 既に削除済みなどは無視
  }

  return NextResponse.json({ ok: true, hidden: false });
}
