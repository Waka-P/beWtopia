"use client";
import {
  DownloadProvider,
  useDownload,
} from "@/app/(sidebar)/contexts/DownloadContext";
import { ConfirmModal } from "@/components/ConfirmModal";
import { FilterModal } from "@/components/FilterModal";
import filterModalStyles from "@/components/FilterModal.module.scss";
import { Modal } from "@/components/Modal";
import { cn } from "@/lib/cn";
import { getLocalStorage, setLocalStorage } from "@/utils/localStorage";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TagFilterPicker } from "../../components/TagFilterPicker";
import {
  type ViewMode,
  ViewModeToggle,
} from "../../components/ViewModeToggle/ViewModeToggle";
import { useMypageAppsHeaderControls } from "../appsHeaderContext";
import styles from "./page.module.scss";

type PurchaseItem = {
  id: number;
  purchasedAt: string | Date;
  appPublicId: string;
  appName: string;
  appIconUrl: string | null;
  price: number;
  salesFormat: "買い切り" | "サブスク";
  rating: number;
  appDescription?: string | null;
  appThumbnailUrl?: string | null;
  sellerName?: string | null;
  sellerIconUrl?: string | null;
  isSubscriptionActive?: boolean;
  tags?: { id: number; name: string }[];
  hasReviewed?: boolean;
  listingType?: "bewt" | "bewts";
};

type PurchasesFilters = {
  priceRange: "all" | "low" | "mid" | "high";
  salesFormat: "all" | "buy" | "sub";
  activeSubscriptionOnly: boolean;
  highRatingOnly: boolean;
  tagIds: number[];
  listingTypes: ("bewt" | "bewts")[];
};

const DEFAULT_PURCHASES_FILTERS: PurchasesFilters = {
  priceRange: "all",
  salesFormat: "all",
  activeSubscriptionOnly: false,
  highRatingOnly: false,
  tagIds: [],
  listingTypes: ["bewt", "bewts"],
};

const PURCHASE_LISTING_TYPE_ORDER: ("bewt" | "bewts")[] = ["bewt", "bewts"];

const parsePurchasesFilters = (params: {
  get: (key: string) => string | null;
}) => {
  const priceRangeValue = params.get("f_price");
  const priceRange: PurchasesFilters["priceRange"] =
    priceRangeValue === "low" ||
    priceRangeValue === "mid" ||
    priceRangeValue === "high"
      ? priceRangeValue
      : "all";

  const salesFormatValue = params.get("f_sales_format");
  const salesFormat: PurchasesFilters["salesFormat"] =
    salesFormatValue === "buy" || salesFormatValue === "sub"
      ? salesFormatValue
      : "all";

  const tagIds = (params.get("f_tags") ?? "")
    .split(",")
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b);

  const listingTypesRaw = (params.get("f_types") ?? "")
    .split(",")
    .filter(
      (value): value is "bewt" | "bewts" =>
        value === "bewt" || value === "bewts",
    );
  const listingTypes = PURCHASE_LISTING_TYPE_ORDER.filter((value) =>
    listingTypesRaw.includes(value),
  );

  return {
    priceRange,
    salesFormat,
    activeSubscriptionOnly: params.get("f_active_sub") === "1",
    highRatingOnly: params.get("f_high") === "1",
    tagIds,
    listingTypes:
      listingTypes.length > 0
        ? listingTypes
        : [...DEFAULT_PURCHASES_FILTERS.listingTypes],
  } satisfies PurchasesFilters;
};

const arePurchasesFiltersEqual = (a: PurchasesFilters, b: PurchasesFilters) =>
  a.priceRange === b.priceRange &&
  a.salesFormat === b.salesFormat &&
  a.activeSubscriptionOnly === b.activeSubscriptionOnly &&
  a.highRatingOnly === b.highRatingOnly &&
  a.tagIds.length === b.tagIds.length &&
  a.tagIds.every((value, index) => value === b.tagIds[index]) &&
  a.listingTypes.length === b.listingTypes.length &&
  a.listingTypes.every((value, index) => value === b.listingTypes[index]);

