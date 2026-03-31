"use client";

import { useTabIndicator } from "@/app/(sidebar)/components/useTabIndicator";
import { ErrorModal } from "@/components/ErrorModal";
import { cn } from "@/lib/cn";
import type { CoinHistoryItem } from "@/lib/wcoin";
import Image from "next/image";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import styles from "./page.module.scss";

type WcoinTabType = "charge" | "history";

const TABS: { id: WcoinTabType; label: string }[] = [
  { id: "charge", label: "チャージ" },
  { id: "history", label: "取引履歴" },
];

type Props = {
  initialBalance: number;
  initialHistory: CoinHistoryItem[];
  initialSavedCardAvailable: boolean;
};

const QUICK_CHARGE_AMOUNTS = [500, 1000, 3000, 5000] as const;

function formatDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}/${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")} ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

export function WcoinClient({
  initialBalance,
  initialHistory,
  initialSavedCardAvailable,
}: Props) {
  const [coins, setCoins] = useState<number>(0);
  const [coinInput, setCoinInput] = useState<string>("");
  const [balance, setBalance] = useState<number>(initialBalance);
  const [history, setHistory] = useState<CoinHistoryItem[]>(initialHistory);
  const [savedCardAvailable] = useState<boolean>(initialSavedCardAvailable);
  const [activeTab, setActiveTab] = useState<WcoinTabType>("charge");
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"error" | null>(null);
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);
  const [completeOverlayFadingOut, setCompleteOverlayFadingOut] =
    useState(false);
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const { tabbedRef, indicatorRef } = useTabIndicator<WcoinTabType>(activeTab);

  const runCompleteOverlay = () => {
    if (fadeOutTimerRef.current) {
      clearTimeout(fadeOutTimerRef.current);
      fadeOutTimerRef.current = null;
    }
    if (hideOverlayTimerRef.current) {
      clearTimeout(hideOverlayTimerRef.current);
      hideOverlayTimerRef.current = null;
    }

    setCompleteOverlayFadingOut(false);
    setShowCompleteOverlay(true);

    fadeOutTimerRef.current = setTimeout(() => {
      setCompleteOverlayFadingOut(true);
    }, 2200);

    hideOverlayTimerRef.current = setTimeout(() => {
      setShowCompleteOverlay(false);
      setCompleteOverlayFadingOut(false);
    }, 3000);
  };

  const showErrorModal = (errorMessage: string) => {
    setErrorModal({
      title: "チャージに失敗しました",
      message: errorMessage,
    });
  };

  useEffect(() => {
    return () => {
      if (fadeOutTimerRef.current) {
        clearTimeout(fadeOutTimerRef.current);
      }
      if (hideOverlayTimerRef.current) {
        clearTimeout(hideOverlayTimerRef.current);
      }
    };
  }, []);

  const reloadBalanceAndHistory = async () => {
    try {
      const [balanceRes, historyRes] = await Promise.all([
        fetch("/api/wcoin/balance"),
        fetch("/api/wcoin/history?all=1"),
      ]);

      const balanceData = await balanceRes.json().catch(() => ({}));
      setBalance(Number(balanceData?.coinBalance ?? 0));

      const historyData = await historyRes.json().catch(() => ({}));
      if (Array.isArray(historyData?.items)) {
        setHistory(historyData.items as CoinHistoryItem[]);
      }
    } catch {
      // ignore
    }
  };

  const onSubmit = async () => {
    if (!Number.isInteger(coins) || coins <= 0) {
      setMessageType("error");
      setMessage("チャージするコイン数を入力してください");
      return;
    }
    setProcessing(true);
    setMessage("");
    setMessageType(null);
    try {
      const res = await fetch("/api/wcoin/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coins,
          useSavedCard: savedCardAvailable,
          confirmNow: savedCardAvailable,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          (data?.error as string | undefined) ?? "チャージに失敗しました";
        setMessageType("error");
        setMessage(msg);
        showErrorModal(msg);
        return;
      }

      if (data?.status === "succeeded") {
        const fin = await fetch("/api/wcoin/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: data?.paymentIntentId }),
        });
        const finData = await fin.json().catch(() => ({}));
        if (fin.ok && finData?.ok) {
          setMessageType(null);
          setMessage("");
          runCompleteOverlay();
          await reloadBalanceAndHistory();
        } else {
          const errMsg =
            "チャージの確定に失敗しました（時間をおいて再試行してください）";
          setMessageType("error");
          setMessage(errMsg);
          showErrorModal(errMsg);
        }
        return;
      }

      if (data?.clientSecret) {
        try {
          const { loadStripe } = await import("@stripe/stripe-js");
          const stripe = await loadStripe(
            process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY as string,
          );
          if (!stripe) throw new Error("Stripe初期化に失敗しました");
          const result = await stripe.confirmCardPayment(data.clientSecret);
          if (result.error) {
            console.error(result.error);
            const errMsg =
              "カード認証に失敗しました。設定画面でカードを更新してください。";
            setMessageType("error");
            setMessage(errMsg);
            showErrorModal(errMsg);
            return;
          }
          if (
            result.paymentIntent &&
            result.paymentIntent.status === "succeeded"
          ) {
            const fin = await fetch("/api/wcoin/finalize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentIntentId: result.paymentIntent.id,
              }),
            });
            const finData = await fin.json().catch(() => ({}));
            if (fin.ok && finData?.ok) {
              setMessageType(null);
              setMessage("");
              runCompleteOverlay();
              await reloadBalanceAndHistory();
            } else {
              const errMsg =
                "チャージの確定に失敗しました（時間をおいて再試行してください）";
              setMessageType("error");
              setMessage(errMsg);
              showErrorModal(errMsg);
            }
            return;
          }
          const errMsg =
            "認証が完了しませんでした。時間をおいて再度お試しください。";
          setMessageType("error");
          setMessage(errMsg);
          showErrorModal(errMsg);
        } catch (err) {
          console.error("confirmCardPayment error", err);
          const errMsg =
            "認証フローの実行に失敗しました。時間をおいて再度お試しください。";
          setMessageType("error");
          setMessage(errMsg);
          showErrorModal(errMsg);
        }
      } else {
        const errMsg = "チャージ処理を完了できませんでした";
        setMessageType("error");
        setMessage(errMsg);
        showErrorModal(errMsg);
      }
    } finally {
      setProcessing(false);
    }
  };

  const onChangeCoins = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value || "";
    const digitsOnly = raw.replace(/\D/g, "");
    const sanitized = digitsOnly.replace(/^0+(?=\d)/, "");
    setCoinInput(sanitized);
    setCoins(sanitized ? Number(sanitized) : 0);
  };

  const selectedCoins = Number.isInteger(coins) && coins > 0 ? coins : 0;
  const projectedBalance = balance + selectedCoins;
  const latestHistoryDate =
    history.length > 0 ? formatDateTime(history[0].createdAt) : "-";

  return (
    <div className={styles.container}>
      <h2 className={styles.pageTitle}>
        <ruby>
          W<rt>ビュー</rt>
        </ruby>
        コイン管理
      </h2>

      <div className={styles.tabArea}>
        <div className={styles.tabTop}>
          <div ref={tabbedRef} className={styles.tabbed}>
            <div ref={indicatorRef} className={styles.tabbedIndicator} />

            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  styles.tabBtn,
                  activeTab === tab.id && styles.activeTab,
                )}
                data-tab={tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === "charge" && (
        <div className={styles.panel}>
          <p className={styles.desc}>
            ¥&nbsp;1&nbsp;&nbsp;=&nbsp;&nbsp;1&nbsp;W&nbsp;&nbsp;&nbsp;としてチャージします。
          </p>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>現在の残高</div>
              <div className={styles.summaryValue}>
                {balance.toLocaleString()}
                <span>W</span>
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>チャージ後</div>
              <div className={styles.summaryValue}>
                {projectedBalance.toLocaleString()}
                <span>W</span>
              </div>
            </div>
          </div>

          <div className={styles.row}>
            <input
              className={styles.input}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={coinInput}
              onChange={onChangeCoins}
              placeholder="チャージするコイン数"
            />
            <button
              className={styles.button}
              type="button"
              onClick={onSubmit}
              disabled={processing}
            >
              {processing ? "処理中..." : "チャージ"}
            </button>
          </div>

          <div className={styles.quickRow}>
            {QUICK_CHARGE_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                className={styles.quickButton}
                onClick={() => {
                  const str = String(amount);
                  setCoinInput(str);
                  setCoins(amount);
                }}
              >
                +{amount.toLocaleString()}W
              </button>
            ))}
          </div>

          {message && (
            <div
              className={cn(
                styles.message,
                messageType === "error" && styles.error,
              )}
            >
              {message}
            </div>
          )}
          <div
            className={cn(
              styles.status,
              savedCardAvailable ? styles.hasCard : styles.noCard,
            )}
          >
            {savedCardAvailable
              ? "保存済みのカードが利用できます"
              : "設定からクレジットカードを登録してください"}
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className={cn(styles.panel, styles.history)}>
          <div className={styles.historyMeta}>
            <span>件数：{history.length}件</span>
            <span>最新：{latestHistoryDate}</span>
          </div>
          {history.length === 0 ? (
            <div className={styles.historyEmpty}>
              取引履歴はまだありません。
            </div>
          ) : (
            <ul className={styles.historyList}>
              {history.map((tx) => {
                const isIncoming = tx.direction
                  ? tx.direction === "in"
                  : tx.senderUserId === null;
                const sign = isIncoming ? "+" : "-";
                const amountStr = `${sign}${tx.amount.toLocaleString()} W`;
                const dateStr = formatDateTime(tx.createdAt);
                return (
                  <li key={tx.id} className={styles.historyItem}>
                    <span className={styles.historyDate}>{dateStr}</span>
                    <span className={styles.historyLabel}>
                      {tx.label ?? (isIncoming ? "受け取り" : "支払い")}
                    </span>
                    <span
                      className={cn(
                        styles.historyAmount,
                        isIncoming ? styles.incoming : styles.outgoing,
                      )}
                    >
                      {amountStr}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {showCompleteOverlay && (
        <div
          className={cn(
            styles.chargeCompleteOverlay,
            completeOverlayFadingOut ? styles.fadeOut : styles.fadeIn,
          )}
          aria-live="polite"
        >
          <div className={styles.chargeCompleteCard}>
            <div className={styles.chargeCompleteIconWrap}>
              <Image
                src="/images/check-outlined.png"
                alt="チャージ完了"
                width={160}
                height={160}
                className={styles.chargeCompleteIcon}
              />
            </div>
            <h2 className={styles.chargeCompleteTitle}>
              チャージが完了しました
            </h2>
          </div>
        </div>
      )}

      <ErrorModal
        open={Boolean(errorModal)}
        onClose={() => setErrorModal(null)}
        title={errorModal?.title ?? ""}
        message={errorModal?.message ?? ""}
      />
    </div>
  );
}
