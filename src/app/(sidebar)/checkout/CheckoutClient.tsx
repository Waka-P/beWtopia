"use client";
import { ErrorModal } from "@/components/ErrorModal";
import { cn } from "@/lib/cn";
import { fetcher } from "@/utils/fetcher";
import { removeLocalStorage, setLocalStorage } from "@/utils/localStorage";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "../cart/page.module.scss";
import type { CartItem, PurchaseOption } from "./page";
import checkoutStyles from "./page.module.scss";

type PaymentMethod = "Wコイン" | "カード";

type PaymentIntentResult = {
  status?: string;
  clientSecret?: string;
};

type SubscriptionResponse = {
  ok?: boolean;
  status?: string;
  error?: string;
  clientSecret?: string;
  message?: string;
};

type WcoinCheckoutResponse = {
  ok?: boolean;
  newBalance?: number;
  skippedCartItemIds?: number[];
};

function formatPrice(option: PurchaseOption, price?: number | null) {
  if (!price && price !== 0) return "";
  const formatted = price.toLocaleString();
  return option === "サブスク" ? `¥${formatted}/月` : `¥${formatted}`;
}

type Props = {
  initialItems: CartItem[];
};

export default function CheckoutClient({ initialItems }: Props) {
  const router = useRouter();
  const [items] = useState<CartItem[]>(initialItems);
  const [paymentSelections, setPaymentSelections] = useState<
    Record<number, PaymentMethod>
  >(() => {
    const init: Record<number, PaymentMethod> = {};
    for (const item of initialItems) {
      // デフォルトはWコインが可能ならWコイン、不可ならカード
      init[item.id] = item.supportsWcoin ? "Wコイン" : "カード";
    }
    return init;
  });
  const [paymentOpenIds, setPaymentOpenIds] = useState<Set<number>>(new Set());

  const { subtotalBuy, subtotalSub } = useMemo(() => {
    let buy = 0;
    let sub = 0;

    for (const item of items) {
      if (item.selectable) {
        if (item.selected === "買い切り" && item.buyPrice) buy += item.buyPrice;
        if (item.selected === "サブスク" && item.subPrice) sub += item.subPrice;
      } else {
        if (item.selected === "買い切り" && item.fixedPrice)
          buy += item.fixedPrice;
        if (item.selected === "サブスク" && item.fixedPrice)
          sub += item.fixedPrice;
      }
    }

    return { subtotalBuy: buy, subtotalSub: sub };
  }, [items]);

  const sum = subtotalBuy + subtotalSub;

  const [isLoadingIntent, setIsLoadingIntent] = useState(false);
  const [isStartingSub, setIsStartingSub] = useState(false);
  const [isProcessingMixed, setIsProcessingMixed] = useState(false);
  const [savedCardAvailable, setSavedCardAvailable] = useState(false);
  const [, setCoinBalance] = useState<number | null>(null);
  const [wcoinErrorModalOpen, setWcoinErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showErrorModal = (message: string) => {
    setErrorMessage(message);
  };

  const completePurchase = (skippedNames?: string[]) => {
    if (typeof window === "undefined") return;
    const skippedSet = new Set(skippedNames ?? []);

    // 保存：購入できなかったアプリ名（Wコイン不足など）
    if (skippedNames && skippedNames.length > 0) {
      try {
        const unique = Array.from(new Set(skippedNames));
        setLocalStorage("bew_wcoin_skipped_apps", unique);
      } catch {
        // ignore storage errors
      }
    } else {
      try {
        removeLocalStorage("bew_wcoin_skipped_apps");
      } catch {
        // ignore storage errors
      }
    }

    // 保存：購入済みアプリの publicId（完了ページで自動ダウンロードを実行するため）
    try {
      const purchased = items
        .filter((it) => !skippedSet.has(it.name))
        .map((it) => it.appPublicId)
        .filter(Boolean);
      if (purchased.length > 0) {
        setLocalStorage("bew_purchased_apps", Array.from(new Set(purchased)));
      } else {
        removeLocalStorage("bew_purchased_apps");
      }
    } catch {
      // ignore storage errors
    }

    const purchasedItems = items.filter((it) => !skippedSet.has(it.name));
    const isSubscriptionOnly =
      purchasedItems.length > 0 &&
      purchasedItems.every((it) => it.selected === "サブスク");

    window.location.href = isSubscriptionOnly
      ? "/checkout/complete?subscriptionOnly=1"
      : "/checkout/complete";
  };

  useEffect(() => {
    void fetcher<{ hasDefault?: boolean }>("/api/stripe/customer")
      .then((res) => setSavedCardAvailable(!!res?.hasDefault))
      .catch(() => setSavedCardAvailable(false));

    // 自分のWコイン残高
    void fetch("/api/wcoin/balance")
      .then(async (res) => res.json().catch(() => ({})))
      .then((data) => setCoinBalance(Number(data?.coinBalance ?? 0)))
      .catch(() => setCoinBalance(null));
  }, []);

  const handleBack = () => {
    router.back();
  };

  const canUseWcoin = (item: CartItem) => item.supportsWcoin;
  const canUseCard = (item: CartItem) => item.supportsCard;

  const handleTogglePaymentOption = (
    id: number,
    opt: PaymentMethod,
    item: CartItem,
  ) => {
    if (canUseWcoin(item) && canUseCard(item)) {
      if (paymentOpenIds.has(id)) {
        setPaymentSelections((prev: Record<number, PaymentMethod>) => ({
          ...prev,
          [id]: opt,
        }));
        setPaymentOpenIds((prev: Set<number>) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        setPaymentOpenIds((prev: Set<number>) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }
    }
  };

  const startSubscription = async () => {
    const target = items
      .filter((i: CartItem) => i.selected === "サブスク")
      .filter((i: CartItem) => (i.selectable ? i.subPrice : i.fixedPrice));
    if (target.length === 0) {
      showErrorModal("対象商品が見つかりません");
      return;
    }
    const payload = {
      items: target.map((i: CartItem) => ({
        cartItemId: i.id,
        option: "サブスク" as const,
      })),
    };
    setIsStartingSub(true);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        completePurchase();
        return;
      }
      const requiresAction =
        data?.status === "requires_action" ||
        data?.error === "REQUIRES_ACTION_OR_FAILED";
      if (requiresAction && data?.clientSecret) {
        try {
          const { loadStripe } = await import("@stripe/stripe-js");
          const stripe = await loadStripe(
            process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY as string,
          );
          if (!stripe) throw new Error("Stripeの初期化に失敗しました");
          const result = await stripe.confirmCardPayment(data.clientSecret);
          if (result.error) {
            console.error(result.error);
            showErrorModal(
              "認証に失敗しました。カード情報を更新して再度お試しください。",
            );
          } else if (
            result.paymentIntent &&
            result.paymentIntent.status === "succeeded"
          ) {
            // 認証成功後に購入確定APIを呼び出し
            try {
              const finalizeRes = await fetch("/api/subscription/finalize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  paymentIntentId: result.paymentIntent.id,
                }),
              });
              const finalizeData = await finalizeRes.json().catch(() => ({}));
              if (finalizeRes.ok && finalizeData?.ok) {
                completePurchase();
                return;
              }
              showErrorModal(
                "購入の確定に失敗しました。時間をおいて再度お試しください。",
              );
            } catch (fe) {
              console.error("Finalize error", fe);
              showErrorModal(
                "購入確定処理でエラーが発生しました。時間をおいて再度お試しください。",
              );
            }
          } else {
            showErrorModal(
              "認証が完了しませんでした。時間をおいて再度お試しください。",
            );
          }
        } catch (err) {
          console.error("confirmCardPayment error", err);
          showErrorModal(
            "認証フローの実行に失敗しました。時間をおいて再度お試しください。",
          );
        }
      } else {
        const message =
          (data?.message as string | undefined) ??
          "サブスク開始に失敗しました。設定画面でカードを更新し、再度お試しください。";
        showErrorModal(message);
      }
    } catch (e: unknown) {
      console.error("Failed to create subscription", e);
      const msg = e instanceof Error ? e.message : "不明なエラー";
      showErrorModal(`サブスク開始時にエラーが発生しました: ${msg}`);
    } finally {
      setIsStartingSub(false);
    }
  };

  const processMixedCheckout = async () => {
    if (!savedCardAvailable) {
      showErrorModal("設定画面でカードを登録してください");
      return;
    }
    const buyTargets = items
      .filter((i: CartItem) => i.selected === "買い切り")
      .filter((i: CartItem) => (i.selectable ? i.buyPrice : i.fixedPrice))
      .filter(
        (i: CartItem) =>
          canUseCard(i) &&
          (!canUseWcoin(i) || paymentSelections[i.id] === "カード"),
      );
    const subTargets = items
      .filter((i: CartItem) => i.selected === "サブスク")
      .filter((i: CartItem) => (i.selectable ? i.subPrice : i.fixedPrice))
      .filter(
        (i: CartItem) =>
          canUseCard(i) &&
          (!canUseWcoin(i) || paymentSelections[i.id] === "カード"),
      );
    if (buyTargets.length === 0 || subTargets.length === 0) {
      showErrorModal("買い切りとサブスクの両方を含む必要があります");
      return;
    }

    setIsProcessingMixed(true);
    try {
      // 1. 買い切り（保存カードで即時決済）
      const buyPayload = {
        items: buyTargets.map((i: CartItem) => ({
          cartItemId: i.id,
          option: "買い切り" as const,
        })),
        useSavedCard: true,
        confirmNow: true,
      };
      let buyRes: PaymentIntentResult | null = null;
      try {
        buyRes = await fetcher<PaymentIntentResult>("/api/payment-intent", {
          method: "POST",
          body: JSON.stringify(buyPayload),
        });
      } catch (e: unknown) {
        console.error("Buy intent error", e);
        const msg = e instanceof Error ? e.message : "不明なエラー";
        showErrorModal(`買い切りの支払いに失敗しました: ${msg}`);
        return;
      }
      if (buyRes?.status !== "succeeded") {
        // 追加認証が必要な場合は実施
        if (buyRes?.status === "requires_action" && buyRes?.clientSecret) {
          try {
            const { loadStripe } = await import("@stripe/stripe-js");
            const stripe = await loadStripe(
              process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY as string,
            );
            if (!stripe) throw new Error("Stripeの初期化に失敗しました");
            const result = await stripe.confirmCardPayment(buyRes.clientSecret);
            if (result.error) {
              console.error(result.error);
              showErrorModal(
                "買い切りの認証に失敗しました。カード情報を更新して再度お試しください。",
              );
              return;
            }
            if (
              !result.paymentIntent ||
              result.paymentIntent.status !== "succeeded"
            ) {
              showErrorModal(
                "買い切りの認証が完了しませんでした。時間をおいて再度お試しください。",
              );
              return;
            }
          } catch (err) {
            console.error("confirmCardPayment (buy) error", err);
            showErrorModal(
              "買い切りの認証フローの実行に失敗しました。時間をおいて再度お試しください。",
            );
            return;
          }
        } else {
          showErrorModal(
            "買い切りの支払いを完了できませんでした（カード認証が必要な可能性があります）",
          );
          return;
        }
      }

      // 2. サブスク開始（保存カード）
      const subPayload = {
        items: subTargets.map((i: CartItem) => ({
          cartItemId: i.id,
          option: "サブスク" as const,
        })),
      };
      let subResRaw: Response | null = null;
      let subData: SubscriptionResponse | null = null;
      try {
        subResRaw = await fetch("/api/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subPayload),
        });
        subData = (await subResRaw
          .json()
          .catch(() => ({}))) as SubscriptionResponse;
      } catch (e) {
        console.error("Subscription create error", e);
        showErrorModal(
          "サブスク開始でエラーが発生しました。時間をおいて再度お試しください。",
        );
        return;
      }

      if (subResRaw?.ok && subData?.ok) {
        completePurchase();
        return;
      }

      const requiresAction =
        subData?.status === "requires_action" ||
        subData?.error === "REQUIRES_ACTION_OR_FAILED";
      if (requiresAction && subData?.clientSecret) {
        try {
          const { loadStripe } = await import("@stripe/stripe-js");
          const stripe = await loadStripe(
            process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY as string,
          );
          if (!stripe) throw new Error("Stripeの初期化に失敗しました");
          const result = await stripe.confirmCardPayment(subData.clientSecret);
          if (result.error) {
            console.error(result.error);
            showErrorModal(
              "サブスクの認証に失敗しました。カード情報を更新して再度お試しください。",
            );
            return;
          } else if (
            result.paymentIntent &&
            result.paymentIntent.status === "succeeded"
          ) {
            // 認証成功後に購入確定APIを呼び出し
            try {
              const finalizeRes = await fetch("/api/subscription/finalize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  paymentIntentId: result.paymentIntent.id,
                }),
              });
              const finalizeData = await finalizeRes.json().catch(() => ({}));
              if (finalizeRes.ok && finalizeData?.ok) {
                completePurchase();
                return;
              }
              showErrorModal(
                "購入の確定に失敗しました。時間をおいて再度お試しください。",
              );
            } catch (fe) {
              console.error("Finalize error", fe);
              showErrorModal(
                "購入確定処理でエラーが発生しました。時間をおいて再度お試しください。",
              );
              return;
            }
          } else {
            showErrorModal(
              "サブスクの認証が完了しませんでした。時間をおいて再度お試しください。",
            );
            return;
          }
        } catch (err) {
          console.error("confirmCardPayment (sub) error", err);
          showErrorModal(
            "サブスクの認証フローの実行に失敗しました。時間をおいて再度お試しください。",
          );
          return;
        }
      } else {
        const message =
          (subData?.message as string | undefined) ??
          "サブスク開始に失敗しました。設定画面でカードを更新し、再度お試しください。";
        showErrorModal(message);
        return;
      }
    } finally {
      setIsProcessingMixed(false);
    }
  };

  return (
    <div className={styles.checkoutPage}>
      <button type="button" onClick={handleBack} className={styles.backLink}>
        <span className={styles.backArrow}>&#9664;</span>
        戻る
      </button>

      <div className={styles.page}>
        <div className={styles.cart}>
          <div className={styles.cartHeader}>
            <h2>決済</h2>
            <p className="item-count">{items.length}個の商品</p>
          </div>
          <div className={styles.wrapper}>
            {items.length === 0 ? (
              <div className={styles.emptyMessage}>
                カートに商品がありません。
              </div>
            ) : (
              <table className={styles.cartItems}>
                <colgroup>
                  <col style={{ width: "35%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>商品</th>
                    <th>販売形式</th>
                    <th>価格</th>
                    <th>決済</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: CartItem) => (
                    <tr key={item.id}>
                      <td>
                        <Link
                          href={`/apps/${item.appPublicId}`}
                          className={
                            (styles as Record<string, string>).productLink
                          }
                        >
                          <Image
                            className={styles.icon}
                            src={
                              item.iconUrl && item.iconUrl.length > 0
                                ? item.iconUrl
                                : "/images/icon-default.png"
                            }
                            alt={item.name}
                            width={50}
                            height={50}
                          />
                          <p>{item.name}</p>
                        </Link>
                      </td>
                      <td className={checkoutStyles.fixedType}>
                        <div>{item.selected}</div>
                      </td>
                      <td className={styles.price}>
                        {item.selectable
                          ? formatPrice(
                              item.selected,
                              item.selected === "買い切り"
                                ? item.buyPrice
                                : item.subPrice,
                            )
                          : formatPrice(item.selected, item.fixedPrice)}
                      </td>
                      <td className={styles.payment}>
                        {canUseWcoin(item) && canUseCard(item) ? (
                          <div
                            className={
                              paymentOpenIds.has(item.id)
                                ? `${checkoutStyles.paymentSelect} ${checkoutStyles.animate}`
                                : checkoutStyles.paymentSelect
                            }
                          >
                            {[
                              {
                                label: "Wコイン" as PaymentMethod,
                                dataOption: "買い切り" as const,
                              },
                              {
                                label: "カード" as PaymentMethod,
                                dataOption: "サブスク" as const,
                              },
                            ].map(({ label, dataOption }) => {
                              const isSelected =
                                paymentSelections[item.id] === label;
                              return (
                                <button
                                  key={label}
                                  type="button"
                                  data-option={dataOption}
                                  className={cn(
                                    checkoutStyles.paymentSelectButton,
                                    {
                                      [checkoutStyles.selected]: isSelected,
                                      [checkoutStyles.unselected]: !isSelected,
                                    },
                                  )}
                                  onClick={() =>
                                    handleTogglePaymentOption(
                                      item.id,
                                      label,
                                      item,
                                    )
                                  }
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div
                            className={
                              (styles as Record<string, string>).fixedType
                            }
                          >
                            {canUseWcoin(item) ? "Wコイン" : "カード"}
                          </div>
                        )}
                      </td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className={styles.bottom} />
          </div>
        </div>

        <div className={styles.total}>
          <div className={cn(styles.amount, styles.otp)}>
            <h2>買い切り</h2>
            <p>小計：{formatPrice("買い切り", subtotalBuy)}</p>
          </div>
          <div className={cn(styles.amount, styles.sub)}>
            <h2>サブスク</h2>
            <p>小計：{formatPrice("サブスク", subtotalSub)}</p>
          </div>

          <div className={styles.sum}>
            合計金額：¥{sum.toLocaleString()}
            <div className={styles.attnWrap}>
              <div className={styles.ast}>※</div>
              <div className={styles.attnCont}>
                <div className={styles.attnFlex}>
                  <div className={styles.attn}>サブスクリプション商品は、</div>
                  <div className={styles.attn}>初回支払い後</div>
                </div>
                <div className={styles.attn}>自動的に毎月請求されます。</div>
              </div>
            </div>
          </div>

          <button
            type="button"
            className={styles.toBuy}
            disabled={
              isLoadingIntent ||
              isStartingSub ||
              isProcessingMixed ||
              items.length === 0 ||
              sum === 0
            }
            onClick={async () => {
              if (
                items.length === 0 ||
                (subtotalBuy === 0 && subtotalSub === 0)
              ) {
                showErrorModal("決済対象がありません");
                return;
              }
              // アイテムを支払い方法別・販売形式別に分類
              const buyItems = items
                .filter((i: CartItem) => i.selected === "買い切り")
                .filter((i: CartItem) =>
                  i.selectable ? i.buyPrice : i.fixedPrice,
                );
              const subItems = items
                .filter((i: CartItem) => i.selected === "サブスク")
                .filter((i: CartItem) =>
                  i.selectable ? i.subPrice : i.fixedPrice,
                );

              let skippedAppNames: string[] = [];
              let wcoinAllSkipped = false;

              const wcoinBuyTargets = buyItems.filter(
                (i) =>
                  canUseWcoin(i) &&
                  (!canUseCard(i) || paymentSelections[i.id] === "Wコイン"),
              );
              const wcoinSubTargets = subItems.filter(
                (i) =>
                  canUseWcoin(i) &&
                  (!canUseCard(i) || paymentSelections[i.id] === "Wコイン"),
              );
              const cardBuyTargets = buyItems.filter(
                (i) =>
                  canUseCard(i) &&
                  (!canUseWcoin(i) || paymentSelections[i.id] === "カード"),
              );
              const cardSubTargets = subItems.filter(
                (i) =>
                  canUseCard(i) &&
                  (!canUseWcoin(i) || paymentSelections[i.id] === "カード"),
              );

              const hasCardPayment =
                cardBuyTargets.length > 0 || cardSubTargets.length > 0;

              if (hasCardPayment && !savedCardAvailable) {
                showErrorModal(
                  "カード払いを含むため、設定画面でカードを登録してください",
                );
                return;
              }

              // 1. Wコイン決済（買い切り + サブスク、部分購入対応）
              const wcoinTargets = [...wcoinBuyTargets, ...wcoinSubTargets];
              if (wcoinTargets.length > 0) {
                try {
                  const res = await fetch("/api/wcoin/checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      items: wcoinTargets.map((i) => ({
                        cartItemId: i.id,
                        option: i.selected,
                      })),
                    }),
                  });
                  const data = (await res
                    .json()
                    .catch(() => ({}))) as WcoinCheckoutResponse;
                  if (!res.ok || !data?.ok) {
                    console.error("Wcoin checkout failed", data);
                    setWcoinErrorModalOpen(true);
                    return;
                  }

                  if (typeof data.newBalance === "number") {
                    setCoinBalance(data.newBalance);
                  }

                  if (
                    Array.isArray(data.skippedCartItemIds) &&
                    data.skippedCartItemIds.length > 0
                  ) {
                    const skippedSet = new Set<number>(
                      data.skippedCartItemIds as number[],
                    );
                    skippedAppNames = wcoinTargets
                      .filter((i) => skippedSet.has(i.id))
                      .map((i) => i.name);

                    if (skippedSet.size === wcoinTargets.length) {
                      wcoinAllSkipped = true;
                    }
                  }
                } catch (e: unknown) {
                  console.error("Wcoin checkout error", e);
                  setWcoinErrorModalOpen(true);
                  return;
                }
              }

              // 2. カード決済部分（買い切り + サブスク混在）
              const cardBuyTotal = cardBuyTargets.reduce((sum, i) => {
                if (i.selectable) return sum + (i.buyPrice ?? 0);
                return sum + (i.fixedPrice ?? 0);
              }, 0);
              const cardSubTotal = cardSubTargets.reduce((sum, i) => {
                if (i.selectable) return sum + (i.subPrice ?? 0);
                return sum + (i.fixedPrice ?? 0);
              }, 0);

              if (cardBuyTotal === 0 && cardSubTotal === 0) {
                // カード決済が無く、Wコインも全件購入できなかった場合は完了画面へ進まずエラーモーダル
                if (wcoinAllSkipped) {
                  setWcoinErrorModalOpen(true);
                  return;
                }

                // Wコイン決済のみで完結（一部のみ購入できた場合は完了画面で
                // 「残高不足で購入できなかったアプリ」を表示）
                completePurchase(skippedAppNames);
                return;
              }

              // 買い切り + サブスク混合（カード）
              if (cardBuyTotal > 0 && cardSubTotal > 0) {
                await processMixedCheckout();
                return;
              }

              // 買い切りのみ（カード）
              if (cardBuyTotal > 0) {
                setIsLoadingIntent(true);
                const payload = {
                  items: cardBuyTargets.map((i: CartItem) => ({
                    cartItemId: i.id,
                    option: "買い切り" as const,
                  })),
                  useSavedCard: true,
                  confirmNow: true,
                };
                try {
                  const res = await fetcher<PaymentIntentResult>(
                    "/api/payment-intent",
                    {
                      method: "POST",
                      body: JSON.stringify(payload),
                    },
                  );
                  if (res?.status === "succeeded") {
                    completePurchase(skippedAppNames);
                  } else {
                    showErrorModal(
                      "買い切りの支払いを完了できませんでした（カード認証が必要な可能性があります）",
                    );
                  }
                } catch (e: unknown) {
                  console.error(e);
                  const msg = e instanceof Error ? e.message : "不明なエラー";
                  showErrorModal(
                    `買い切りの支払いでエラーが発生しました: ${msg}`,
                  );
                } finally {
                  setIsLoadingIntent(false);
                }
                return;
              }

              // サブスクのみ（カード）
              if (cardSubTotal > 0) {
                await startSubscription();
              }
            }}
          >
            {savedCardAvailable ? "購入" : "購入"}
          </button>
        </div>
      </div>

      <ErrorModal
        open={wcoinErrorModalOpen}
        onClose={() => setWcoinErrorModalOpen(false)}
        title="Wコイン残高が不足しています"
        message="チャージするか、カート内の商品や支払い方法を見直してください。"
      />
      <ErrorModal
        open={!!errorMessage}
        onClose={() => setErrorMessage(null)}
        title="決済エラー"
        message={errorMessage ?? ""}
      />
    </div>
  );
}
// Saved-card only checkout UI. No card entry here.
