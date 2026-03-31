import AuthNotice from "@/app/(auth)/components/AuthNotice";
import { cn } from "@/lib/cn";
import Image from "next/image";
import styles from "./AuthErrNotice.module.scss";

export default function AuthErrNotice({
  isOpen,
  onClose = () => {},
  message,
  classNames = {},
}: {
  isOpen: boolean;
  onClose?: () => void;
  message: string;
  classNames?: Partial<{
    overlay: string;
    content: string;
  }>;
}) {
  return (
    <AuthNotice
      isOpen={isOpen}
      onClose={onClose}
      classNames={{
        content: cn(styles.noticeContent, classNames.content),
        overlay: classNames.overlay,
      }}
    >
      <Image
        src="/images/exclamation-danger.png"
        width={114}
        height={119}
        alt="エラー"
        className={styles.noticeIcon}
      />
      <p className={styles.noticeErrMsg}>{message}</p>
    </AuthNotice>
  );
}
