import { auth } from "@/lib/auth";
import { createNotificationWithUserSetting } from "@/lib/notification-settings";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
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
      { error: "Cannot follow yourself" },
      { status: 400 },
    );
  }

  try {
    const myUser = await prisma.user.findUnique({
      where: { id: myId },
      select: { name: true, publicId: true },
    });

    if (!myUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existingFollow = await prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId: myId,
          followingId: targetId,
        },
      },
      select: { followerId: true },
    });

    const blocked = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: myId, blockedId: targetId },
          { blockerId: targetId, blockedId: myId },
        ],
      },
    });

    if (blocked) {
      return NextResponse.json(
        { error: "Follow disabled by block" },
        { status: 403 },
      );
    }

    // 相手ユーザがプライバシー設定でフォローを無効化している場合はフォロー不可
    const followCategory = await prisma.privacyCategory.findFirst({
      where: { name: "フォロー" },
    });

    if (followCategory) {
      const setting = await prisma.privacySetting.findFirst({
        where: {
          userId: targetId,
          privacyCategoryId: followCategory.id,
        },
      });

      if (setting && !setting.isEnabled) {
        return NextResponse.json(
          { error: "Follow disabled by user privacy" },
          { status: 403 },
        );
      }
    }

    await prisma.userFollow.upsert({
      where: {
        followerId_followingId: {
          followerId: myId,
          followingId: targetId,
        },
      },
      update: {},
      create: {
        followerId: myId,
        followingId: targetId,
      },
    });

    if (!existingFollow) {
      await createNotificationWithUserSetting(prisma, {
        userId: targetId,
        actorId: myId,
        type: "FOLLOW",
        title: `${myUser.name}さんがあなたをフォローしました`,
        message: null,
        redirectUrl: `/users/${myUser.publicId}`,
      });
    }

    return NextResponse.json({ ok: true, following: true });
  } catch (e) {
    console.error("failed to follow user", e);
    return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
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
      { error: "Cannot unfollow yourself" },
      { status: 400 },
    );
  }

  try {
    await prisma.userFollow
      .delete({
        where: {
          followerId_followingId: {
            followerId: myId,
            followingId: targetId,
          },
        },
      })
      .catch(() => null);

    return NextResponse.json({ ok: true, following: false });
  } catch (e) {
    console.error("failed to unfollow user", e);
    return NextResponse.json({ error: "Failed to unfollow" }, { status: 500 });
  }
}
