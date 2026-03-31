import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUserInput } from "@/utils/normalize";
import { NextResponse } from "next/server";

/**
 * POST /api/tags
 * 新しいタグを作成し、ユーザーに関連付け
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number.parseInt(session.user.id);

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 },
      );
    }

    const normalizedName = normalizeUserInput(name.trim());

    if (normalizedName.length === 0 || normalizedName.length > 30) {
      return NextResponse.json(
        { error: "Tag name must be between 1 and 30 characters" },
        { status: 400 },
      );
    }

    // 既にタグが存在するか確認
    const existingTag = await prisma.tag.findUnique({
      where: {
        name: normalizedName,
      },
    });

    if (existingTag) {
      // グローバルタグの場合はそのまま返す
      const isGlobalTag = await prisma.userTag.findUnique({
        where: {
          userId_tagId: {
            userId,
            tagId: existingTag.id,
          },
        },
      });

      if (isGlobalTag) {
        return NextResponse.json(
          { error: "Tag already exists" },
          { status: 409 },
        );
      }

      // ユーザータグとして関連付けていない場合は関連付ける
      await prisma.userTag.create({
        data: {
          userId,
          tagId: existingTag.id,
        },
      });

      return NextResponse.json({ tag: existingTag }, { status: 200 });
    }

    // 新しいタグを作成し、ユーザーに関連付け
    const newTag = await prisma.tag.create({
      data: {
        name: normalizedName,
        users: {
          create: {
            userId,
          },
        },
      },
    });

    return NextResponse.json({ tag: newTag }, { status: 201 });
  } catch (error) {
    console.error("Error creating tag:", error);
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 },
    );
  }
}
