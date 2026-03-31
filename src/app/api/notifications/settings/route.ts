import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const body = await request.json();

    // 許可されたフィールドのみを更新
    const allowedFields = [
      "followEnabled",
      "bewtEnabled",
      "bewtsBewtEnabled",
      "purchaseEnabled",
      "chatEnabled",
      "bewtsChatEnabled",
      "orderEnabled",
      "scoutEnabled",
      "bewtsJoinRequestEnabled",
      "bewtsJoinApprovedEnabled",
      "bewtsJoinDeclinedEnabled",
      "bewtsJoinFinalizedEnabled",
      "bewtsJoinEnabled",
      "systemEnabled",
    ];

    const updateData: Record<string, boolean> = {};
    for (const key of allowedFields) {
      if (typeof body[key] === "boolean") {
        updateData[key] = body[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const settings = await prisma.notificationSetting.upsert({
      where: { userId: user.id },
      update: updateData,
      create: {
        userId: user.id,
        ...updateData,
      },
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("Notification settings update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
