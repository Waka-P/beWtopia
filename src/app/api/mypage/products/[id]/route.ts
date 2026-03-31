import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = {
  id: string;
};

export async function DELETE(req: Request, props: { params: Promise<Params> }) {
  const params = await props.params;
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const publicId = params.id;

    // アプリの所有者確認
    const app = await prisma.app.findUnique({
      where: { publicId },
      select: {
        id: true,
        ownerId: true,
        bewtsProject: {
          select: {
            leaderId: true,
          },
        },
      },
    });

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    const userId = Number(session.user.id);
    const isBewtsProjectApp = app.bewtsProject != null;
    const canDelete = isBewtsProjectApp
      ? app.bewtsProject?.leaderId === userId
      : app.ownerId === userId;

    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // アプリを削除（カスケード削除で関連データも削除される）
    await prisma.app.delete({
      where: { publicId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete app:", error);
    return NextResponse.json(
      { error: "Failed to delete app" },
      { status: 500 },
    );
  }
}
