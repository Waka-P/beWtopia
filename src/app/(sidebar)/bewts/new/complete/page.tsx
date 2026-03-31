import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.scss";

export const metadata: Metadata = {
  title: "ビューズプロジェクト作成完了",
};

export default function BewtCompletePage() {
  return (
    <div className={styles.mypageContent}>
      <main className={styles.completeMain}>
        <div className={styles.completeCard}>
          <div className={styles.completeIconWrap}>
            <Image
              src="/images/check-outlined.png"
              alt="ビューズプロジェクト作成完了"
              width={403}
              height={403}
              className={styles.checkIcon}
            />
          </div>
          <h1 className={styles.completeTitle}>プロジェクトを作成しました</h1>
          <div className={styles.completeActions}>
            <Link href="/bewts/joined" className={styles.primaryButton}>
              参加中プロジェクト一覧へ
            </Link>
            <Link href="/" className={styles.secondaryButton}>
              ホームへ
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
