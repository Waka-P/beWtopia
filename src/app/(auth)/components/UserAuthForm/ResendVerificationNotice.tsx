import { authClient } from "@/lib/auth-client";
import Image from "next/image";
import Link from "next/link";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import AuthNotice from "../AuthNotice";
import styles from "./ResendVerificationNotice.module.scss";

export default function ResendVerificationNotice({
  isOpen,
  isExpired = false,
  onClose,
  email = "",
  isOpenErrNotice = false,
  openErrNotice = () => {},
  closeErrNotice = () => {},
  setErrMsg = () => {},
  actionBtn = null,
}: {
  isOpen: boolean;
  isExpired?: boolean;
  onClose?: () => void;
  email?: string;
  isOpenErrNotice?: boolean;
  openErrNotice?: () => void;
  closeErrNotice?: () => void;
  setErrMsg?: Dispatch<SetStateAction<string>>;
  actionBtn?: React.ReactNode;
}) {
  const COOLDOWN_SECONDS = 60;
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendVerification = async () => {
    if (countdown > 0 || isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/",
      });

      if (error) {
        openErrNotice();
        setErrMsg("確認メールの再送信に失敗しました。もう一度お試しください");
        console.error(error);
        return;
      }

      setCountdown(COOLDOWN_SECONDS);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpenErrNotice) return;
      closeErrNotice();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeErrNotice, isOpenErrNotice]);

  return (
    <AuthNotice
      isOpen={isOpen}
      onClose={onClose}
      classNames={{
        overlay: styles.noticeOverlay,
        content: styles.noticeContent,
      }}
    >
      <Image
        src="/images/exclamation-primary.png"
        width={114}
        height={114}
        alt="お知らせ"
        className={styles.noticeIcon}
      />
      <h2 className={styles.noticeTitle}>
        {isExpired
          ? "確認メールの有効期限が切れています"
          : email
            ? `${email}に確認メールを送信済みです`
            : "ご登録のメールアドレスに確認メールを送信済みです"}
      </h2>
      {isExpired ? null : (
        <div className={styles.listGroup}>
          <p className={styles.listTitle}>メールが届かない場合</p>
          <ul className={styles.list}>
            <li>迷惑メールフォルダをご確認ください</li>
            <li>メールアドレスが正しいかご確認ください</li>
            <li>しばらく待ってから再送信してください</li>
          </ul>
        </div>
      )}
      {email && !actionBtn ? (
        <button
          type="button"
          className={styles.resendBtn}
          onClick={handleSendVerification}
          disabled={isLoading || countdown > 0}
        >
          {isLoading
            ? "送信中..."
            : countdown > 0
              ? `再送信まで ${countdown}秒`
              : "確認メールを再送信"}
        </button>
      ) : (
        actionBtn
      )}
      {email && (
        <Link href="/login" className={styles.loginLink}>
          別のメールアドレスでログイン
        </Link>
      )}
    </AuthNotice>
  );
}
