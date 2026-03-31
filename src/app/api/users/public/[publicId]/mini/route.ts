import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { publicId } = await params;
  if (!publicId) {
    return NextResponse.json({ error: "Invalid public id" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { publicId },
      select: {
        publicId: true,
        name: true,
        image: true,
        rating: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      publicId: user.publicId,
      name: user.name,
      image: user.image,
      rating: Number(user.rating ?? 0),
    });
  } catch (err) {
    console.error("failed to fetch user mini profile", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
