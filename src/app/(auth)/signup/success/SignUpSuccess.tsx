"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import ResendVerificationBtn from "../../components/UserAuthForm/ResendVerificationBtn";
import ResendVerificationNotice from "../../components/UserAuthForm/ResendVerificationNotice";
import styles from "./page.module.scss";

export default function SignupSuccess() {
  const [isOpenResendNotice, setIsOpenResendNotice] = useState(false);

  const handleOpenResendNotice = () => {
    setIsOpenResendNotice(true);
  };

  const handleCloseResendNotice = () => {
    setIsOpenResendNotice(false);
  };

  return (
    <>
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
          alt="アカウント作成完了"
          className={styles.checkIcon}
        />
        <h1 className={styles.title}>アカウント作成完了</h1>
        <p className={styles.message}>
          ご登録いただいたメールアドレスに確認メールを送信しました
        </p>
        <p className={styles.message}>
          メール内のボタンをクリックしてログインしてください
        </p>
        <ResendVerificationBtn
          onOpenNotice={handleOpenResendNotice}
          className={styles.openResendBtn}
        />
      </div>
      <ResendVerificationNotice
        isOpen={isOpenResendNotice}
        onClose={handleCloseResendNotice}
        actionBtn={
          <Link
            href="/signup/resend-verification"
            className={styles.goResendBtn}
          >
            認証メールを再送する
          </Link>
        }
      />
    </>
  );
}
