import { cn } from "@/lib/cn";
import Image from "next/image";
import styles from "./ResendVerificationBtn.module.scss";

export default function ResendVerificationBtn({
  onOpenNotice,
  className = "",
}: {
  onOpenNotice?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpenNotice}
      className={cn(styles.btn, className)}
    >
      <Image
        src="/images/exclamation-primary.png"
        width={114}
        height={114}
        alt="お知らせ"
      />
    </button>
  );
}
