"use client";

import RatingSummary from "@/app/(sidebar)/components/RatingSummary";
import { useTabIndicator } from "@/app/(sidebar)/components/useTabIndicator";
import Avatar from "@/components/Avatar";
import { ErrorModal } from "@/components/ErrorModal";
import { Modal } from "@/components/Modal";
import { cn } from "@/lib/cn";
import { formatTimeAgo } from "@/utils/date";
import { fetcher } from "@/utils/fetcher";
import { toggleFavoriteOnServer } from "@/utils/toggleFavorite";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppGallery } from "./components/AppGallery";
import { AppHeader } from "./components/AppHeader";
import { DescriptionSection } from "./components/DescriptionSection";
import { PlansAside } from "./components/PlansAside";
import type { AppDetail } from "./page";
import styles from "./page.module.scss";

type AppDetailClientProps = {
  app: AppDetail;
};

export default function AppDetailClient({
  app: initialApp,
}: AppDetailClientProps) {
  const router = useRouter();
  const [app, setApp] = useState<AppDetail>(initialApp);
  const [activeTab, setActiveTab] = useState<"detail" | "review">("detail");
  const { tabbedRef, indicatorRef, updateTabIndicator } = useTabIndicator<
    "detail" | "review"
  >(activeTab);
  const descRef = useRef<HTMLParagraphElement | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showToggle, setShowToggle] = useState(false);
  const collapsedDescHeightRef = useRef<number | null>(null);
  const [isFavorite, setIsFavorite] = useState(Boolean(initialApp.isFavorite));
  const [selectedPlan, setSelectedPlan] = useState<
    "oneTime" | "subscription" | null
  >(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [hasSubscriptionHistory] = useState(
    Boolean(initialApp.isSubscriptionPurchased),
  );
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(
    Boolean(initialApp.isSubscriptionActive),
  );
  const [subscriptionModalState, setSubscriptionModalState] = useState<
    "idle" | "cancelConfirm" | "cancelDone" | "restartConfirm"
  >("idle");
  const [isCancellingSubscription, setIsCancellingSubscription] =
    useState(false);
  const [isRestartingSubscription, setIsRestartingSubscription] =
    useState(false);
  const [subscriptionErrorMessage, setSubscriptionErrorMessage] = useState<
    string | null
  >(null);
  const [favoriteProcessing, setFavoriteProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBack = () => {
    router.back();
  };

  // Hash を使ったタブ同期ヘルパー
  const updateHashForTab = (tab: "detail" | "review") => {
    if (typeof window === "undefined") return;
    const hash = tab === "review" ? "#review" : "#detail";
    const { pathname, search } = window.location;
    if (window.location.hash !== hash) {
      history.replaceState(null, "", `${pathname}${search}${hash}`);
    }
  };

  const setTabAndHash = (tab: "detail" | "review") => {
    setActiveTab(tab);
    updateTabIndicator();
    updateHashForTab(tab);
  };

  // biome-ignore lint: アプリ情報取得後にインジケーターを更新
  useEffect(() => {
    if (app) {
      updateTabIndicator();
    }
  }, [app, updateTabIndicator]);

  // mount フラグ: マウント直後はタブの transition を無効化するために使用
  useEffect(() => {
    // 1フレーム待ってからトランジションを有効化
    const raf = requestAnimationFrame(() => {
      setIsMounted(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // マウント時にハッシュからタブを復元し、ハッシュ変更も監視
  useEffect(() => {
    if (typeof window === "undefined") return;
    const applyHash = () => {
      const h = window.location.hash.replace("#", "");
      if (h === "review" || h === "detail") {
        setActiveTab(h as "detail" | "review");
        // indicator 更新
        requestAnimationFrame(() => updateTabIndicator());
      }
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [updateTabIndicator]);

  // biome-ignore lint: レビュー作成/更新時に外部からの通知を受け取り、最新の app データを取得して state を更新
  useEffect(() => {
    const handler = async (e: Event) => {
      try {
        const publicId =
          (e as CustomEvent)?.detail?.appPublicId || app?.publicId;
        if (!publicId) return;
        const data = await fetcher(`/api/apps/${publicId}`);
        if (data) {
          setApp(
            (prev) =>
              ({ ...(prev || {}), ...(data as AppDetail) }) as AppDetail,
          );
          // 切り替えられていればレビュータブに移動 (ハッシュも更新)
          setTabAndHash("review");
        }
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener("review:updated", handler as EventListener);
    return () =>
      window.removeEventListener("review:updated", handler as EventListener);
  }, [app]);

  // biome-ignore lint: 詳細文の折りたたみ
  useEffect(() => {
    if (!descRef.current) return;
    const desc = descRef.current;
    const styles = window.getComputedStyle(desc);
    const lineHeight = parseFloat(styles.lineHeight || "0");
    if (!lineHeight) return;

    const maxHeightPx = lineHeight * 5;
    collapsedDescHeightRef.current = maxHeightPx;

    if (desc.scrollHeight <= maxHeightPx + 1) {
      setShowToggle(false);
      desc.style.maxHeight = "none";
      return;
    }

    setShowToggle(true);

    // 初期状態では折りたたみ高さに固定
    if (!descExpanded) {
      desc.style.maxHeight = `${maxHeightPx}px`;
    } else {
      desc.style.maxHeight = `${desc.scrollHeight}px`;
    }
  }, [app]);

  const handleToggleDescription = () => {
    const desc = descRef.current;
    const collapsed = collapsedDescHeightRef.current;
    if (!desc || collapsed == null) return;

    const fullHeight = desc.scrollHeight;

    if (descExpanded) {
      // 閉じるアニメーション
      desc.style.maxHeight = `${fullHeight}px`;
      desc.classList.add(styles.descriptionFade);
      requestAnimationFrame(() => {
        desc.style.maxHeight = `${collapsed}px`;
      });

      window.setTimeout(() => {
        desc.classList.remove(styles.descriptionExpanded);
        setDescExpanded(false);
      }, 300);

      window.setTimeout(() => {
        desc.classList.remove(styles.descriptionFade);
      }, 100);
    } else {
      // 開くアニメーション
      desc.classList.add(styles.descriptionExpanded, styles.descriptionFade);
      desc.style.maxHeight = `${fullHeight}px`;

      window.setTimeout(() => {
        desc.classList.remove(styles.descriptionFade);
      }, 100);

      setDescExpanded(true);
    }
  };

  const handleNextImage = () => {
    if (!app || !app.images || app.images.length <= 1) return;

    setCurrentImageIndex((prev) => {
      const nextIndex = prev + 1;
      return nextIndex >= app.images.length ? app.images.length - 1 : nextIndex;
    });
  };

  const handlePrevImage = () => {
    if (!app || !app.images || app.images.length <= 1) return;

    setCurrentImageIndex((prev) => {
      const nextIndex = prev - 1;
      return nextIndex < 0 ? 0 : nextIndex;
    });
  };

  const handleClickCancelSubscription = () => {
    setSubscriptionErrorMessage(null);
    setSubscriptionModalState("cancelConfirm");
  };

  const handleClickRestartSubscription = () => {
    setSubscriptionErrorMessage(null);
    setSubscriptionModalState("restartConfirm");
  };

  const handleConfirmCancelSubscription = async () => {
    if (!app) return;
    try {
      setIsCancellingSubscription(true);
      await fetcher("/api/subscription/cancel", {
        method: "POST",
        body: JSON.stringify({ appPublicId: app.publicId }),
      });

      setIsSubscriptionActive(false);
      setSubscriptionModalState("cancelDone");
    } catch (error) {
      console.error("Failed to cancel subscription", error);
      setSubscriptionErrorMessage(
        "サブスク解除に失敗しました。時間をおいて再度お試しください。",
      );
    } finally {
      setIsCancellingSubscription(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!app || favoriteProcessing) return;

    const next = !isFavorite;
    setFavoriteProcessing(true);

    try {
      const data = await toggleFavoriteOnServer(app.publicId, next);
      if (!data) return;

      setIsFavorite(data.isFavorite);

      // 出品者向け統計情報にお気に入り数が含まれている場合は更新
      setApp((prev) => {
        if (!prev || !prev.stats) return prev;
        return {
          ...prev,
          stats: {
            ...prev.stats,
            favoritesCount:
              data.favoritesCount ?? prev.stats.favoritesCount ?? 0,
          },
        };
      });
    } catch (e) {
      console.error("failed to toggle favorite", e);
    } finally {
      setFavoriteProcessing(false);
    }
  };

  const handleConfirmRestartSubscription = async () => {
    if (!app) return;
    try {
      setIsRestartingSubscription(true);
      await fetcher("/api/cart", {
        method: "POST",
        body: JSON.stringify({ appPublicId: app.publicId, salesFormat: "S" }),
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cart:updated"));
      }

      router.push("/checkout");
    } catch (error) {
      console.error("Failed to restart subscription", error);
      setSubscriptionErrorMessage(
        "サブスク再開に失敗しました。時間をおいて再度お試しください。",
      );
    } finally {
      setIsRestartingSubscription(false);
      setSubscriptionModalState("idle");
    }
  };

  const handleAddToCart = async () => {
    if (!app) return;

    // プランが2種類ある場合は、どちらか選ぶ
    const hasOneTime = app.salesPlans.some((plan) => plan.salesFormat === "P");
    const hasSub = app.salesPlans.some((plan) => plan.salesFormat === "S");

    if (hasOneTime && hasSub && !selectedPlan) {
      setPlanError("買い切りかサブスクのどちらかを選択してください。");
      return;
    }

    const salesFormat: "P" | "S" | null =
      selectedPlan === "oneTime"
        ? "P"
        : selectedPlan === "subscription"
          ? "S"
          : hasOneTime
            ? "P"
            : hasSub
              ? "S"
              : null;

    if (!salesFormat) {
      setPlanError("選択可能な販売形式がありません。");
      return;
    }

    try {
      setPlanError(null);
      setAddingToCart(true);
      await fetcher("/api/cart", {
        method: "POST",
        body: JSON.stringify({ appPublicId: app.publicId, salesFormat }),
      });

      // ローカル状態もカート追加済みに更新
      setApp((prev) => (prev ? { ...prev, isInCart: true } : prev));

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cart:updated"));
      }
    } catch (error) {
      console.error("Failed to add to cart", error);
      setErrorMessage("カートへの追加中にエラーが発生しました。");
    } finally {
      setAddingToCart(false);
    }
  };

  // プランが1つだけの場合は常にそのプランを選択状態にする
  useEffect(() => {
    if (!app) return;

    const hasOneTime = app.salesPlans.some((plan) => plan.salesFormat === "P");
    const hasSub = app.salesPlans.some((plan) => plan.salesFormat === "S");

    if (hasOneTime && !hasSub) {
      setSelectedPlan("oneTime");
    } else if (!hasOneTime && hasSub) {
      setSelectedPlan("subscription");
    } else {
      setSelectedPlan(null);
    }
  }, [app]);

  // biome-ignore lint:ギャラリーのインデックスをリセット
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [app?.id]);

  const isSubscriptionModalOpen = subscriptionModalState !== "idle";
  const isCancelFlow =
    subscriptionModalState === "cancelConfirm" ||
    subscriptionModalState === "cancelDone";
  const isRestartFlow = subscriptionModalState === "restartConfirm";

  const modalTitle = isCancelFlow ? "サブスク解除" : "サブスク再開";
  const modalDescription = isCancelFlow
    ? "このアプリのサブスクを解除します"
    : "このアプリのサブスクを再開します";

  // レビュー集計: [5星,4星,3星,2星,1星]
  const reviewDistribution: [number, number, number, number, number] = (() => {
    const counts = [0, 0, 0, 0, 0];
    if (!app || !app.reviews)
      return counts as [number, number, number, number, number];
    for (const r of app.reviews) {
      const star = Math.max(1, Math.min(5, Math.round(r.rating)));
      // 5星はindex 0、1星はindex 4
      counts[5 - star] += 1;
    }
    return counts as [number, number, number, number, number];
  })();

  return (
    <div className={styles.appDetailPage}>
      <button type="button" onClick={handleBack} className={styles.backLink}>
        <span className={styles.backArrow}>&#9664;</span>
        戻る
      </button>

      <div className={styles.mainLayout}>
        {/* 左側: アプリ情報 */}
        <section className={styles.leftPane}>
          <AppHeader app={app} />

          <div className={styles.tabTop}>
            <div className={styles.tabbed} ref={tabbedRef}>
              <div
                className={cn(
                  styles.tabbedIndicator,
                  isMounted && styles.enableTransition,
                )}
                ref={indicatorRef}
              />
              <button
                type="button"
                className={cn(
                  styles.tabBtn,
                  isMounted && styles.enableTransition,
                  activeTab === "detail" && styles.activeTab,
                )}
                data-tab="detail"
                onClick={() => setTabAndHash("detail")}
              >
                詳細
              </button>
              <button
                type="button"
                className={cn(
                  styles.tabBtn,
                  isMounted && styles.enableTransition,
                  activeTab === "review" && styles.activeTab,
                )}
                data-tab="review"
                onClick={() => setTabAndHash("review")}
              >
                レビュー
              </button>
            </div>
          </div>

          <div
            className={cn(
              styles.tabContainer,
              isMounted && styles.enableTransition,
            )}
            style={{
              transform:
                activeTab === "detail" ? "translateX(0)" : "translateX(-100%)",
            }}
          >
            <section
              className={cn(
                styles.tabContent,
                isMounted && styles.enableTransition,
                activeTab === "detail" && styles.tabContentActive,
              )}
            >
              <AppGallery
                app={app}
                currentImageIndex={currentImageIndex}
                onPrev={handlePrevImage}
                onNext={handleNextImage}
              />

              <DescriptionSection
                app={app}
                descRef={descRef}
                descExpanded={descExpanded}
                showToggle={showToggle}
                onToggleDescription={handleToggleDescription}
              />
            </section>

            <section
              className={cn(
                styles.tabContent,
                isMounted && styles.enableTransition,
                activeTab === "review" && styles.tabContentActive,
              )}
            >
              {app.reviews.length > 0 && (
                <RatingSummary
                  average={app?.rating ?? 0}
                  totalCount={app?._count?.reviews ?? app?.reviews?.length ?? 0}
                  distribution={reviewDistribution}
                />
              )}

              {app?.reviews?.length > 0 ? (
                <>
                  {/* すべて見るボタン */}
                  {app._count.reviews > 4 && (
                    <Link
                      className={styles.reviewsAllBtn}
                      href={`/apps/${app.publicId}/reviews`}
                    >
                      すべて見る
                    </Link>
                  )}
                  <div className={styles.reviewsGrid}>
                    {app.reviews.slice(0, 4).map((r) => (
                      <article key={r.id}>
                        <Link
                          href={`/apps/${app.publicId}/reviews/${r.id}`}
                          className={styles.reviewItem}
                        >
                          {/* ユーザー情報 */}
                          <div className={styles.reviewUser}>
                            <Avatar
                              src={r.user?.image || null}
                              alt={`${r.user?.name}のアイコン`}
                              className={styles.reviewAvatar}
                            />
                            <div className={styles.reviewMeta}>
                              <strong className={styles.reviewName}>
                                {r.user?.name}
                              </strong>
                              <time className={styles.reviewTime}>
                                {formatTimeAgo(r.updatedAt)}
                              </time>
                            </div>
                          </div>

                          {/* 星 */}
                          <div className={styles.reviewStars}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <span
                                key={n}
                                className={cn(
                                  styles.reviewStar,
                                  n <= Math.round(r.rating)
                                    ? styles.reviewStarFull
                                    : styles.reviewStarEmpty,
                                )}
                              >
                                ★
                              </span>
                            ))}
                          </div>

                          {/* 本文 (3行truncate) */}
                          <p className={styles.reviewBody}>{r.body}</p>
                        </Link>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className={styles.reviewPlaceholder}>
                  <p>レビューはまだありません。</p>
                </div>
              )}
            </section>
          </div>
        </section>

        {/* 右側: プラン情報 */}
        <PlansAside
          app={app}
          selectedPlan={selectedPlan}
          onChangeSelectedPlan={(plan) => {
            setSelectedPlan(plan);
            setPlanError(null);
          }}
          isFavorite={isFavorite}
          onToggleFavorite={handleToggleFavorite}
          onAddToCart={handleAddToCart}
          onClickTrial={() => {
            if (!app) return;
            router.replace(`/apps/${app.publicId}/trial`);
          }}
          addingToCart={addingToCart}
          isInCart={Boolean(app.isInCart)}
          planError={planError}
          hasSubscriptionHistory={hasSubscriptionHistory}
          isSubscriptionActive={isSubscriptionActive}
          onClickCancelSubscription={handleClickCancelSubscription}
          onClickRestartSubscription={handleClickRestartSubscription}
          cancelingSubscription={isCancellingSubscription}
          restartingSubscription={isRestartingSubscription}
        />
      </div>

      <Modal
        open={isSubscriptionModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSubscriptionModalState("idle");
            setSubscriptionErrorMessage(null);
          }
        }}
        title={modalTitle}
        description={modalDescription}
        headerClassName={styles.modalHeader}
        maxWidth="sm"
      >
        {subscriptionModalState === "cancelDone" ? (
          <p className={styles.cancelDone}>サブスクを解除しました</p>
        ) : (
          <>
            <p className={styles.modalDescription}>
              {isCancelFlow
                ? "このアプリのサブスクを解除しますか？"
                : "このアプリのサブスクを再開しますか？"}
            </p>
            {app && <p className={styles.modalAppName}>{app.name}</p>}
            {subscriptionErrorMessage && (
              <p className={styles.planError}>{subscriptionErrorMessage}</p>
            )}
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.subCancel}
                onClick={() => {
                  setSubscriptionModalState("idle");
                  setSubscriptionErrorMessage(null);
                }}
              >
                キャンセル
              </button>
              {isCancelFlow ? (
                <button
                  type="button"
                  className={styles.subDelete}
                  onClick={handleConfirmCancelSubscription}
                  disabled={isCancellingSubscription}
                >
                  {isCancellingSubscription ? "解除中..." : "解除"}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.subRestart}
                  onClick={handleConfirmRestartSubscription}
                  disabled={isRestartingSubscription}
                >
                  {isRestartingSubscription ? "再開中..." : "再開"}
                </button>
              )}
            </div>
          </>
        )}
      </Modal>
      <ErrorModal
        open={!!errorMessage}
        title="カート追加エラー"
        message={errorMessage ?? ""}
        onClose={() => setErrorMessage(null)}
      />
    </div>
  );
}
