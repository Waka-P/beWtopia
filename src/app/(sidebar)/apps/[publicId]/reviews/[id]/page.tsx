import RatingSummary from "@/app/(sidebar)/components/RatingSummary";
import Avatar from "@/components/Avatar";
import { cn } from "@/lib/cn";
import { prisma } from "@/lib/prisma";
import { formatTimeAgo } from "@/utils/date";
import { truncate } from "@/utils/truncate";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.scss";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string; id: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  if (!publicId || typeof publicId !== "string") notFound();

  const app = await prisma.app.findUnique({
    where: { publicId },
  });

  const review = await prisma.appReview.findUnique({
    where: { id: Number((await params).id) },
  });

  if (!review || !app || review.appId !== app.id) {
    notFound();
  }

  if (!app) {
    notFound();
  }
  return {
    title: `${truncate(app.name, 10)}のレビュー - ${truncate(review.body, 20)}`,
  };
}

type Props = {
  params: Promise<{ publicId?: string; id?: string }>;
};

export default async function ModalReviewDetail({ params }: Props) {
  const { publicId: appPublicId, id: reviewId } = await params;

  if (!appPublicId || !reviewId) {
    notFound();
  }

  const app = await prisma.app.findUnique({
    where: { publicId: appPublicId },
    include: {
      reviews: {
        select: {
          rating: true,
        },
      },
      _count: {
        select: {
          reviews: true,
        },
      },
    },
  });
  if (!app) {
    notFound();
  }

  const review = await prisma.appReview.findUnique({
    where: { id: Number(reviewId) },
    include: { user: true },
  });

  if (!review || review.appId !== app.id) {
    notFound();
  }

  const otherReviews = await prisma.appReview.findMany({
    where: { appId: app.id, NOT: { id: review.id } },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 4,
  });

  // レビュー集計: [5星,4星,3星,2星,1星]
  const reviewDistribution: [number, number, number, number, number] = (() => {
    const counts = [0, 0, 0, 0, 0];
    if (!app || !app.reviews)
      return counts as [number, number, number, number, number];
    for (const r of app.reviews) {
      const star = Math.max(1, Math.min(5, Math.round(r.rating.toNumber())));
      // 5星はindex 0、1星はindex 4
      counts[5 - star] += 1;
    }
    return counts as [number, number, number, number, number];
  })();

  return (
    <div className={styles.container}>
      <div className={styles.appInfo}>
        <Link className={styles.appInfoLeft} href={`/apps/${appPublicId}`}>
          <span className={styles.appIconWrapper}>
            <Image
              src={app.appIconUrl || "/images/icon-default.png"}
              alt={`${app.name}のアイコン`}
              fill
              className={styles.appIcon}
            />
          </span>
          <p className={styles.appName}>{app.name}</p>
        </Link>
        <RatingSummary
          average={app?.rating.toNumber() ?? 0}
          totalCount={app?._count?.reviews ?? app?.reviews?.length ?? 0}
          distribution={reviewDistribution}
        />
      </div>
      <div className={cn(styles.reviewItem, styles.detail)}>
        {/* ユーザー情報 */}
        <div className={styles.reviewUser}>
          <Avatar
            src={review.user?.image || null}
            alt={`${review.user?.name}のアイコン`}
            className={styles.reviewAvatar}
          />
          <div className={styles.reviewMeta}>
            <strong className={styles.reviewName}>{review.user?.name}</strong>
            <time className={styles.reviewTime}>
              {formatTimeAgo(review.updatedAt)}
            </time>
          </div>
        </div>

        {/* 星 */}
        <div className={styles.reviewStars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className={cn(
                styles.reviewStar,
                n <= Math.round(review.rating.toNumber())
                  ? styles.reviewStarFull
                  : styles.reviewStarEmpty,
              )}
            >
              ★
            </span>
          ))}
        </div>

        {/* 本文 (3行truncate) */}
        <p className={styles.reviewBody}>{review.body}</p>
      </div>
      {/* 他のレビュー（最大4件） */}
      {otherReviews.length > 0 && (
        <div className={styles.otherReviews}>
          <div className={styles.otherReviewsHeader}>
            <h3 className={styles.otherReviewsTitle}>その他のレビュー</h3>
            {app._count?.reviews && app._count.reviews > 4 && (
              <Link
                href={`/apps/${appPublicId}/reviews`}
                className={styles.otherReviewsLink}
              >
                すべて見る
              </Link>
            )}
          </div>
          <div className={styles.reviewsGrid}>
            {otherReviews.map((r) => (
              <article key={r.id} className={styles.reviewItem}>
                <Link href={`/apps/${appPublicId}/reviews/${r.id}`}>
                  <div className={styles.reviewUser}>
                    <Avatar
                      src={r.user?.image || null}
                      alt={`${r.user?.name}のアイコン`}
                      className={styles.reviewAvatar}
                    />
                    <div className={styles.reviewMeta}>
                      <strong className={styles.reviewName}>
                        {r.user?.name}
                      </strong>
                      <time className={styles.reviewTime}>
                        {formatTimeAgo(r.updatedAt)}
                      </time>
                    </div>
                  </div>
                  <div className={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className={cn(
                          styles.reviewStar,
                          n <=
                            Math.round(
                              (r as any).rating?.toNumber?.() ?? r.rating,
                            )
                            ? styles.reviewStarFull
                            : styles.reviewStarEmpty,
                        )}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <p className={styles.reviewBody}>{r.body}</p>
                </Link>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
