import styles from "./SubmitProgressOverlay.module.scss";

interface SubmitProgressOverlayProps {
  visible: boolean;
  progress: number;
  iconPreviewUrl: string | null;
}

export function SubmitProgressOverlay({
  visible,
  progress,
  iconPreviewUrl,
}: SubmitProgressOverlayProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className={styles.overlay} aria-live="polite">
      <div className={styles.content}>
        <div className={styles.appIconWrapper}>
          {/* biome-ignore lint/performance/noImgElement: ローカルBlob URLの即時プレビューを優先 */}
          <img
            src={iconPreviewUrl || "/images/icon-default.png"}
            alt="アプリアイコンプレビュー"
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
