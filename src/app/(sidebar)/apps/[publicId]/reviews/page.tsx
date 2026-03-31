import RatingSummary from "@/app/(sidebar)/components/RatingSummary";
import Avatar from "@/components/Avatar";
import { cn } from "@/lib/cn";
import { prisma } from "@/lib/prisma";
import { formatTimeAgo } from "@/utils/date";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.scss";

type PageProps = {
  params: Promise<{
    publicId: string;
  }>;
};

export default async function ReviewPage({ params }: PageProps) {
  const { publicId } = await params;

  const app = await prisma.app.findUnique({
    where: { publicId },
    include: {
      reviews: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { reviews: true } },
    },
  });

  if (!app) notFound();

  const reviewDistribution: [number, number, number, number, number] = (() => {
    const counts = [0, 0, 0, 0, 0];
    if (!app?.reviews)
      return counts as [number, number, number, number, number];
    for (const r of app.reviews) {
      const ratingNum = r.rating?.toNumber?.() ?? r.rating ?? 0;
      const star = Math.max(1, Math.min(5, Math.round(ratingNum)));
      counts[5 - star] += 1;
    }
    return counts as [number, number, number, number, number];
  })();

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.appInfo}>
        <div className={styles.appInfoLeft}>
          <span className={styles.appIconWrapper}>
            <Image
              src={app.appIconUrl || "/images/icon-default.png"}
              alt={`${app.name}のアイコン`}
              fill
              className={styles.appIcon}
            />
          </span>
          <p className={styles.appName}>{app.name}</p>
        </div>
        <RatingSummary
          average={app?.rating.toNumber() ?? 0}
          totalCount={app?._count?.reviews ?? app?.reviews?.length ?? 0}
          distribution={reviewDistribution}
        />
      </div>

      <section className={styles.reviewsListSection}>
        {app.reviews.length === 0 ? (
          <div className={styles.reviewPlaceholder}>
            <p>レビューはまだありません。</p>
          </div>
        ) : (
          <div className={styles.reviewsGridAll}>
            {app.reviews.map((r) => (
              <article key={r.id}>
                <Link
                  href={`/apps/${app.publicId}/reviews/${r.id}`}
                  className={styles.reviewItem}
                >
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
        )}
      </section>
    </div>
  );
}
