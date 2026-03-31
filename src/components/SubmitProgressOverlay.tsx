import styles from "./SubmitProgressOverlay.module.scss";

interface SubmitProgressOverlayProps {
  visible: boolean;
  progress: number;
  iconSrc?: string | null;
  alt?: string;
  iconSize?: number;
}

export function SubmitProgressOverlay({
  visible,
  progress,
  iconSrc,
  alt = "送信中アイコン",
  iconSize = 200,
}: SubmitProgressOverlayProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className={styles.overlay} aria-live="polite">
      <div className={styles.content}>
        <div
          className={styles.appIconWrapper}
          style={{
            ["--submit-progress-icon-size" as string]: `${iconSize}px`,
          }}
        >
          {/* biome-ignore lint/performance/noImgElement: 画面全体ローディングでURL文字列を直接表示 */}
          <img
            src={iconSrc || "/images/icon-default.png"}
            alt={alt}
            className={styles.appIcon}
          />
        </div>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className={styles.progressValue}>{Math.round(progress)}%</p>
      </div>
    </div>
  );
}
