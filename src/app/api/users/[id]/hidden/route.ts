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
      { error: "Cannot hide yourself" },
      { status: 400 },
    );
  }

  try {
    await prisma.hiddenUser.upsert({
      where: {
        userId_hiddenUserId: {
          userId: myId,
          hiddenUserId: targetId,
        },
      },
      update: {},
      create: {
        userId: myId,
        hiddenUserId: targetId,
      },
    });

    return NextResponse.json({ ok: true, hidden: true });
  } catch (e) {
    console.error("failed to hide user", e);
    return NextResponse.json({ error: "Failed to hide" }, { status: 500 });
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
      { error: "Cannot unhide yourself" },
      { status: 400 },
    );
  }

  try {
    await prisma.hiddenUser
      .delete({
        where: {
          userId_hiddenUserId: {
            userId: myId,
            hiddenUserId: targetId,
          },
        },
      })
      .catch(() => null);

    return NextResponse.json({ ok: true, hidden: false });
  } catch (e) {
    console.error("failed to unhide user", e);
    return NextResponse.json({ error: "Failed to unhide" }, { status: 500 });
  }
}