const setOrDeleteParam = (
  params: URLSearchParams,
  key: string,
  value: string,
  enabled: boolean,
) => {
  if (enabled) params.set(key, value);
  else params.delete(key);
};

const applyPurchasesFiltersToParams = (
  params: URLSearchParams,
  filters: PurchasesFilters,
) => {
  setOrDeleteParam(
    params,
    "f_price",
    filters.priceRange,
    filters.priceRange !== DEFAULT_PURCHASES_FILTERS.priceRange,
  );
  setOrDeleteParam(
    params,
    "f_sales_format",
    filters.salesFormat,
    filters.salesFormat !== DEFAULT_PURCHASES_FILTERS.salesFormat,
  );
  setOrDeleteParam(params, "f_active_sub", "1", filters.activeSubscriptionOnly);
  setOrDeleteParam(params, "f_high", "1", filters.highRatingOnly);
  setOrDeleteParam(
    params,
    "f_tags",
    filters.tagIds.join(","),
    filters.tagIds.length > 0,
  );
  setOrDeleteParam(
    params,
    "f_types",
    filters.listingTypes.join(","),
    !arePurchasesFiltersEqual(
      { ...DEFAULT_PURCHASES_FILTERS, listingTypes: filters.listingTypes },
      {
        ...DEFAULT_PURCHASES_FILTERS,
        listingTypes: DEFAULT_PURCHASES_FILTERS.listingTypes,
      },
    ),
  );
};

const resolveViewMode = (value: string | null): ViewMode => {
  if (value === "list" || value === "grid" || value === "card") return value;
  return "list";
};

const MYPAGE_VIEW_STORAGE_KEY = "bewtopia:viewMode:mypage";

const getInitialViewMode = () =>
  resolveViewMode(getLocalStorage<string>(MYPAGE_VIEW_STORAGE_KEY, "list"));

function HighlightedText({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword) return <>{text}</>;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "gi");
  const parts: { text: string; isMatch: boolean; key: string }[] = [];
  let lastIndex = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const nextMatch = regex.exec(text);
    if (!nextMatch) break;
    if (nextMatch.index > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, nextMatch.index),
        isMatch: false,
        key: `n-${lastIndex}`,
      });
    }
    parts.push({
      text: nextMatch[0],
      isMatch: true,
      key: `m-${nextMatch.index}`,
    });
    lastIndex = nextMatch.index + nextMatch[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({
      text: text.slice(lastIndex),
      isMatch: false,
      key: `n-${lastIndex}`,
    });
  }
  return (
    <>
      {parts.map((part) =>
        part.isMatch ? (
          <mark key={part.key}>{part.text}</mark>
        ) : (
          <span key={part.key}>{part.text}</span>
        ),
      )}
    </>
  );
}

// ── アイテム1件ごとのコンポーネント ──────────────────────────────
type PurchaseItemRowProps = {
  it: PurchaseItem;
  search: string;
  viewMode: "list" | "card" | "grid";
  onHide: (item: PurchaseItem) => void;
  onClickCancelSubscription: (item: PurchaseItem) => void;
  onClickRestartSubscription: (item: PurchaseItem) => void;
  formatPrice: (item: PurchaseItem) => React.ReactNode;
  formatYMD: (d: string | Date) => string;
};

