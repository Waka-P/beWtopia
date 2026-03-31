import { cn } from "@/lib/cn";
import styles from "./Badge.module.scss";

type BadgeProps = {
  value: number | string;
  className?: string;
  variant?: "default" | "light";
  hideValue?: boolean;
};

export function Badge({
  value,
  className,
  variant = "default",
  hideValue = false,
}: BadgeProps) {
  return (
    <div
      className={cn(
        styles.badge,
        variant === "light" && styles.badgeLight,
        className,
      )}
    >
      <div className={styles.badgeInner} />
      {!hideValue && <span className={styles.badgeValue}>{value}</span>}
    </div>
  );
}
