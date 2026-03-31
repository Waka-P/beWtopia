import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "../../../../bewt/complete/page.module.scss";

export const metadata: Metadata = {
  title: "アプリ更新完了",
};

export default async function AppUpdateCompletePage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;

  return (
    <div className={styles.mypageContent}>
      <main className={styles.completeMain}>
        <div className={styles.completeCard}>
          <div className={styles.completeIconWrap}>
            <Image
              src="/images/check-outlined.png"
              alt="更新完了"
              width={403}
              height={403}
              className={styles.checkIcon}
            />
          </div>
          <h1 className={styles.completeTitle}>アプリの更新が完了しました</h1>
          <div className={styles.completeActions}>
            <Link href={`/apps/${publicId}`} className={styles.primaryButton}>
              アプリ詳細へ
            </Link>
            <Link href="/mypage/products" className={styles.secondaryButton}>
              出品一覧へ
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
