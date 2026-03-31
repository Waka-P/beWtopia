import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type PatchBody = {
  status?: "APPROVED" | "REJECTED";
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const { publicId } = await params;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.status || !["APPROVED", "REJECTED"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const order = await prisma.chatOrder.findUnique({
      where: { publicId },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 承認/拒否できるのは受注者のみ
    if (order.targetUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (order.status !== "PENDING") {
      return NextResponse.json(
        { error: "Order is already decided" },
        { status: 400 },
      );
    }

    const updated = await prisma.chatOrder.update({
      where: { id: order.id },
      data: { status: body.status },
    });

    return NextResponse.json({ ok: true, order: updated });
  } catch (error) {
    console.error("Error updating chat order:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
