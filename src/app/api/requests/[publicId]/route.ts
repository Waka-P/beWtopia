import { requestSchemaAPI } from "@/app/schemas/requestSchema";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUserInput } from "@/utils/normalize";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const { publicId } = await params;

    const request = await prisma.request.findUnique({
      where: { publicId },
      include: {
        user: {
          select: {
            name: true,
            publicId: true,
            image: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                publicId: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!request) {
      return NextResponse.json(
        { error: "リクエストが見つかりません" },
        { status: 404 },
      );
    }

    return NextResponse.json(request);
  } catch (error) {
    console.error("リクエスト取得エラー:", error);
    return NextResponse.json(
      { error: "リクエストの取得に失敗しました" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { publicId } = await params;
    const userId = Number.parseInt(session.user.id, 10);
    if (Number.isNaN(userId)) {
      return NextResponse.json(
        { error: "認証情報が不正です" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const result = requestSchemaAPI.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "不正なリクエストです",
          details: result.error,
        },
        { status: 400 },
      );
    }

    const target = await prisma.request.findUnique({
      where: { publicId },
      select: { id: true, userId: true, publicId: true },
    });

    if (!target) {
      return NextResponse.json(
        { error: "リクエストが見つかりません" },
        { status: 404 },
      );
    }

    if (target.userId !== userId) {
      return NextResponse.json(
        { error: "編集権限がありません" },
        { status: 403 },
      );
    }

    const data = result.data;

    const updated = await prisma.request.update({
      where: { id: target.id },
      data: {
        title: normalizeUserInput(data.title),
        content: normalizeUserInput(data.content),
        tags: {
          deleteMany: {},
          create: data.tags.map((tagId) => ({ tagId })),
        },
      },
      select: {
        publicId: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("リクエスト更新エラー:", error);
    return NextResponse.json(
      { error: "リクエストの更新に失敗しました" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { publicId } = await params;
    const userId = Number.parseInt(session.user.id, 10);
    if (Number.isNaN(userId)) {
      return NextResponse.json(
        { error: "認証情報が不正です" },
        { status: 401 },
      );
    }

    const target = await prisma.request.findUnique({
      where: { publicId },
      select: { id: true, userId: true },
    });

    if (!target) {
      return NextResponse.json(
        { error: "リクエストが見つかりません" },
        { status: 404 },
      );
    }

    if (target.userId !== userId) {
      return NextResponse.json(
        { error: "削除権限がありません" },
        { status: 403 },
      );
    }

    await prisma.request.delete({
      where: { id: target.id },
    });

    return NextResponse.json({ message: "削除しました" });
  } catch (error) {
    console.error("リクエスト削除エラー:", error);
    return NextResponse.json(
      { error: "リクエストの削除に失敗しました" },
      { status: 500 },
    );
  }
}
