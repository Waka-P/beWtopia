"use client";

import { cn } from "@/lib/cn";
import { fetcher } from "@/utils/fetcher";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useState } from "react";
import styles from "./EditorPanel.module.scss";

export type EditorTarget = "card" | "password" | "email" | null;

// Stripeオブジェクトはモジュールスコープで初期化して再利用する
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY as string,
);

const stripeAppearance = {
  theme: "flat" as const,
  variables: {
    colorPrimary: "#0ff",
    colorText: "#0ff",
    colorBackground: "#00091a",
    borderRadius: "0.25rem",
    spacing4: "0",
  },
  rules: {
    ".Input": {
      "--gradient-angle": "135deg",
      width: "100%",
      margin: "0.5rem 0 0.7rem 0",
      padding: "0.5rem 0.75rem",
      textAlign: "left",
      border: "1.9px solid #0ff7",
      borderRadius: "0.25rem",
      transition: "--gradient-angle 0.5s ease",
      outline: "none",
      color: "white",
    },
    ".Input::placeholder": {
      color: "#434c4c",
    },
  },
} as const;

type EditorPanelProps = {
  editTarget: EditorTarget;
  registeredEmail: string;
  nextEmail: string;
  onNextEmailChange: (email: string) => void;
  onSaveEmail: (nextEmail: string) => Promise<void> | void;
  onSavePassword: (values: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<void> | void;
  onCancel: () => void;
  isSavingEmail?: boolean;
  isSavingPassword?: boolean;
  onCardSaved?: () => void;
};

export default function EditorPanel({
  editTarget,
  registeredEmail,
  nextEmail,
  onNextEmailChange,
  onSaveEmail,
  onSavePassword,
  onCancel,
  isSavingEmail = false,
  isSavingPassword = false,
  onCardSaved,
}: EditorPanelProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  if (editTarget === null) {
    return null;
  }

  if (editTarget === "card") {
    return <CardEditor onCancel={onCancel} onSaved={onCardSaved} />;
  }

  if (editTarget === "password") {
    return (
      <div key="password" className={styles.editorPanel}>
        <h3 className={styles.editorHeader}>パスワード変更</h3>

        <div className={styles.formRow}>
          <label htmlFor="current-password">現在のパスワード</label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>

        <div className={styles.formRow}>
          <label htmlFor="new-password">新しいパスワード</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <div className={styles.formRow}>
          <label htmlFor="confirm-password">新しいパスワード(確認)</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={onCancel}
            disabled={isSavingPassword}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() =>
              void onSavePassword({
                currentPassword,
                newPassword,
                confirmPassword,
              })
            }
            disabled={isSavingPassword}
          >
            {isSavingPassword ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div key="email" className={styles.editorPanel}>
      <h3 className={styles.editorHeader}>メールアドレス変更</h3>

      <div className={styles.formRow}>
        <label htmlFor="email-address">現在のメール</label>
        <input
          id="email-address"
          type="email"
          value={registeredEmail}
          readOnly
          disabled
        />
      </div>

      <div className={styles.formRow}>
        <label htmlFor="new-email-address">変更後のメール</label>
        <input
          id="new-email-address"
          type="email"
          value={nextEmail}
          onChange={(e) => onNextEmailChange(e.target.value)}
        />
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={onCancel}
          disabled={isSavingEmail}
        >
          キャンセル
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => void onSaveEmail(nextEmail)}
          disabled={isSavingEmail}
        >
          {isSavingEmail ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}

function CardEditor({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved?: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    void fetcher<{ clientSecret?: string }>("/api/stripe/setup-intent", {
      method: "POST",
    })
      .then((res) => setClientSecret(res?.clientSecret ?? null))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div key="card" className={styles.editorPanel}>
      <h3 className={styles.editorHeader}>クレジットカード情報</h3>
      {loading && (
        <div className={styles.cardSkeletonWrapper} aria-hidden>
          <div
            className={cn(
              styles.cardSkeletonLine,
              styles.cardSkeletonLineLabel,
            )}
          />
          <div
            className={cn(
              styles.cardSkeletonLine,
              styles.cardSkeletonLineField,
            )}
          />
          <div className={styles.cardSkeletonFieldRow}>
            <div
              className={cn(
                styles.cardSkeletonLine,
                styles.cardSkeletonLineFieldHalf,
              )}
            />
            <div
              className={cn(
                styles.cardSkeletonLine,
                styles.cardSkeletonLineFieldHalf,
              )}
            />
          </div>
          <div
            className={cn(
              styles.cardSkeletonLine,
              styles.cardSkeletonLineHelper,
            )}
          />
        </div>
      )}
      {clientSecret && stripePromise && (
        <Elements
          stripe={stripePromise}
          options={{ clientSecret, appearance: stripeAppearance }}
        >
          <CardEditorForm
            onCancel={onCancel}
            setMessage={setMessage}
            onSaved={onSaved}
          />
        </Elements>
      )}
      {message && (
        <p
          style={{
            marginTop: 8,
            color: message === "カードを保存しました" ? "#0a0" : "#c00",
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}

function CardEditorForm({
  onCancel,
  setMessage,
  onSaved,
}: {
  onCancel: () => void;
  setMessage: (m: string | null) => void;
  onSaved?: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);

  const onSaveCard = async () => {
    if (!stripe || !elements) return;
    setSaving(true);
    setMessage(null);
    const { setupIntent, error } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });
    if (error) {
      setMessage(error.message || "カードの保存に失敗しました");
      setSaving(false);
      return;
    }
    const pmId = setupIntent?.payment_method;
    const id = typeof pmId === "string" ? pmId : undefined;
    if (!id) {
      setMessage("保存された支払い方法が取得できませんでした");
      setSaving(false);
      return;
    }
    // デフォルトカードとして設定
    try {
      const res = await fetcher<{ ok: boolean }>(
        "/api/stripe/set-default-payment-method",
        {
          method: "POST",
          body: JSON.stringify({ paymentMethodId: id }),
        },
      );
      if (res?.ok) {
        setMessage("カードを保存しました");
        onSaved?.();
      } else {
        setMessage("カードの保存設定に失敗しました");
      }
    } catch {
      setMessage("カードの保存設定に失敗しました");
    }
    setSaving(false);
  };

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <div className={styles.formRow}>
        <PaymentElement />
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.btnGhost} onClick={onCancel}>
          キャンセル
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onSaveCard}
          disabled={!stripe || saving}
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </form>
  );
}
