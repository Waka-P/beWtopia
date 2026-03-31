"use client";

import { RolePicker } from "@/app/(sidebar)/components/RolePicker";
import { Modal } from "@/components/Modal/Modal";
import { cn } from "@/lib/cn";
import { useState } from "react";
import styles from "./JoinRequestModal.module.scss";

export type JoinRequestModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  projectPublicId: string;
  // optional list of roles to let applicant request a role
  availableRoles?: { id: number; name: string }[];
  onSuccess?: () => void;
};

export function JoinRequestModal({
  open,
  onOpenChange,
  projectName,
  projectPublicId,
  availableRoles,
  onSuccess,
}: JoinRequestModalProps) {
  const [message, setMessage] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/bewts/join-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectPublicId,
          message: message.trim() || undefined,
          roleIds: selectedRoleIds.length > 0 ? selectedRoleIds : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "参加申請に失敗しました");
      }

      onOpenChange(false);
      setMessage("");
      setSelectedRoleIds([]);
      setError(null);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setProcessing(false);
    }
  };

  const handleRootOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && processing) return;
    if (!nextOpen) {
      setMessage("");
      setSelectedRoleIds([]);
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleRootOpenChange}
      title="参加申請"
      description={`${projectName}への参加を申請します`}
      maxWidth="sm"
      showCloseButton={!processing}
      footer={
        <div className={styles.buttons}>
          <button
            type="button"
            className={cn(styles.button)}
            onClick={() => {
              if (!processing) handleRootOpenChange(false);
            }}
            disabled={processing}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={cn(styles.button, styles.submitButton)}
            onClick={handleSubmit}
            disabled={processing}
          >
            {processing ? "送信中..." : "申請を送る"}
          </button>
        </div>
      }
    >
      <div className={styles.content}>
        <p className={styles.description}>リーダーに参加申請を送信します</p>

        {/** 希望役割 */}
        {/** availableRoles が渡された場合に選択肢を表示 */}
        {availableRoles && availableRoles.length > 0 && (
          <div className={styles.inputGroup}>
            <div className={styles.label}>希望役割（任意）</div>
            <RolePicker
              roles={availableRoles}
              selectedRoleIds={selectedRoleIds}
              onChange={setSelectedRoleIds}
              placeholder="希望役割を選択（複数可）"
              maxItems={10}
              disabled={processing}
            />
          </div>
        )}

        <div className={styles.inputGroup}>
          <label htmlFor="join-message" className={styles.label}>
            メッセージ（任意）
          </label>
          <textarea
            id="join-message"
            className={styles.textarea}
            rows={4}
            placeholder="参加の動機やアピールポイントを入力してください... "
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={processing}
            maxLength={500}
          />
          <div className={styles.charCount}>{message.length} / 500</div>
        </div>

        {error && <div className={styles.error}>{error}</div>}
      </div>
    </Modal>
  );
}
