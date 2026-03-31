import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const { publicId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 型を絞る: runtime チェックで any を使わずに安全に取り出す
  const parsed = (body as { isHidden?: unknown } | null) ?? null;
  if (!parsed || typeof parsed.isHidden !== "boolean") {
    return NextResponse.json(
      { error: "Missing or invalid isHidden" },
      { status: 400 },
    );
  }

  const isHidden: boolean = parsed.isHidden;

  try {
    const room = await prisma.chatRoom.findUnique({
      where: { publicId },
      include: { members: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const isMember = room.members.some((m) => m.userId === userId);
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId: room.id, userId } },
      data: { isHidden },
    });

    return NextResponse.json({ ok: true, isHidden });
  } catch (err) {
    console.error("Error updating visibility:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
