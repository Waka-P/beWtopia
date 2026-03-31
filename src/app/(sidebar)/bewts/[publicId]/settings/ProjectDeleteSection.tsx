"use client";

import { ConfirmModal } from "@/components/ConfirmModal";
import { ErrorModal } from "@/components/ErrorModal";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./Settings.module.scss";

export default function ProjectDeleteSection({
  publicId,
  projectName,
}: {
  publicId: string;
  projectName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const handleDelete = async () => {
    if (processing) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/bewts/${publicId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          (data?.error as string | undefined) ||
            "プロジェクトの削除に失敗しました",
        );
      }

      setOpen(false);
      router.replace("/bewts/joined");
      router.refresh();
    } catch (error) {
      setErrorModal({
        title: "削除に失敗しました",
        message:
          error instanceof Error
            ? error.message
            : "時間をおいて再度お試しください。",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section id="delete-project" className={styles.deleteSection}>
      <button
        type="button"
        className={styles.deleteProjectText}
        onClick={() => setOpen(true)}
      >
        プロジェクトを削除
      </button>

      <ConfirmModal
        open={open}
        title="プロジェクトを削除しますか？"
        message="この操作は取り消せません。"
        appName={projectName}
        confirmLabel={processing ? "削除中..." : "削除する"}
        cancelLabel="キャンセル"
        onCancel={() => {
          if (processing) return;
          setOpen(false);
        }}
        onConfirm={() => {
          void handleDelete();
        }}
      />

      <ErrorModal
        open={Boolean(errorModal)}
        onClose={() => setErrorModal(null)}
        title={errorModal?.title ?? ""}
        message={errorModal?.message ?? ""}
      />
    </section>
  );
}