function PurchaseItemRow({
  it,
  search,
  onHide,
  onClickCancelSubscription,
  onClickRestartSubscription,
  formatPrice,
  formatYMD,
}: PurchaseItemRowProps) {
  const { addItems, startDownload } = useDownload();
  const [menuOpen, setMenuOpen] = useState(false);

  const { refs, floatingStyles } = useFloating({
    open: menuOpen,
    placement: "bottom-end",
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  });

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        refs.reference.current &&
        (refs.reference.current as HTMLElement).contains(target)
      )
        return;
      if (
        refs.floating.current &&
        (refs.floating.current as HTMLElement).contains(target)
      )
        return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen, refs]);

  return (
    <div className={styles.app}>
      <Link href={`/apps/${it.appPublicId}`} className={styles.appInner}>
        <div className={styles.appHeader}>
          <span className={styles.appIcon}>
            <Image
              src={it.appIconUrl ?? "/images/icon-default.png"}
              alt="アプリ"
              width={600}
              height={600}
            />
          </span>
          <div className={styles.appInfo}>
            <h2 className={styles.appName}>
              <HighlightedText text={it.appName} keyword={search} />
            </h2>
            <p className={styles.appDesc}>
              <HighlightedText
                text={it.appDescription ?? ""}
                keyword={search}
              />
            </p>
          </div>
        </div>
        {it.appThumbnailUrl ? (
          <div className={styles.thumbnail}>
            <Image
              src={it.appThumbnailUrl}
              alt="サムネイル"
              width={600}
              height={322}
            />
          </div>
        ) : (
          <p className={cn(styles.thumbnail, styles.noImage)}>NO IMAGE</p>
        )}
        <div className={styles.appFooter}>
          <p className={styles.appPrice}>{formatPrice(it)}</p>
          <div className={styles.ratingDateCont}>
            <div className={styles.sellerInfo}>
              <span className={styles.sellerIcon}>
                <Image
                  src={it.sellerIconUrl ?? "/images/icon-default.png"}
                  alt="出品者"
                  width={600}
                  height={600}
                />
              </span>
              <p className={styles.sellerName}>{it.sellerName ?? ""}</p>
            </div>
            <p className={styles.listingDate}>{formatYMD(it.purchasedAt)}</p>
          </div>
        </div>
      </Link>

      {/* ドットボタン */}
      <button
        ref={refs.setReference}
        type="button"
        className={styles.actionMenuBtn}
        data-open={menuOpen ? "true" : undefined}
        aria-label="アクションメニュー"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
      >
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </button>

      {/* FloatingPortal でbody直下にレンダリング */}
      <FloatingPortal>
        {/* biome-ignore lint: divを使用 */}
        <div
          ref={refs.setFloating}
          className={cn(styles.actionMenu, menuOpen && styles.show)}
          style={{
            ...floatingStyles,
            pointerEvents: menuOpen ? "auto" : "none",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            <li>
              <button
                type="button"
                className={styles.actionMenuItem}
                onClick={async (e) => {
                  e.stopPropagation();
                  const allowed =
                    it.salesFormat === "買い切り" || !!it.isSubscriptionActive;
                  if (!allowed) return;
                  addItems([
                    {
                      id: it.appPublicId,
                      name: it.appName,
                      fileUrl: `/api/apps/${it.appPublicId}/download`,
                      status: "idle",
                    },
                  ]);
                  await startDownload(it.appPublicId);
                }}
                disabled={
                  it.salesFormat === "サブスク" && !it.isSubscriptionActive
                }
                title={
                  it.salesFormat === "サブスク" && !it.isSubscriptionActive
                    ? "サブスクが解約済みのためダウンロードできません"
                    : undefined
                }
              >
                <span>ダウンロード</span>
                <Image
                  src="/images/download.png"
                  alt="ダウンロード"
                  width={663}
                  height={615}
                />
              </button>
            </li>
            {it.salesFormat === "サブスク" && (
              <li>
                {it.isSubscriptionActive ? (
                  <button
                    type="button"
                    className={styles.actionMenuItem}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onClickCancelSubscription(it);
                    }}
                  >
                    <span>サブスク解除</span>
                    <Image
                      src="/images/remove.png"
                      alt="サブスク解除"
                      width={783}
                      height={783}
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.actionMenuItem}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onClickRestartSubscription(it);
                    }}
                  >
                    <span>サブスク再開</span>
                    <Image
                      src="/images/cart.png"
                      alt="サブスク再開"
                      width={958}
                      height={951}
                    />
                  </button>
                )}
              </li>
            )}
            <li>
              {it.hasReviewed ? (
                <a
                  href={`/apps/${it.appPublicId}/reviews/edit`}
                  className={styles.actionMenuItem}
                >
                  <span>評価を編集</span>
                  <Image
                    src="/images/rating.png"
                    alt="評価を編集"
                    width={252}
                    height={252}
                  />
                </a>
              ) : (
                <a
                  href={`/apps/${it.appPublicId}/reviews/new`}
                  className={styles.actionMenuItem}
                >
                  <span>評価</span>
                  <Image
                    src="/images/rating.png"
                    alt="評価"
                    width={252}
                    height={252}
                  />
                </a>
              )}
            </li>
            <li>
              <button
                type="button"
                className={styles.actionMenuItem}
                onClick={(e) => {
                  e.stopPropagation();
                  onHide(it);
                }}
              >
                <span>非表示</span>
                <Image
                  src="/images/hidden.png"
                  alt="非表示"
                  width={277}
                  height={276}
                />
              </button>
            </li>
          </ul>
        </div>
      </FloatingPortal>
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────────
interface PurchasesClientProps {
  initialItems: PurchaseItem[];
}

