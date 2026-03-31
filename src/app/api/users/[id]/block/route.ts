import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const targetId = Number.parseInt(id, 10);
  const myId = Number.parseInt(session.user.id, 10);

  if (!Number.isFinite(targetId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  if (!Number.isFinite(myId)) {
    return NextResponse.json(
      { error: "Invalid session user id" },
      { status: 400 },
    );
  }

  if (myId === targetId) {
    return NextResponse.json(
      { error: "Cannot block yourself" },
      { status: 400 },
    );
  }

  try {
    await prisma.userBlock.upsert({
      where: {
        blockedId_blockerId: {
          blockedId: targetId,
          blockerId: myId,
        },
      },
      update: {},
      create: {
        blockedId: targetId,
        blockerId: myId,
      },
    });

    return NextResponse.json({ ok: true, blocked: true });
  } catch (e) {
    console.error("failed to block user", e);
    return NextResponse.json({ error: "Failed to block" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const targetId = Number.parseInt(id, 10);
  const myId = Number.parseInt(session.user.id, 10);

  if (!Number.isFinite(targetId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  if (!Number.isFinite(myId)) {
    return NextResponse.json(
      { error: "Invalid session user id" },
      { status: 400 },
    );
  }

  if (myId === targetId) {
    return NextResponse.json(
      { error: "Cannot unblock yourself" },
      { status: 400 },
    );
  }

  try {
    await prisma.userBlock
      .delete({
        where: {
          blockedId_blockerId: {
            blockedId: targetId,
            blockerId: myId,
          },
        },
      })
      .catch(() => null);

    return NextResponse.json({ ok: true, blocked: false });
  } catch (e) {
    console.error("failed to unblock user", e);
    return NextResponse.json({ error: "Failed to unblock" }, { status: 500 });
  }
}
