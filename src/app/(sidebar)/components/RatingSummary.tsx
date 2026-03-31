import { cn } from "@/lib/cn";
import Rating from "./Rating";
import styles from "./RatingSummary.module.scss";

type Props = {
  average: number; // 例: 4.6
  totalCount: number; // 例: 52
  /** 各星の件数 [5星, 4星, 3星, 2星, 1星] */
  distribution: [number, number, number, number, number];
  className?: string;
};

/** 平均点から各星のfull/half/emptyを返す */
function getStarTypes(average: number): ("full" | "half" | "empty")[] {
  return [1, 2, 3, 4, 5].map((n) => {
    if (average >= n) return "full";
    if (average >= n - 0.5) return "half";
    return "empty";
  });
}

export default function RatingSummary({
  average,
  totalCount,
  distribution,
  className = "",
}: Props) {
  const starTypes = getStarTypes(average);
  const max = Math.max(...distribution);

  return (
    <div className={cn(styles.wrapper, className)}>
      {/* 左: スコア */}
      <div className={styles.scoreBlock}>
        <span className={styles.scoreNum}>{average.toFixed(1)}</span>
        <Rating value={average} />
        <p className={styles.scoreCount}>
          {totalCount.toLocaleString()}件の評価
        </p>
      </div>

      {/* 右: バー */}
      <div className={styles.barsBlock}>
        {distribution.map((count, i) => {
          const label = 5 - i;
          const pct = max > 0 ? (count / max) * 100 : 0;
          return (
            <div key={label} className={styles.barRow}>
              <span className={styles.barLabel}>{label}</span>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
