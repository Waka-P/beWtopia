"use client";

import { Modal } from "@/components/Modal";
import { useState } from "react";
import styles from "./DeleteChatMessageModal.module.scss";

interface DeleteChatMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
}

export function DeleteChatMessageModal({
  open,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}: DeleteChatMessageModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error("メッセージの削除に失敗しました:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    if (!isProcessing) {
      onOpenChange(false);
    }
  };

  const loading = isDeleting || isProcessing;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="メッセージを削除"
      description="このメッセージを削除してもよろしいですか？"
      maxWidth="sm"
      footer={
        <div className={styles.footerActions}>
          <button
            type="button"
            onClick={handleCancel}
            className={styles.cancelButton}
            disabled={loading}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={styles.deleteButton}
            disabled={loading}
          >
            {loading ? "削除中..." : "削除する"}
          </button>
        </div>
      }
    >
      <div className={styles.content}>
        <p>このメッセージを削除してもよろしいですか？</p>
        <p className={styles.warning}>この操作は取り消せません。</p>
      </div>
    </Modal>
  );
}
