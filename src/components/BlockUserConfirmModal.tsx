"use client";

import Avatar from "@/components/Avatar";
import { Modal } from "@/components/Modal/Modal";
import { cn } from "@/lib/cn";
import styles from "./BlockUserConfirmModal.module.scss";

export type UserConfirmModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  bodyText?: string;
  // allow rendering extra controls (role select) inside the modal body
  children?: React.ReactNode;
  userName: string;
  userImage: string | null;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "block" | "unblock" | "approve";
  processing?: boolean;
  onConfirm: () => void;
};

export function UserConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  bodyText,
  children,
  userName,
  userImage,
  confirmLabel,
  cancelLabel = "キャンセル",
  variant = "block",
  processing = false,
  onConfirm,
}: UserConfirmModalProps & { children?: React.ReactNode }) {
  const handleRootOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && processing) return;
    onOpenChange(nextOpen);
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleRootOpenChange}
      title={title}
      description={description ?? title}
      maxWidth="sm"
      showCloseButton={!processing}
      footer={
        <div className={styles.buttons}>
          <button
            type="button"
            className={cn(styles.button, styles.cancelButton)}
            onClick={() => {
              if (!processing) onOpenChange(false);
            }}
            disabled={processing}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={cn(
              styles.button,
              variant === "approve"
                ? styles.approveButton
                : variant === "unblock"
                  ? styles.unblockButton
                  : styles.blockButton,
            )}
            onClick={onConfirm}
            disabled={processing}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      {bodyText && <p className={styles.description}>{bodyText}</p>}

      {/* extra content (ex. role select) */}
      {children}

      <div className={styles.userRow}>
        <Avatar
          src={userImage}
          alt={`${userName}さんのアイコン`}
          className={styles.userAvatar}
        />
        <span className={styles.userName}>{userName}</span>
      </div>
    </Modal>
  );
}

export type BlockUserConfirmModalProps = Omit<
  UserConfirmModalProps,
  "title" | "description" | "bodyText" | "confirmLabel" | "cancelLabel"
>;

export function BlockUserConfirmModal({
  open,
  onOpenChange,
  userName,
  userImage,
  processing,
  onConfirm,
}: BlockUserConfirmModalProps) {
  return (
    <UserConfirmModal
      open={open}
      onOpenChange={onOpenChange}
      title="このユーザをブロックしますか？"
      description="このユーザをブロックしますか？"
      bodyText="ブロックしたユーザは設定のブロックリストから確認できます。"
      userName={userName}
      userImage={userImage}
      confirmLabel="ブロック"
      cancelLabel="キャンセル"
      processing={processing}
      onConfirm={onConfirm}
    />
  );
}
