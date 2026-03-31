"use client";

import { Modal } from "@/components/Modal";
import type { ReactNode } from "react";
import styles from "./ConfirmModal.module.scss";

export type ConfirmModalProps = {
  open: boolean;
  title?: string;
  message?: string;
  /** 追加情報を強調表示したい場合（例: アプリ名） */
  appName?: string;
  /** ボディ部分をカスタム表示したい場合に使用 */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onAnimationEnd?: () => void;
};

export function ConfirmModal({
  open,
  title = "確認",
  message,
  appName,
  children,
  confirmLabel = "削除する",
  cancelLabel = "キャンセル",
  onConfirm,
  onCancel,
  onAnimationEnd,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel();
        }
      }}
      onAnimationEnd={onAnimationEnd}
      title={title}
      description={message ?? "確認ダイアログ"}
      maxWidth="sm"
      showCloseButton={false}
      footer={
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className={styles.body}>
        {message && <p className={styles.message}>{message}</p>}
        {appName && <div className={styles.appName}>{appName}</div>}
        {children}
      </div>
    </Modal>
  );
}
