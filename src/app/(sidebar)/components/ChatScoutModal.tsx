"use client";

import styles from "@/app/(sidebar)/chat/components/ChatArea.module.scss";
import filterModalStyles from "@/components/FilterModal.module.scss";
import { Modal } from "@/components/Modal/Modal";
import { cn } from "@/lib/cn";
import Image from "next/image";
import { useEffect, useState } from "react";

type ScoutProject = {
  publicId: string;
  name: string;
  memberCount: number;
  maxMembers: number;
  availableRoles: { id: number; name: string }[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: number | null | undefined;
  onSubmitted?: () => void;
  /**
   * 利用コンテキスト
   * - "chat": チャット画面内（送信後はモーダルを閉じる）
   * - "external": チャット以外の画面（送信後は完了画面を表示）
   */
  mode?: "chat" | "external";
  /**
   * チャット欄にスカウトカードを送信する対象ルーム（省略時はチャットメッセージは作成しない）
   */
  roomPublicId?: string;
  /**
   * サーバーサイドなどで事前に取得したプロジェクト一覧（あればクライアントでのフェッチを省略）
   */
  initialProjects?: ScoutProject[];
};

export function ChatScoutModal({
  open,
  onOpenChange,
  targetUserId,
  onSubmitted,
  mode = "chat",
  roomPublicId,
  initialProjects,
}: Props) {
  const [projects, setProjects] = useState<ScoutProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(
    null,
  );
  const [completed, setCompleted] = useState(false);

  const isExternalMode = mode === "external";

  const resetState = () => {
    setProjects([]);
    setLoadingProjects(false);
    setProjectsError(null);
    setSelectedProjectId("");
    setSelectedRoleIds([]);
    setMessage("");
    setProcessing(false);
    setFeedbackMessage("");
    setFeedbackType(null);
    setCompleted(false);
  };

  const handleRootOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && processing) return;
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  };

  useEffect(() => {
    if (!open) return;
    if (!targetUserId) {
      setProjects([]);
      setProjectsError("スカウト対象ユーザーが指定されていません");
      return;
    }

    // サーバーサイドから initialProjects が渡されている場合はそれを優先的に利用
    if (initialProjects && initialProjects.length >= 0) {
      setProjects(initialProjects);
      setProjectsError(null);
      setLoadingProjects(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoadingProjects(true);
      setProjectsError(null);
      try {
        const res = await fetch(
          `/api/bewts/scout/projects?targetUserId=${targetUserId}`,
        );
        const data = await res.json().catch(() => []);
        if (cancelled) return;
        if (!res.ok) {
          const msg =
            (data && (data.error as string)) ||
            "スカウト可能なプロジェクト一覧の取得に失敗しました";
          setProjectsError(msg);
          setProjects([]);
          return;
        }
        const mapped: ScoutProject[] = (Array.isArray(data) ? data : []).map(
          (p) => ({
            publicId: p.publicId,
            name: p.name,
            memberCount: p.memberCount ?? 0,
            maxMembers: p.maxMembers ?? 0,
            availableRoles: Array.isArray(p.availableRoles)
              ? p.availableRoles
              : [],
          }),
        );
        setProjects(mapped);
        setProjectsError(null);
      } catch (err) {
        if (cancelled) return;
        console.error("failed to load scout projects", err);
        setProjectsError("スカウト可能なプロジェクト一覧の取得に失敗しました");
        setProjects([]);
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, targetUserId, initialProjects]);

  const handleSubmit = async () => {
    if (!targetUserId) {
      setFeedbackType("error");
      setFeedbackMessage("スカウト対象ユーザーが指定されていません");
      return;
    }

    if (!selectedProjectId) {
      setFeedbackType("error");
      setFeedbackMessage("スカウトするビューズプロジェクトを選択してください");
      return;
    }

    setProcessing(true);
    setFeedbackMessage("");
    setFeedbackType(null);

    const body: Record<string, unknown> = {
      projectPublicId: selectedProjectId,
      targetUserId,
      message: message.trim() || undefined,
      roleIds: selectedRoleIds.length > 0 ? selectedRoleIds : undefined,
    };

    try {
      const res = await fetch("/api/bewts/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          out?.error ||
          out?.details?.[0]?.message ||
          "スカウトの送信に失敗しました";
        setFeedbackType("error");
        setFeedbackMessage(msg as string);
        return;
      }

      const requestId =
        typeof out?.requestId === "number" ? out.requestId : undefined;

      if (roomPublicId && targetUserId) {
        try {
          const selected = projects.find(
            (p) => p.publicId === selectedProjectId,
          );
          const projectName = selected?.name ?? "ビューズプロジェクト";
          const selectedRoles = availableRoles.filter((r) =>
            selectedRoleIds.includes(r.id),
          );

          const escapeHtml = (text: string) =>
            text
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#39;");

          const parts: string[] = [];
          const headerAttrs = ['data-bewts-scout="1"'];
          if (typeof requestId === "number") {
            headerAttrs.push(`data-bewts-joinrequest-id="${requestId}"`);
            headerAttrs.push('data-bewts-scout-status="PENDING"');
            headerAttrs.push(
              `data-bewts-scout-updated-at="${new Date().toISOString()}"`,
            );
          }

          parts.push(
            `<p ${headerAttrs.join(" ")}><strong>スカウト</strong></p>`,
          );
          parts.push(`<p>プロジェクト：${escapeHtml(projectName)}</p>`);
          if (selectedRoles.length > 0) {
            parts.push(
              `<p>役割：${escapeHtml(
                selectedRoles.map((r) => r.name).join(" / "),
              )}</p>`,
            );
          }
          if (message.trim()) {
            const safeMessage = escapeHtml(message.trim()).replace(
              /\n/g,
              "<br/>",
            );
            parts.push("<p>メッセージ：</p>");
            parts.push(`<p>${safeMessage}</p>`);
          }

          const contentHtml = parts.join("");

          await fetch(`/api/chat/rooms/${roomPublicId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: contentHtml, attachments: [] }),
          }).catch((err) => {
            console.error("failed to create scout chat message", err);
          });
        } catch (err) {
          console.error("failed to create scout chat message", err);
        }
      }

      onSubmitted?.();

      if (isExternalMode) {
        setCompleted(true);
        setFeedbackMessage("");
        setFeedbackType(null);
        return;
      }

      setFeedbackType("success");
      setFeedbackMessage("スカウトを送信しました");
      resetState();
      onOpenChange(false);
    } catch (err) {
      console.error("scout create failed", err);
      setFeedbackType("error");
      setFeedbackMessage("スカウトの送信に失敗しました");
    } finally {
      setProcessing(false);
    }
  };

  // チャット以外からの利用時、送信完了後は完了画面を表示
  if (completed && isExternalMode) {
    return (
      <Modal
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && processing) return;
          if (!nextOpen) {
            resetState();
          }
          onOpenChange(nextOpen);
        }}
        title="スカウトが完了しました"
        description=""
        maxWidth="sm"
        showCloseButton={!processing}
        footer={
          <div className={styles.tipButtons}>
            <button
              type="button"
              className={cn(styles.tipBtn, styles.tipSubmit)}
              onClick={() => {
                if (!processing) {
                  resetState();
                  onOpenChange(false);
                }
              }}
              disabled={processing}
            >
              閉じる
            </button>
          </div>
        }
      >
        <div className={styles.orderCompleteBody}>
          <div className={styles.orderCompleteIconWrap}>
            <Image
              src="/images/check-outlined.png"
              alt="スカウト完了"
              width={160}
              height={160}
              className={styles.orderCompleteIcon}
            />
          </div>
          <h2 className={styles.orderCompleteTitle}>スカウトが完了しました</h2>
          <p className={styles.orderCompleteText}>
            通知からスカウト内容を確認できます。
          </p>
        </div>
      </Modal>
    );
  }

  const selectedProject = projects.find(
    (p) => p.publicId === selectedProjectId,
  );
  const availableRoles = selectedProject?.availableRoles ?? [];

  return (
    <Modal
      open={open}
      onOpenChange={handleRootOpenChange}
      title="スカウト"
      description="ビューズプロジェクトへの参加をスカウトします"
      maxWidth="sm"
      showCloseButton={!processing}
      footer={
        <div className={styles.tipButtons}>
          <button
            type="button"
            className={cn(styles.tipBtn, styles.tipCancel)}
            onClick={() => {
              if (!processing) {
                resetState();
                onOpenChange(false);
              }
            }}
            disabled={processing}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={cn(styles.tipBtn, styles.tipSubmit)}
            disabled={processing || !targetUserId}
            onClick={handleSubmit}
          >
            スカウト
          </button>
        </div>
      }
    >
      <div className={styles.tipRow}>
        <div className={styles.tipTitle}>ビューズプロジェクト</div>
        {loadingProjects ? (
          <div className={styles.tipMessage}>読み込み中です...</div>
        ) : projectsError ? (
          <div className={cn(styles.tipMessage, styles.tipError)}>
            {projectsError}
          </div>
        ) : projects.length === 0 ? (
          <div className={styles.tipMessage}>
            スカウト可能なビューズプロジェクトがありません。
          </div>
        ) : (
          <div className={styles.scoutProjectList}>
            {!selectedProjectId && (
              <div className={styles.scoutProjectHelperText}>
                プロジェクトを1つ選択してください
              </div>
            )}
            <div className={styles.scoutProjectItems}>
              {projects.map((p) => {
                const isSelected = selectedProjectId === p.publicId;
                const isFull =
                  p.maxMembers > 0 && p.memberCount >= p.maxMembers;

                return (
                  <button
                    key={p.publicId}
                    type="button"
                    className={cn(
                      styles.scoutProjectItem,
                      isSelected && styles.scoutProjectItemActive,
                    )}
                    onClick={() => {
                      const nextId = isSelected ? "" : p.publicId;
                      setSelectedProjectId(nextId);
                      setSelectedRoleIds([]);
                    }}
                    disabled={processing}
                  >
                    <div className={styles.scoutProjectItemHeader}>
                      <span className={styles.scoutProjectName}>{p.name}</span>
                      <span
                        className={cn(
                          styles.scoutProjectCapacity,
                          isFull && styles.scoutProjectCapacityFull,
                        )}
                      >
                        {p.memberCount}/{p.maxMembers}名
                      </span>
                    </div>
                    <div className={styles.scoutProjectMeta}>
                      <span className={styles.scoutProjectMetaText}>
                        選択可能な役割: {p.availableRoles.length}件
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {availableRoles.length > 0 && (
        <div className={styles.tipRow}>
          <div className={styles.tipTitle}>役割（任意・複数可）</div>
          <div className={filterModalStyles.chipRow}>
            <button
              type="button"
              className={cn(
                filterModalStyles.chipButton,
                selectedRoleIds.length === 0 &&
                  filterModalStyles.chipButtonActive,
              )}
              onClick={() => setSelectedRoleIds([])}
              disabled={processing}
            >
              <span>指定しない</span>
            </button>
            {availableRoles.map((r) => {
              const active = selectedRoleIds.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  className={cn(
                    filterModalStyles.chipButton,
                    active && filterModalStyles.chipButtonActive,
                  )}
                  onClick={() =>
                    setSelectedRoleIds((prev) =>
                      prev.includes(r.id)
                        ? prev.filter((id) => id !== r.id)
                        : [...prev, r.id],
                    )
                  }
                  disabled={processing}
                >
                  <span>{r.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.tipRow}>
        <div className={styles.tipTitle}>メッセージ（任意）</div>
        <textarea
          className={styles.tipInput}
          rows={4}
          placeholder="スカウトに添えるメッセージを入力してください"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={processing}
        />
      </div>

      {feedbackMessage && (
        <div
          className={cn(
            styles.tipMessage,
            feedbackType === "success" && styles.tipSuccess,
            feedbackType === "error" && styles.tipError,
          )}
        >
          {feedbackMessage}
        </div>
      )}
    </Modal>
  );
}
