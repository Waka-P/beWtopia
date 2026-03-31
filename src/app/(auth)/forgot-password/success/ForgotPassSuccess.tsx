import Image from "next/image";
import styles from "./page.module.scss";

export default async function ForgotPassSuccess() {
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
        alt="パスワードリセットの案内を送信しました"
        className={styles.checkIcon}
      />
      <h1 className={styles.title}>パスワードリセットの案内を送信しました</h1>
      <p className={styles.message}>
        ご登録いただいたメールアドレスにパスワードリセットの案内を送信しました
      </p>
      <p className={styles.message}>
        メール内のボタンをクリックして、パスワードリセットを完了してください
      </p>
    </div>
  );
}
