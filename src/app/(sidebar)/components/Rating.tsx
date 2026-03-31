import { cn } from "@/lib/cn";
import { useId } from "react";
import styles from "./Rating.module.scss";

export type RatingProps = {
  value: number;
  max?: number;
  className?: string;
};

export default function Rating({
  value,
  max = 5,
  className = "",
}: RatingProps) {
  const safeValue = Number.isFinite(value)
    ? Math.max(0, Math.min(max, value))
    : 0;
  const id = useId(); // React 18+ の useId

  return (
    <div
      className={cn(styles.rating, className)}
      aria-label={`評価 ${safeValue.toFixed(1)} / ${max}`}
      role="img"
    >
      <svg width={max * 20} height={20} aria-hidden="true">
        <defs>
          <clipPath id={`star-clip-${id}`}>
            <rect
              x={0}
              y={0}
              width={`${(safeValue / max) * 100}%`}
              height="100%"
            />
          </clipPath>
        </defs>

        {/* 背景の星 (アウトライン) */}
        {Array.from({ length: max }, (_, i) => (
          <text
            // biome-ignore lint: 順番が変化しないため、インデックスをキーに使用しても問題ない
            key={i}
            x={i * 20}
            y={16}
            fontSize={18}
            fill="transparent"
            stroke="#10ffff"
            strokeWidth={0.5}
          >
            ★
          </text>
        ))}

        {/* 前景の星 (塗り) */}
        <g clipPath={`url(#star-clip-${id})`}>
          {Array.from({ length: max }, (_, i) => (
            // biome-ignore lint: 順番が変化しないため、インデックスをキーに使用しても問題ない
            <text key={i} x={i * 20} y={16} fontSize={18} fill="#10ffff">
              ★
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}
