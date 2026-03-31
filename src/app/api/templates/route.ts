import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const templates = await prisma.appTemplate.findMany({
      where: {
        userId: undefined, // システムテンプレートのみ取得
      },
      select: {
        id: true,
        name: true,
        body: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to fetch templates:", error);
    return NextResponse.json(
      { error: "テンプレートの取得に失敗しました" },
      { status: 500 },
    );
  }
}
