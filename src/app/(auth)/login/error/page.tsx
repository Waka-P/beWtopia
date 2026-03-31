import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.scss";

export const metadata: Metadata = {
  title: "ログインエラー",
};

export default async function LoginErrorPage() {
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
        src="/images/exclamation-danger.png"
        width={114}
        height={119}
        alt="ログインエラー"
        className={styles.errIcon}
      />
      <h1 className={styles.title}>ログインエラーが発生しました</h1>
      <p className={styles.message}>
        ログイン中にエラーが発生しました。再度お試しください。
      </p>
      <Link href="/login" className={styles.loginLink}>
        ログインページへ
      </Link>
    </div>
  );
}
