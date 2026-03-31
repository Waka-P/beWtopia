import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getUserEmojiStats } from "../lib/getUserEmojiStats";
import RequestDetail from "./components/RequestDetail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const request = await prisma.request.findUnique({
    where: { publicId },
    select: { title: true },
  });

  if (!request) {
    notFound();
  }

  return {
    title: `リクエスト - ${request.title}`,
  };
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const [request, userEmojiStats] = await Promise.all([
    prisma.request.findUnique({
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
    }),
    getUserEmojiStats(),
  ]);

  if (!request) {
    notFound();
  }

  const requestData = {
    publicId: request.publicId,
    title: request.title,
    content: request.content,
    createdAt: request.createdAt.toISOString(),
    user: {
      name: request.user.name,
      publicId: request.user.publicId,
      image: request.user.image,
    },
    tags: request.tags.map((t) => ({
      id: t.tag.id,
      name: t.tag.name,
    })),
    reactions: request.reactions.map((r) => ({
      id: r.id,
      emoji: r.emoji,
      firstReactedAt: r.createdAt.toISOString(),
      user: {
        publicId: r.user.publicId,
        name: r.user.name,
      },
    })),
  };

  const currentUserId = Number.parseInt(session?.user?.id ?? "", 10);
  const canEdit =
    !Number.isNaN(currentUserId) && currentUserId === request.userId;

  return (
    <RequestDetail
      request={requestData}
      userEmojiStats={userEmojiStats}
      currentUserId={session?.user?.publicId}
      canEdit={canEdit}
    />
  );
}
