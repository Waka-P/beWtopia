"use client";

import styles from "../page.module.scss";

type ProfileHeaderProps = {
  editing: boolean;
  onToggleEditing: () => void;
};

export function ProfileHeader({
  editing,
  onToggleEditing,
}: ProfileHeaderProps) {
  return (
    <div className={styles.pageHeader}>
      <div>
        <h2 className={styles.title}>プロフィール</h2>
      </div>
      <button
        type="button"
        className={styles.editToggle}
        onClick={onToggleEditing}
      >
        {editing ? "編集をやめる" : "編集"}
      </button>
    </div>
  );
}
