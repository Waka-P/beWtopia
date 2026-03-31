"use client";

import styles from "@/app/(sidebar)/chat/components/ChatArea.module.scss";
import filterModalStyles from "@/components/FilterModal.module.scss";
import { Modal } from "@/components/Modal/Modal";
import { cn } from "@/lib/cn";
import Image from "next/image";
import { useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomPublicId: string;
  onSubmitted?: () => void;
  /**
   * 利用コンテキスト
   * - "chat": チャット画面内（従来通り、送信後はモーダルを閉じてメッセージ一覧を更新する）
   * - "external": ユーザ詳細などチャット以外の画面（送信後はその場で完了画面を表示する）
   */
  mode?: "chat" | "external";
};

export function ChatOrderModal({
  open,
  onOpenChange,
  roomPublicId,
  onSubmitted,
  mode = "chat",
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [priceUnit, setPriceUnit] = useState<"YEN" | "W" | "BOTH">("BOTH");
  const [deadline, setDeadline] = useState("");
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | null>(
    null,
  );
  const [completed, setCompleted] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleRootOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && processing) return;
    onOpenChange(nextOpen);
  };

  const resetState = () => {
    setTitle("");
    setDescription("");
    setPriceInput("");
    setPriceUnit("BOTH");
    setDeadline("");
    setMessage("");
    setMessageType(null);
    setCompleted(false);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      setMessageType("error");
      setMessage("タイトルと内容を入力してください");
      return;
    }

    // 希望納期のバリデーション（年は4桁・過去日は不可）
    if (deadline) {
      const match = deadline.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) {
        setMessageType("error");
        setMessage("希望納期は YYYY-MM-DD 形式（年は4桁）で入力してください");
        return;
      }

      const selected = new Date(deadline);
      if (Number.isNaN(selected.getTime())) {
        setMessageType("error");
        setMessage("希望納期の日付が正しくありません");
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selected.setHours(0, 0, 0, 0);

      if (selected < today) {
        setMessageType("error");
        setMessage("過去の日付は希望納期に指定できません");
        return;
      }
    }

    setProcessing(true);
    setMessage("");
    setMessageType(null);

    const price = priceInput
      ? Number(priceInput.replace(/[^0-9]/g, "")) || null
      : null;

    const body: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      price,
      priceUnit,
      deadline: deadline || null,
    };

    try {
      const res = await fetch(`/api/chat/rooms/${roomPublicId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          out?.details?.[0]?.message ||
          out?.error ||
          "オーダーの送信に失敗しました";
        setMessageType("error");
        setMessage(msg);
        return;
      }

      if (mode === "external") {
        // チャット以外からのオーダー: その場で完了画面に切り替える
        setCompleted(true);
        setMessage("");
        setMessageType(null);
        onSubmitted?.();
        return;
      }

      // チャット画面からのオーダー: 従来通りメッセージだけ表示して閉じる
      setMessageType("success");
      setMessage("オーダーを送信しました");
      onSubmitted?.();
      resetState();
      onOpenChange(false);
    } catch (err) {
      console.error("order create failed", err);
      setMessageType("error");
      setMessage("オーダーの送信に失敗しました");
    } finally {
      setProcessing(false);
    }
  };

  const isExternalMode = mode === "external";

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
        title="オーダーが完了しました"
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
              alt="オーダー完了"
              width={160}
              height={160}
              className={styles.orderCompleteIcon}
            />
          </div>
          <h2 className={styles.orderCompleteTitle}>オーダーが完了しました</h2>
          <p className={styles.orderCompleteText}>
            チャット画面からオーダー内容を確認できます。
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleRootOpenChange}
      title="オーダー"
      description="チャットの相手に作ってほしいアプリの内容を入力してください"
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
            disabled={processing}
            onClick={handleSubmit}
          >
            オーダー
          </button>
        </div>
      }
    >
      <div className={styles.tipRow}>
        <div className={styles.tipTitle}>タイトル</div>
        <input
          className={styles.tipInput}
          type="text"
          placeholder="タイトル（必須）"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className={styles.tipRow}>
        <div className={styles.tipTitle}>内容</div>
        <textarea
          className={styles.tipInput}
          placeholder="内容（必須）"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
        />
      </div>
      <div className={styles.tipRow}>
        <div className={styles.tipTitle}>希望金額</div>
        <div className={styles.tipAmountRow}>
          <input
            className={styles.tipInput}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="希望金額"
            value={priceInput}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, "");
              setPriceInput(digits);
            }}
          />
          <div className={filterModalStyles.chipRow}>
            <button
              type="button"
              className={cn(
                filterModalStyles.chipButton,
                priceUnit === "BOTH" && filterModalStyles.chipButtonActive,
              )}
              onClick={() => setPriceUnit("BOTH")}
            >
              <span>円 / W</span>
            </button>
            <button
              type="button"
              className={cn(
                filterModalStyles.chipButton,
                priceUnit === "YEN" && filterModalStyles.chipButtonActive,
              )}
              onClick={() => setPriceUnit("YEN")}
            >
              <span>円</span>
            </button>
            <button
              type="button"
              className={cn(
                filterModalStyles.chipButton,
                priceUnit === "W" && filterModalStyles.chipButtonActive,
              )}
              onClick={() => setPriceUnit("W")}
            >
              <span>W</span>
            </button>
          </div>
        </div>
      </div>
      <div className={styles.tipRow}>
        <div className={styles.tipTitle}>希望納期</div>
        <input
          className={styles.tipInput}
          type="date"
          min={todayStr}
          max="9999-12-31"
          placeholder="希望納期（任意）"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
        <div className={styles.tipDeadlinePresets}>
          <button
            type="button"
            className={styles.tipDeadlineBtn}
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 7);
              const iso = d.toISOString().slice(0, 10);
              setDeadline(iso);
            }}
          >
            1週間後
          </button>
          <button
            type="button"
            className={styles.tipDeadlineBtn}
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 14);
              const iso = d.toISOString().slice(0, 10);
              setDeadline(iso);
            }}
          >
            2週間後
          </button>
          <button
            type="button"
            className={styles.tipDeadlineBtn}
            onClick={() => {
              const d = new Date();
              d.setMonth(d.getMonth() + 1);
              const iso = d.toISOString().slice(0, 10);
              setDeadline(iso);
            }}
          >
            1か月後
          </button>
        </div>
      </div>
      {message && (
        <div
          className={cn(
            styles.tipMessage,
            messageType === "success" && styles.tipSuccess,
            messageType === "error" && styles.tipError,
          )}
        >
          {message}
        </div>
      )}
    </Modal>
  );
}
