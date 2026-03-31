"use client";

import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import styles from "./Settings.module.scss";

type ProjectStatus = "RECRUITING" | "DEVELOPING" | "COMPLETED";
type StatusClassName = "recruiting" | "developing" | "completed";

const STATUS_OPTIONS: {
  key: ProjectStatus;
  label: string;
  className: StatusClassName;
}[] = [
  { key: "RECRUITING", label: "募集中", className: "recruiting" },
  { key: "DEVELOPING", label: "開発中", className: "developing" },
  { key: "COMPLETED", label: "完了", className: "completed" },
];

export default function ProjectStatusToggle({
  publicId,
  initialStatus,
}: {
  publicId: string;
  initialStatus: ProjectStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ProjectStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = async (nextStatus: ProjectStatus) => {
    if (nextStatus === status || isPending) return;

    const prevStatus = status;
    setStatus(nextStatus);

    try {
      const response = await fetch(`/api/bewts/${publicId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        throw new Error("ステータス更新に失敗しました");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setStatus(prevStatus);
    }
  };

  return (
    <div className={styles.statusToggleRow}>
      {STATUS_OPTIONS.map((option) => {
        const active = status === option.key;

        return (
          <button
            key={option.key}
            type="button"
            className={cn(
              styles.statusBadge,
              styles[option.className],
              option.className,
              !active && styles.statusBadgeInactive,
            )}
            onClick={() => {
              void handleStatusChange(option.key);
            }}
            aria-pressed={active}
            disabled={isPending}
          >
            <span className={styles.statusDot} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
