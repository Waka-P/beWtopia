"use client";

import { cn } from "@/lib/cn";
import { formatTimeAgo } from "@/utils/date";
import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "../page.module.scss";
import type { AppDetail } from "./types";

type SelectedPlan = "oneTime" | "subscription" | null;

type Props = {
  app: AppDetail;
  selectedPlan: SelectedPlan;
  onChangeSelectedPlan: (plan: SelectedPlan) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onAddToCart: () => void;
  onClickTrial?: () => void;
  addingToCart?: boolean;
  isInCart?: boolean;
  planError?: string | null;
  // サブスク購入履歴がある場合に true
  hasSubscriptionHistory?: boolean;
  // 現在サブスクが有効かどうか
  isSubscriptionActive?: boolean;
  // サブスク解除ボタン押下時のハンドラー
  onClickCancelSubscription?: () => void;
  // サブスク再開ボタン押下時のハンドラー
  onClickRestartSubscription?: () => void;
  // サブスク解除処理中かどうか
  cancelingSubscription?: boolean;
  // サブスク再開処理中かどうか
  restartingSubscription?: boolean;
};

export function PlansAside({
  app,
  selectedPlan,
  onChangeSelectedPlan,
  isFavorite,
  onToggleFavorite,
  onAddToCart,
  onClickTrial,
  addingToCart,
  isInCart,
  planError,
  hasSubscriptionHistory,
  isSubscriptionActive,
  onClickCancelSubscription,
  onClickRestartSubscription,
  cancelingSubscription,
  restartingSubscription,
}: Props) {
  const isOwner = Boolean(app.isOwner);
  const hasTrial = Boolean(app.trial);
  const isTrialAvailable = hasTrial && (app.isTrialAvailable ?? true);
  const isTrialInProgress = Boolean(app.isTrialInProgress);
  const isPurchased = Boolean(app.isPurchased);

  const oneTimePlan = app.salesPlans.find((plan) => plan.salesFormat === "P");
  const subPlan = app.salesPlans.find((plan) => plan.salesFormat === "S");

  // 販売形式が複数ある場合は、どちらかが選択されるまでカート追加ボタンを無効化
  const requiresPlanSelection = Boolean(oneTimePlan && subPlan);
  const isPlanSelectable = !requiresPlanSelection || selectedPlan !== null;

  const hasWCoin = app.paymentMethods?.some((m) => m.method === "W");
  const hasCard = app.paymentMethods?.some((m) => m.method === "C");

  const formatYen = (v: number) => `¥${(v ?? 0).toLocaleString()}`;
  const hasSubscriptionPurchase = Boolean(hasSubscriptionHistory);
  const router = useRouter();

  // helper to render human-readable size (duplicated from AppHeader)
  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes || bytes <= 0) return "-";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"] as const;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = parseFloat((bytes / k ** i).toFixed(1));
    return `${value} ${sizes[i]}`;
  };

  // computed text values for owner extra info
  // helpers for owner view
  const paymentMethods = (() => {
    const methods: string[] = [];
    if (hasWCoin) methods.push("Wコイン");
    if (hasCard) methods.push("クレジットカード");
    return methods;
  })();

  // purchase/registration counts
  const oneTimeCount = app.stats?.countOneTimePurchases ?? 0;
  const subCount = app.stats?.countSubscriptionRegistrations ?? 0;

  // price formatting utility
  const priceText = (plan: typeof oneTimePlan | typeof subPlan) => {
    if (!plan) return "-";
    return plan.salesFormat === "P"
      ? `¥${plan.price.toLocaleString()}`
      : `¥${plan.price.toLocaleString()}/月`;
  };

  if (isOwner) {
    return (
      <aside className={styles.rightPane}>
        <div className={styles.statsCard}>
          <h2 className={styles.sectionTitle}>統計情報</h2>
          <div className={styles.statsTotalRow}>
            <span className={styles.statsTotalLabel}>総売上</span>
            <span className={styles.statsTotalValue}>
              {formatYen(app.stats?.totalRevenueYen ?? 0)}
            </span>
          </div>
          <ul className={styles.statsList}>
            <li className={styles.statsItem}>
              <span className={styles.statsLabel}>今月の売上</span>
              <span className={styles.statsValue}>
                {formatYen(app.stats?.monthlyRevenueYen ?? 0)}
              </span>
            </li>

            <li className={styles.statsItem}>
              <span className={styles.statsLabel}>販売数</span>
              <span className={styles.statsValue}>
                {(
                  app.stats?.totalSalesCount ?? app._count.purchases
                ).toLocaleString()}
                回
              </span>
            </li>
            <li className={styles.statsItem}>
              <span className={styles.statsLabel}>お気に入り登録数</span>
              <span className={styles.statsValue}>
                {(app.stats?.favoritesCount ?? 0).toLocaleString()}
              </span>
            </li>
          </ul>
        </div>
        <div className={styles.planCardsContainer}>
          {oneTimePlan && (
            <div className={styles.planCard}>
              <div className={styles.planHeader}>
                <span className={styles.planLabel}>買い切り</span>
              </div>
              <p className={styles.priceMain}>{priceText(oneTimePlan)}</p>
              <p className={styles.planNote}>
                {oneTimeCount.toLocaleString()}人購入
              </p>
            </div>
          )}
          {subPlan && (
            <div className={styles.planCard}>
              <div className={styles.planHeader}>
                <span className={styles.planLabel}>サブスク</span>
              </div>
              <p className={styles.priceMain}>{priceText(subPlan)}</p>
              <p className={styles.planNote}>
                {subCount.toLocaleString()}人登録
              </p>
            </div>
          )}
        </div>
        <ul className={styles.statsList}>
          <li className={styles.paymentMethodCard}>
            <span className={styles.label}>決済方法</span>
            {paymentMethods.map((method) => (
              <span key={method} className={styles.value}>
                {method}
              </span>
            ))}
          </li>
          <li className={styles.statsItem}>
            <span className={styles.statsLabel}>サイズ</span>
            <span className={styles.statsValue}>
              {formatFileSize(app.appFileSizeBytes ?? null)}
            </span>
          </li>
          <li className={styles.statsItem}>
            <span className={styles.statsLabel}>最終更新日</span>
            <span className={styles.statsValue}>
              {formatTimeAgo(app.updatedAt)}
            </span>
          </li>
        </ul>
      </aside>
    );
  }

  return (
    <aside className={styles.rightPane}>
      {oneTimePlan && (
        <button
          type="button"
          className={cn(
            styles.planCard,
            selectedPlan === "oneTime" && styles.planCardSelected,
          )}
          onClick={() => onChangeSelectedPlan("oneTime")}
        >
          <div className={styles.planHeader}>
            <span className={styles.planLabel}>買い切り</span>
          </div>
          <p className={styles.priceMain}>
            ¥{oneTimePlan.price.toLocaleString()}
          </p>
          <p className={styles.planNote}>一度の購入で永久利用</p>
        </button>
      )}

      {subPlan && (
        <button
          type="button"
          className={cn(
            styles.planCard,
            selectedPlan === "subscription" && styles.planCardSelected,
          )}
          onClick={() => onChangeSelectedPlan("subscription")}
        >
          <div className={styles.planHeader}>
            <span className={styles.planLabel}>サブスク</span>
          </div>
          <p className={styles.priceMain}>
            ¥{subPlan.price.toLocaleString()}
            <span className={styles.priceSuffix}>/月</span>
          </p>
          <p className={styles.planNote}>月額プラン(いつでもキャンセル可能)</p>
        </button>
      )}

      {planError && <p className={styles.planError}>{planError}</p>}

      <section className={styles.paymentSection}>
        <h2 className={styles.sectionTitle}>決済方法</h2>
        <div className={styles.paymentChips}>
          {hasWCoin && <span className={styles.paymentChip}>Wコイン</span>}
          {hasCard && (
            <span className={styles.paymentChip}>クレジットカード</span>
          )}
        </div>
      </section>

      <div className={styles.bottomWrapper}>
        {isPurchased ? (
          <>
            {hasSubscriptionPurchase &&
            isSubscriptionActive &&
            onClickCancelSubscription ? (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={onClickCancelSubscription}
                disabled={!!cancelingSubscription}
              >
                {cancelingSubscription ? "解除中..." : "サブスク解除"}
              </button>
            ) : hasSubscriptionPurchase &&
              !isSubscriptionActive &&
              onClickRestartSubscription ? (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={onClickRestartSubscription}
                disabled={!!restartingSubscription}
              >
                {restartingSubscription ? "再開中..." : "サブスクを再開"}
              </button>
            ) : (
              <button type="button" className={styles.primaryButton} disabled>
                購入済み
              </button>
            )}
            <div className={styles.trialAndFavoriteRow}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() =>
                  router.push(
                    app.myReview
                      ? `/apps/${app.publicId}/reviews/edit`
                      : `/apps/${app.publicId}/reviews/new`,
                  )
                }
              >
                {app.myReview ? "レビューを編集" : "レビューを投稿"}
              </button>
              <button
                type="button"
                className={styles.favoriteButton}
                aria-label="お気に入り"
                onClick={onToggleFavorite}
              >
                <Image
                  src={
                    isFavorite
                      ? "/images/favorite-filled.png"
                      : "/images/favorite.png"
                  }
                  alt={isFavorite ? "お気に入り中" : "お気に入り"}
                  width={24}
                  height={24}
                  className={styles.favoriteIcon}
                />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.cartActionRow}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={onAddToCart}
                disabled={!!addingToCart || !!isInCart || !isPlanSelectable}
              >
                {addingToCart
                  ? "追加中..."
                  : isInCart
                    ? "カートに追加済み"
                    : "カートに追加"}
              </button>
              {!hasTrial && (
                <button
                  type="button"
                  className={styles.favoriteButton}
                  aria-label="お気に入り"
                  onClick={onToggleFavorite}
                >
                  <Image
                    src={
                      isFavorite
                        ? "/images/favorite-filled.png"
                        : "/images/favorite.png"
                    }
                    alt={isFavorite ? "お気に入り中" : "お気に入り"}
                    width={24}
                    height={24}
                    className={styles.favoriteIcon}
                  />
                </button>
              )}
            </div>
            {hasTrial && (
              <div className={styles.trialAndFavoriteRow}>
                <button
                  type="button"
                  className={cn(
                    styles.secondaryButton,
                    styles.trialButton,
                    !isTrialAvailable && styles.disabled,
                  )}
                  disabled={!isTrialAvailable}
                  onClick={isTrialAvailable ? onClickTrial : undefined}
                >
                  {isTrialInProgress
                    ? (() => {
                        const days = app.trialRemainingDays ?? 0;
                        const hours = app.trialRemainingHours ?? 0;
                        const remainText =
                          days > 0 ? `${days}日${hours}時間` : `${hours}時間`;
                        return `お試し中（残り${remainText}）`;
                      })()
                    : isTrialAvailable
                      ? `無料で試す${
                          app.trial?.trialDays
                            ? `（${app.trial.trialDays}日間）`
                            : ""
                        }`
                      : "お試し期間終了"}
                </button>
                <button
                  type="button"
                  className={styles.favoriteButton}
                  aria-label="お気に入り"
                  onClick={onToggleFavorite}
                >
                  <Image
                    src={
                      isFavorite
                        ? "/images/favorite-filled.png"
                        : "/images/favorite.png"
                    }
                    alt={isFavorite ? "お気に入り中" : "お気に入り"}
                    width={24}
                    height={24}
                    className={styles.favoriteIcon}
                  />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
