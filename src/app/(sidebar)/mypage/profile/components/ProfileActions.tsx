"use client";

import styles from "../page.module.scss";

type ProfileActionsProps = {
  saving: boolean;
  uploadingImage: boolean;
  onReset: () => void;
  onSave: () => void;
  onPreview: () => void;
};

export function ProfileActions({
  saving,
  uploadingImage,
  onReset,
  onSave,
  onPreview,
}: ProfileActionsProps) {
  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.buttonDelete}
        onClick={onReset}
        disabled={saving}
      >
        変更を破棄
      </button>
      <button
        type="button"
        className={styles.buttonSecondary}
        onClick={onPreview}
        disabled={saving || uploadingImage}
      >
        プレビュー
      </button>
      <button
        type="button"
        className={styles.buttonPrimary}
        onClick={onSave}
        disabled={saving || uploadingImage}
      >
        {saving ? "保存中..." : "保存"}
      </button>
    </div>
  );
}