export default function PurchasesClient({
  initialItems,
}: PurchasesClientProps) {
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [items, setItems] = useState<PurchaseItem[]>(initialItems);
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const [displayMode, setDisplayMode] = useState<ViewMode>(getInitialViewMode);
  const [viewVisible, setViewVisible] = useState(true);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [activeSortIndex, setActiveSortIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [, setShowSuccess] = useState(false);
  const [hiddenAppIds, setHiddenAppIds] = useState<string[]>([]);
  const [hideTargetItem, setHideTargetItem] = useState<PurchaseItem | null>(
    null,
  );
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<PurchasesFilters>(() =>
    parsePurchasesFilters(searchParams),
  );
  const [draftFilters, setDraftFilters] = useState<PurchasesFilters>(filters);
  const [pendingReset, setPendingReset] = useState(false);
  const [subscriptionTargetItem, setSubscriptionTargetItem] =
    useState<PurchaseItem | null>(null);
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

  const availableTags = useMemo(() => {
    const map = new Map<number, string>();
    items.forEach((item) => {
      item.tags?.forEach((tag) => {
        if (!map.has(tag.id)) map.set(tag.id, tag.name);
      });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      setShowSuccess(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("status");
      const qs = params.toString();
      router.replace(qs ? `/mypage/purchases?${qs}` : "/mypage/purchases");
    }
  }, [searchParams, router]);

  useEffect(() => {
    setLocalStorage(MYPAGE_VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === displayMode) {
      setViewVisible(true);
      return;
    }
    setViewVisible(false);
    const timer = window.setTimeout(() => {
      setDisplayMode(viewMode);
      window.requestAnimationFrame(() => setViewVisible(true));
    }, 170);
    return () => window.clearTimeout(timer);
  }, [viewMode, displayMode]);

  useEffect(() => {
    const restored = parsePurchasesFilters(searchParams);
    setFilters((current) =>
      arePurchasesFiltersEqual(current, restored) ? current : restored,
    );
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    applyPurchasesFiltersToParams(params, filters);
    const currentQuery = searchParams.toString();
    const nextQuery = params.toString();
    if (currentQuery === nextQuery) return;
    router.replace(nextQuery ? `?${nextQuery}` : "?", { scroll: false });
  }, [filters, router, searchParams]);

  // sortMenu外クリック（actionMenuはPurchaseItemRow側で管理するので不要）
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (
        sortMenuOpen &&
        sortMenuRef.current &&
        !sortMenuRef.current.contains(target) &&
        !target.closest(".sort")
      ) {
        setSortMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sortMenuOpen]);

  const { setControls } = useMypageAppsHeaderControls();

  const updateSortIndicator = useCallback((index: number) => {
    if (!sortMenuRef.current) return;
    const menuItems = sortMenuRef.current.querySelectorAll(
      `.${styles.sortMenuItem}`,
    );
    const targetItem = menuItems[index] as HTMLElement;
    const indicator = sortMenuRef.current.querySelector(
      `.${styles.sortMenuIndicator}`,
    ) as HTMLElement;
    if (!targetItem || !indicator) return;
    const menuRect = sortMenuRef.current.getBoundingClientRect();
    const itemRect = targetItem.getBoundingClientRect();
    const paddingTop = parseFloat(
      getComputedStyle(sortMenuRef.current).paddingTop,
    );
    indicator.style.transform = `translateY(${itemRect.top - menuRect.top - paddingTop}px)`;
  }, []);

  const handleViewChange = useCallback(
    (mode: ViewMode) => {
      if (mode === viewMode) return;
      setViewMode(mode);
    },
    [viewMode],
  );

  const handleSort = useCallback(
    (index: number) => {
      setActiveSortIndex(index);
      updateSortIndicator(index);
    },
    [updateSortIndicator],
  );

  const openFilterModal = useCallback(() => {
    setDraftFilters(filters);
    setPendingReset(false);
    setFilterModalOpen(true);
  }, [filters]);

  const handleFilterModalOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setDraftFilters(filters);
        setPendingReset(false);
      } else if (pendingReset) {
        setFilters(draftFilters);
        setPendingReset(false);
      } else {
        setPendingReset(false);
      }
      setFilterModalOpen(open);
    },
    [draftFilters, filters, pendingReset],
  );

  const handleFilterReset = useCallback(() => {
    setDraftFilters(DEFAULT_PURCHASES_FILTERS);
    setPendingReset(true);
  }, []);

  const handleFilterApply = useCallback(() => {
    setFilters(draftFilters);
    setFilterModalOpen(false);
    setPendingReset(false);
  }, [draftFilters]);

  useEffect(() => {
    setControls({
      left: (
        <div className={styles.listController} style={{ marginLeft: "1rem" }}>
          <button
            className={styles.filter}
            type="button"
            aria-label="フィルター"
            onClick={openFilterModal}
          >
            <Image
              src="/images/filter.png"
              width={1169}
              height={1169}
              alt="フィルター"
            />
          </button>
          <div className={styles.sortMenuCont}>
            <button
              className={styles.sort}
              type="button"
              aria-label="並べ替え"
              onClick={() => setSortMenuOpen((v) => !v)}
            >
              <Image
                src="/images/sort.png"
                width={1242}
                height={1144}
                alt="並べ替え"
              />
            </button>
            <div
              ref={sortMenuRef}
              className={cn(styles.sortMenu, { [styles.show]: sortMenuOpen })}
            >
              <div className={styles.sortMenuIndicator} />
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {["新しい順", "古い順", "値段順", "高評価順"].map(
                  (label, index) => (
                    <li key={label}>
                      <button
                        type="button"
                        className={cn(styles.sortMenuItem, {
                          [styles.active]: index === activeSortIndex,
                        })}
                        onClick={() => handleSort(index)}
                      >
                        <span>{label}</span>
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>
        </div>
      ),
      right: (
        <>
          <div className={styles.searchBar}>
            <form action="#" onSubmit={(e) => e.preventDefault()}>
              <button type="submit" aria-label="検索">
                <Image
                  src="/images/search.png"
                  width={1270}
                  height={1270}
                  alt="検索"
                />
              </button>
              <input
                type="text"
                id="search-input"
                name="search"
                placeholder=""
                autoComplete="off"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
          </div>
          <ViewModeToggle
            mode={viewMode}
            onChange={handleViewChange}
            className={styles.viewToggle}
          />
        </>
      ),
    });
  }, [
    activeSortIndex,
    sortMenuOpen,
    search,
    viewMode,
    handleSort,
    handleViewChange,
    openFilterModal,
    setControls,
  ]);

  const filteredSortedItems = useMemo(() => {
    let filtered = items.filter((it) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        it.appName.toLowerCase().includes(q) ||
        (it.appDescription ?? "").toLowerCase().includes(q)
      );
    });
    if (filters.priceRange !== "all") {
      filtered = filtered.filter((it) => {
        const price = it.price || 0;
        if (filters.priceRange === "low") return price > 0 && price <= 1000;
        if (filters.priceRange === "mid") return price > 1000 && price <= 5000;
        return price > 5000;
      });
    }
    if (filters.salesFormat === "buy")
      filtered = filtered.filter((it) => it.salesFormat === "買い切り");
    else if (filters.salesFormat === "sub")
      filtered = filtered.filter((it) => it.salesFormat === "サブスク");
    if (filters.activeSubscriptionOnly) {
      filtered = filtered.filter(
        (it) =>
          it.salesFormat !== "サブスク" ||
          it.isSubscriptionActive === undefined ||
          it.isSubscriptionActive,
      );
    }
    if (filters.highRatingOnly)
      filtered = filtered.filter((it) => (it.rating ?? 0) >= 4);
    if (filters.listingTypes.length > 0) {
      filtered = filtered.filter((it) =>
        filters.listingTypes.includes(it.listingType ?? "bewt"),
      );
    }
    if (filters.tagIds.length > 0) {
      filtered = filtered.filter(
        (it) =>
          it.tags?.some((tag) => filters.tagIds.includes(tag.id)) ?? false,
      );
    }
    const sorted = [...filtered];
    switch (activeSortIndex) {
      case 0:
        sorted.sort(
          (a, b) =>
            new Date(b.purchasedAt).getTime() -
            new Date(a.purchasedAt).getTime(),
        );
        break;
      case 1:
        sorted.sort(
          (a, b) =>
            new Date(a.purchasedAt).getTime() -
            new Date(b.purchasedAt).getTime(),
        );
        break;
      case 2:
        sorted.sort((a, b) => a.price - b.price);
        break;
    }
    return sorted.filter((it) => !hiddenAppIds.includes(it.appPublicId));
  }, [items, search, filters, activeSortIndex, hiddenAppIds]);

  const formatPrice = (it: PurchaseItem) => {
    const p = `¥${it.price.toLocaleString()}`;
    if (it.salesFormat === "サブスク") {
      return (
        <>
          {p}
          <span className={styles.subscriptionSuffix}>/月</span>
        </>
      );
    }
    return p;
  };

  const formatYMD = (d: string | Date) => {
    const date = new Date(d);
    return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月${String(date.getDate()).padStart(2, "0")}日`;
  };

  const openCancelSubscriptionModal = useCallback((item: PurchaseItem) => {
    setSubscriptionTargetItem(item);
    setSubscriptionErrorMessage(null);
    setSubscriptionModalState("cancelConfirm");
  }, []);

  const openRestartSubscriptionModal = useCallback((item: PurchaseItem) => {
    setSubscriptionTargetItem(item);
    setSubscriptionErrorMessage(null);
    setSubscriptionModalState("restartConfirm");
  }, []);

  const handleConfirmCancelSubscription = useCallback(async () => {
    if (!subscriptionTargetItem) return;
    try {
      setIsCancellingSubscription(true);
      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appPublicId: subscriptionTargetItem.appPublicId,
        }),
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        throw new Error(await res.text());
      }

      setItems((prev) =>
        prev.map((it) =>
          it.id === subscriptionTargetItem.id
            ? { ...it, isSubscriptionActive: false }
            : it,
        ),
      );
      setSubscriptionTargetItem((prev) =>
        prev ? { ...prev, isSubscriptionActive: false } : prev,
      );
      setSubscriptionModalState("cancelDone");
    } catch (error) {
      console.error("Failed to cancel subscription", error);
      setSubscriptionErrorMessage(
        "サブスク解除に失敗しました。時間をおいて再度お試しください。",
      );
    } finally {
      setIsCancellingSubscription(false);
    }
  }, [subscriptionTargetItem]);

  const handleConfirmRestartSubscription = useCallback(async () => {
    if (!subscriptionTargetItem) return;
    try {
      setIsRestartingSubscription(true);
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appPublicId: subscriptionTargetItem.appPublicId,
          salesFormat: "S",
        }),
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        throw new Error(await res.text());
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cart:updated"));
      }

      setSubscriptionModalState("idle");
      router.push("/checkout");
    } catch (error) {
      console.error("Failed to restart subscription", error);
      setSubscriptionErrorMessage(
        "サブスク再開に失敗しました。時間をおいて再度お試しください。",
      );
    } finally {
      setIsRestartingSubscription(false);
    }
  }, [router, subscriptionTargetItem]);

  const isSubscriptionModalOpen = subscriptionModalState !== "idle";
  const isCancelFlow =
    subscriptionModalState === "cancelConfirm" ||
    subscriptionModalState === "cancelDone";

  const modalTitle = isCancelFlow ? "サブスク解除" : "サブスク再開";
  const modalDescription = isCancelFlow
    ? "このアプリのサブスクを解除します"
    : "このアプリのサブスクを再開します";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkSessionStorage = () => {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (!key?.startsWith("reviewed:")) continue;
          const publicId = key.slice("reviewed:".length);
          if (!publicId) continue;
          keysToRemove.push(key);
          setItems((prev) =>
            prev.map((it) =>
              it.appPublicId === publicId ? { ...it, hasReviewed: true } : it,
            ),
          );
        }
        keysToRemove.forEach((k) => {
          sessionStorage.removeItem(k);
        });
      } catch {
        /* ignore */
      }
    };
    checkSessionStorage();
    window.addEventListener("focus", checkSessionStorage);
    document.addEventListener("visibilitychange", checkSessionStorage);
    const handler = (e: Event) => {
      try {
        const publicId = (e as CustomEvent)?.detail?.appPublicId;
        if (!publicId) return;
        setItems((prev) =>
          prev.map((it) =>
            it.appPublicId === publicId ? { ...it, hasReviewed: true } : it,
          ),
        );
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("review:updated", handler as EventListener);
    return () => {
      window.removeEventListener("focus", checkSessionStorage);
      document.removeEventListener("visibilitychange", checkSessionStorage);
      window.removeEventListener("review:updated", handler as EventListener);
    };
  }, []);

  return (
    <DownloadProvider>
      <div className={styles.mypageContent}>
        <main>
          {filteredSortedItems.length > 0 && (
            <div
              data-view-visible={viewVisible ? "true" : "false"}
              className={cn(styles.apps, {
                [styles.gridView]: displayMode === "grid",
                [styles.cardView]: displayMode === "card",
              })}
            >
              {filteredSortedItems.map((it) => (
                <PurchaseItemRow
                  key={it.id}
                  it={it}
                  search={search}
                  viewMode={displayMode}
                  onHide={setHideTargetItem}
                  onClickCancelSubscription={openCancelSubscriptionModal}
                  onClickRestartSubscription={openRestartSubscriptionModal}
                  formatPrice={formatPrice}
                  formatYMD={formatYMD}
                />
              ))}
            </div>
          )}
          <p
            className={cn(styles.noResults, {
              [styles.visible]: filteredSortedItems.length === 0,
            })}
          >
            {items.length === 0
              ? "購入したアプリはありません"
              : "該当するアプリが見つかりませんでした"}
          </p>
        </main>
      </div>
      <Modal
        open={isSubscriptionModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSubscriptionModalState("idle");
            setSubscriptionErrorMessage(null);
            setSubscriptionTargetItem(null);
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
            {subscriptionTargetItem && (
              <p className={styles.modalAppName}>
                {subscriptionTargetItem.appName}
              </p>
            )}
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
                  setSubscriptionTargetItem(null);
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
      <ConfirmModal
        open={!!hideTargetItem}
        title="アプリを非表示にしますか？"
        message="設定画面から再表示できます。"
        appName={hideTargetItem?.appName}
        confirmLabel="非表示にする"
        cancelLabel="キャンセル"
        onConfirm={async () => {
          if (!hideTargetItem) return;
          try {
            const res = await fetch(
              `/api/apps/${hideTargetItem.appPublicId}/hidden`,
              { method: "POST" },
            );
            if (res.status === 401) {
              window.location.href = "/login";
              return;
            }
            if (!res.ok) {
              console.error("failed to hide app", await res.text());
              return;
            }
            setHiddenAppIds((prev) =>
              prev.includes(hideTargetItem.appPublicId)
                ? prev
                : [...prev, hideTargetItem.appPublicId],
            );
          } catch (e) {
            console.error("failed to hide app", e);
          } finally {
            setHideTargetItem(null);
          }
        }}
        onCancel={() => setHideTargetItem(null)}
      />
      <FilterModal
        open={filterModalOpen}
        onOpenChange={handleFilterModalOpenChange}
        onReset={handleFilterReset}
        onApply={handleFilterApply}
      >
        {availableTags.length > 0 && (
          <section className={filterModalStyles.section}>
            <h2 className={filterModalStyles.sectionTitle}>タグ</h2>
            <TagFilterPicker
              tags={availableTags}
              selectedTagIds={draftFilters.tagIds}
              onChange={(ids) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  tagIds: ids.map((id) =>
                    typeof id === "number" ? id : Number(id),
                  ),
                }))
              }
            />
          </section>
        )}
        <section className={filterModalStyles.section}>
          <h2 className={filterModalStyles.sectionTitle}>価格</h2>
          <div className={filterModalStyles.chipRow}>
            {(["all", "low", "mid", "high"] as const).map((val) => (
              <button
                key={val}
                type="button"
                className={cn(
                  filterModalStyles.chipButton,
                  draftFilters.priceRange === val &&
                    filterModalStyles.chipButtonActive,
                )}
                onClick={() =>
                  setDraftFilters((prev) => ({ ...prev, priceRange: val }))
                }
              >
                <span>
                  {
                    {
                      all: "すべて",
                      low: "〜¥1,000",
                      mid: "¥1,001〜¥5,000",
                      high: "¥5,001以上",
                    }[val]
                  }
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className={filterModalStyles.section}>
          <h2 className={filterModalStyles.sectionTitle}>販売形式</h2>
          <div className={filterModalStyles.chipRow}>
            {(["all", "buy", "sub"] as const).map((val) => (
              <button
                key={val}
                type="button"
                className={cn(
                  filterModalStyles.chipButton,
                  draftFilters.salesFormat === val &&
                    filterModalStyles.chipButtonActive,
                )}
                onClick={() =>
                  setDraftFilters((prev) => ({ ...prev, salesFormat: val }))
                }
              >
                <span>
                  {{ all: "すべて", buy: "買い切り", sub: "サブスク" }[val]}
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className={filterModalStyles.section}>
          <h2 className={filterModalStyles.sectionTitle}>出品形式</h2>
          <div className={filterModalStyles.chipRow}>
            {(["bewt", "bewts"] as const).map((val) => (
              <button
                key={val}
                type="button"
                className={cn(
                  filterModalStyles.chipButton,
                  draftFilters.listingTypes.includes(val) &&
                    filterModalStyles.chipButtonActive,
                )}
                onClick={() =>
                  setDraftFilters((prev) => {
                    const has = prev.listingTypes.includes(val);
                    if (has && prev.listingTypes.length === 1) return prev;
                    return {
                      ...prev,
                      listingTypes: has
                        ? prev.listingTypes.filter((t) => t !== val)
                        : [...prev.listingTypes, val],
                    };
                  })
                }
              >
                <span>{{ bewt: "ビュート", bewts: "ビューズ" }[val]}</span>
              </button>
            ))}
          </div>
        </section>
        <section className={filterModalStyles.section}>
          <h2 className={filterModalStyles.sectionTitle}>サブスクの状態</h2>
          <div className={filterModalStyles.toggleRow}>
            <label className={filterModalStyles.toggleItem}>
              <input
                type="checkbox"
                checked={draftFilters.activeSubscriptionOnly}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    activeSubscriptionOnly: e.target.checked,
                  }))
                }
              />
              <span className={filterModalStyles.checkmark} />
              <span>サブスク継続中のみ表示</span>
            </label>
          </div>
        </section>
        <section className={filterModalStyles.section}>
          <h2 className={filterModalStyles.sectionTitle}>評価</h2>
          <div className={filterModalStyles.toggleRow}>
            <label className={filterModalStyles.toggleItem}>
              <input
                type="checkbox"
                checked={draftFilters.highRatingOnly}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    highRatingOnly: e.target.checked,
                  }))
                }
              />
              <span className={filterModalStyles.checkmark} />
              <span>高評価（★4以上）のみ</span>
            </label>
          </div>
        </section>
      </FilterModal>
    </DownloadProvider>
  );
}
