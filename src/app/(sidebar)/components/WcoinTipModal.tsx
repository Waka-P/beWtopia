"use client";

import styles from "@/app/(sidebar)/users/[publicId]/page.module.scss";
import { Modal } from "@/components/Modal/Modal";
import { cn } from "@/lib/cn";
import { useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiverUserId: number;
};

export function WcoinTipModal({ open, onOpenChange, receiverUserId }: Props) {
  const [tipInput, setTipInput] = useState("");
  const [tipAmount, setTipAmount] = useState(0);
  const [tipProcessing, setTipProcessing] = useState(false);
  const [tipMessage, setTipMessage] = useState("");
  const [tipMessageType, setTipMessageType] = useState<
    "success" | "error" | null
  >(null);
  const [myBalance, setMyBalance] = useState<number | null>(null);

  const handleRootOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && tipProcessing) return;
    onOpenChange(nextOpen);
  };

  const ensureBalanceLoaded = () => {
    if (myBalance != null) return;
    void fetch("/api/wcoin/balance")
      .then(async (res) => res.json().catch(() => ({})))
      .then((d) => setMyBalance(Number(d?.coinBalance ?? 0)))
      .catch(() => {});
  };

  const handleSubmit = async () => {
    if (tipAmount <= 0) {
      setTipMessageType("error");
      setTipMessage("コイン数を入力してください");
      return;
    }

    setTipProcessing(true);
    setTipMessage("");
    setTipMessageType(null);

    try {
      const res = await fetch("/api/wcoin/tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverUserId,
          amount: tipAmount,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out?.ok) {
        const code = out?.error as string | undefined;
        const msg =
          code === "INSUFFICIENT_FUNDS"
            ? "残高が不足しています"
            : code === "CANNOT_TIP_SELF"
              ? "自分自身への投げ銭はできません"
              : "投げ銭に失敗しました";
        setTipMessageType("error");
        setTipMessage(msg);
        return;
      }
      setTipMessageType("success");
      setTipMessage("投げ銭が完了しました");
      // Update my balance
      if (typeof out.newBalance === "number") {
        setMyBalance(out.newBalance);
      } else {
        ensureBalanceLoaded();
      }
    } catch (err) {
      console.error("tip failed", err);
      setTipMessageType("error");
      setTipMessage("投げ銭の実行に失敗しました");
    } finally {
      setTipProcessing(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleRootOpenChange}
      title="Wコインで投げ銭"
      description="ユーザーにWコインを送ります"
      maxWidth="sm"
      showCloseButton={!tipProcessing}
      footer={
        <div className={styles.tipButtons}>
          <button
            type="button"
            className={cn(styles.tipBtn, styles.tipCancel)}
            onClick={() => {
              if (!tipProcessing) {
                onOpenChange(false);
              }
            }}
            disabled={tipProcessing}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={cn(styles.tipBtn, styles.tipSubmit)}
            disabled={tipProcessing || tipAmount <= 0}
            onClick={handleSubmit}
          >
            送る
          </button>
        </div>
      }
    >
      <div className={styles.tipBalance}>
        あなたの残高:{" "}
        {myBalance != null
          ? `${myBalance.toLocaleString()} W`
          : "読み込み中..."}
      </div>
      <div className={styles.tipRow}>
        <input
          className={styles.tipInput}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="投げ銭するコイン数"
          value={tipInput}
          onFocus={ensureBalanceLoaded}
          onChange={(e) => {
            const raw = e.target.value || "";
            const digits = raw.replace(/\D/g, "");
            const sanitized = digits.replace(/^0+(?=\d)/, "");
            setTipInput(sanitized);
            setTipAmount(sanitized ? Number(sanitized) : 0);
          }}
        />
      </div>
      {tipMessage && (
        <div
          className={cn(
            styles.tipMessage,
            tipMessageType === "success" && styles.tipSuccess,
            tipMessageType === "error" && styles.tipError,
          )}
        >
          {tipMessage}
        </div>
      )}
    </Modal>
  );
}
