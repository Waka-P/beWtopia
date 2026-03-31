import Avatar from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { cn } from "@/lib/cn";
import { prisma } from "@/lib/prisma";
import { formatTimeAgo } from "@/utils/date";
import { notFound } from "next/navigation";
import styles from "./page.module.scss";

type Props = {
  params: Promise<{ publicId?: string; id?: string }>;
};

export default async function ModalReviewDetail({ params }: Props) {
  const { publicId: appPublicId, id: reviewId } = await params;

  if (!appPublicId || !reviewId) {
    notFound();
  }

  const app = await prisma.app.findUnique({ where: { publicId: appPublicId } });
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

  return (
    <Modal
      open
      title="レビュー詳細"
      description="レビューの詳細モーダル"
      useRouterBack
    >
      <div className={styles.reviewItem}>
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
    </Modal>
  );
}
