"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import ResendVerificationBtn from "../../components/UserAuthForm/ResendVerificationBtn";
import ResendVerificationNotice from "../../components/UserAuthForm/ResendVerificationNotice";
import styles from "./page.module.scss";

export default function SignUpTokenExpired() {
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
        <h1 className={styles.title}>アカウント確認の有効期限が切れています</h1>
        <p className={styles.message}>
          申し訳ありませんが、アカウント確認の有効期限が切れています
        </p>
        <ResendVerificationBtn
          onOpenNotice={handleOpenResendNotice}
          className={styles.openResendBtn}
        />
      </div>
      <ResendVerificationNotice
        isOpen={isOpenResendNotice}
        isExpired={true}
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
