import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.scss";

export const metadata: Metadata = {
  title: "パスワードリセット完了",
};

export default async function PassWordResetSuccessPage() {
  return (
    <div className={styles.wrapper}>
      <Image
        src="/images/beWtopia.png"
        width={2072}
        height={494}
        alt="beWtopiaのロゴ"
        className={styles.logo}
      />
      <Image
        src="/images/check-outlined.png"
        width={403}
        height={403}
        alt="パスワードリセット完了"
        className={styles.checkIcon}
      />
      <h1 className={styles.title}>パスワードリセット完了</h1>
      <p className={styles.message}>
        パスワードをリセットしました。新しいパスワードでログインしてください
      </p>
      <Link href="/login" className={styles.loginButton}>
        ログインページへ
      </Link>
    </div>
  );
}
