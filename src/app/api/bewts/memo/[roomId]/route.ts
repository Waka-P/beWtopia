import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: { roomId: string } | Promise<{ roomId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { params } = context;
  const { roomId: roomIdStr } = await params;
  const roomId = Number(roomIdStr);
  const memo = await prisma.bewtsMemo.findUnique({ where: { roomId } });
  if (!memo) return NextResponse.json({ data: null });

  // return base64-encoded yjs doc
  const b = memo.yjsDoc as Uint8Array | Buffer | null;
  if (!b) return NextResponse.json({ data: null });
  const base64 = Buffer.from(b).toString("base64");
  return NextResponse.json({ data: base64 });
}

export async function POST(
  req: NextRequest,
  context: { params: { roomId: string } | Promise<{ roomId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { params } = context;
  const { roomId: roomIdStr } = await params;
  const roomId = Number(roomIdStr);
  const body = await req.json();
  const { yjsBase64 } = body;
  if (!yjsBase64)
    return NextResponse.json({ error: "missing" }, { status: 400 });

  const data = Buffer.from(yjsBase64, "base64");

  const upsert = await prisma.bewtsMemo.upsert({
    where: { roomId },
    create: { roomId, yjsDoc: data },
    update: { yjsDoc: data },
  });

  return NextResponse.json({ ok: true });
}
