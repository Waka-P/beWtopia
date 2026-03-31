import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import RequestList from "./components/RequestList";
import { LIKE_EMOJI } from "./constants";
import styles from "./requests.module.scss";

export const metadata: Metadata = {
  title: "リクエスト一覧",
};

export default async function RequestsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  const requests = await prisma.request.findMany({
    orderBy: { createdAt: "desc" },
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
        take: 5,
      },
      reactions: {
        select: {
          emoji: true,
        },
      },
    },
  });

  // いいね数を集計
  const requestsData = await Promise.all(
    requests.map(async (req) => {
      const likeCount = req.reactions.filter(
        (r) => r.emoji === LIKE_EMOJI,
      ).length;

      // ユーザーがいいねしているか確認
      let isLiked = false;
      if (userId) {
        const userReaction = await prisma.requestReaction.findUnique({
          where: {
            requestId_userId_emoji: {
              requestId: req.id,
              userId,
              emoji: LIKE_EMOJI,
            },
          },
        });
        isLiked = !!userReaction;
      }

      return {
        publicId: req.publicId,
        title: req.title,
        content: req.content,
        createdAt: req.createdAt.toISOString(),
        user: {
          name: req.user.name,
          publicId: req.user.publicId,
          image: req.user.image,
        },
        tags: req.tags.map((t) => ({
          id: t.tag.id,
          name: t.tag.name,
        })),
        likeCount,
        isLiked,
        canManage: userId != null && req.userId === userId,
      };
    }),
  );

  return (
    <div className={styles.container}>
      <Link href="/requests/new" className={styles.newButton}>
        <Image
          src="/images/plus-mark.png"
          width={550}
          height={551}
          alt="リクエストを投稿する"
        />
      </Link>
      <RequestList initialRequests={requestsData} />
    </div>
  );
}
