"use client";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ErrorModal } from "@/components/ErrorModal";
import { FilterModal } from "@/components/FilterModal";
import filterModalStyles from "@/components/FilterModal.module.scss";
import { cn } from "@/lib/cn";
import { fetcher } from "@/utils/fetcher";
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
import Rating from "../../components/Rating";
import { TagFilterPicker } from "../../components/TagFilterPicker";
import {
  type ViewMode,
  ViewModeToggle,
} from "../../components/ViewModeToggle/ViewModeToggle";
import { useMypageAppsHeaderControls } from "../appsHeaderContext";
import styles from "./page.module.scss";

type App = {
  id: number;
  publicId: string;
  name: string;
  summary: string;
  rating: number;
  createdAt: string;
  appIconUrl: string | null;
  images: { imageUrl: string }[];
  salesPlans: { price: number; salesFormat: "P" | "S" }[];
  _count: { purchases: number };
  tags?: { id: number; name: string }[];
  isBewtsProjectApp?: boolean;
};

type ProductsFilters = {
  priceRange: "all" | "low" | "mid" | "high";
  format: "all" | "P" | "S";
  highRatingOnly: boolean;
  withSalesOnly: boolean;
  tagIds: number[];
  listingTypes: ("bewt" | "bewts")[];
};

const DEFAULT_PRODUCTS_FILTERS: ProductsFilters = {
  priceRange: "all",
  format: "all",
  highRatingOnly: false,
  withSalesOnly: false,
  tagIds: [],
  listingTypes: ["bewt", "bewts"],
};

const PRODUCT_LISTING_TYPE_ORDER: ("bewt" | "bewts")[] = ["bewt", "bewts"];

const parseProductsFilters = (params: {
  get: (key: string) => string | null;
}) => {
  const priceRangeValue = params.get("f_price");
  const priceRange: ProductsFilters["priceRange"] =
    priceRangeValue === "low" ||
    priceRangeValue === "mid" ||
    priceRangeValue === "high"
      ? priceRangeValue
      : "all";

  const formatValue = params.get("f_format");
  const format: ProductsFilters["format"] =
    formatValue === "P" || formatValue === "S" ? formatValue : "all";

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
  const listingTypes = PRODUCT_LISTING_TYPE_ORDER.filter((value) =>
    listingTypesRaw.includes(value),
  );

  return {
    priceRange,
    format,
    highRatingOnly: params.get("f_high") === "1",
    withSalesOnly: params.get("f_sales") === "1",
    tagIds,
    listingTypes:
      listingTypes.length > 0
        ? listingTypes
        : [...DEFAULT_PRODUCTS_FILTERS.listingTypes],
  } satisfies ProductsFilters;
};

const areProductsFiltersEqual = (a: ProductsFilters, b: ProductsFilters) =>
  a.priceRange === b.priceRange &&
  a.format === b.format &&
  a.highRatingOnly === b.highRatingOnly &&
  a.withSalesOnly === b.withSalesOnly &&
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

const applyProductsFiltersToParams = (
  params: URLSearchParams,
  filters: ProductsFilters,
) => {
  setOrDeleteParam(
    params,
    "f_price",
    filters.priceRange,
    filters.priceRange !== DEFAULT_PRODUCTS_FILTERS.priceRange,
  );
  setOrDeleteParam(
    params,
    "f_format",
    filters.format,
    filters.format !== DEFAULT_PRODUCTS_FILTERS.format,
  );
  setOrDeleteParam(params, "f_high", "1", filters.highRatingOnly);
  setOrDeleteParam(params, "f_sales", "1", filters.withSalesOnly);
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
    !areProductsFiltersEqual(
      { ...DEFAULT_PRODUCTS_FILTERS, listingTypes: filters.listingTypes },
      {
        ...DEFAULT_PRODUCTS_FILTERS,
        listingTypes: DEFAULT_PRODUCTS_FILTERS.listingTypes,
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
  const regex = new RegExp(
    `(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, index) => {
        if (part.toLowerCase() === keyword.toLowerCase()) {
          // biome-ignore lint: indexは安定している
          return <mark key={index}>{part}</mark>;
        }
        // biome-ignore lint: indexは安定している
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

// ── アイテム1件ごとのコンポーネント ──────────────────────────────
type AppItemRowProps = {
  app: App;
  searchQuery: string;
  onEdit: (publicId: string) => void;
  onDeleteRequest: (publicId: string, name: string) => void;
  formatDate: (dateString: string) => string;
};

function AppItemRow({
  app,
  searchQuery,
  onEdit,
  onDeleteRequest,
  formatDate,
}: AppItemRowProps) {
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

  const oneTimePlan = app.salesPlans.find((p) => p.salesFormat === "P");
  const subscriptionPlan = app.salesPlans.find((p) => p.salesFormat === "S");
  const purchaseCount = app._count.purchases;

  return (
    <div className={styles.app}>
      <Link href={`/apps/${app.publicId}`} className={styles.appInner}>
        <div className={styles.appHeader}>
          <div className={styles.appIcon}>
            <Image
              src={app.appIconUrl || "/images/icon-default.png"}
              alt={app.name}
              width={56}
              height={56}
              unoptimized
            />
            {purchaseCount > 0 && (
              <div className={styles.purchaseQuantity}>
                <div className={styles.inner}>
                  <span className={purchaseCount > 99 ? styles.max : ""}>
                    {purchaseCount > 99 ? "99" : purchaseCount}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className={styles.appInfo}>
            <h2 className={styles.appName}>
              <HighlightedText text={app.name} keyword={searchQuery} />
            </h2>
            <p className={styles.appDesc}>
              <HighlightedText text={app.summary} keyword={searchQuery} />
            </p>
          </div>
        </div>
        {app.images.length > 0 ? (
          <div className={styles.thumbnail}>
            <Image
              src={app.images[0].imageUrl}
              alt="サムネイル"
              width={600}
              height={322}
              unoptimized
            />
          </div>
        ) : (
          <div className={cn(styles.thumbnail, styles.noImage)}>NO IMAGE</div>
        )}
        <div className={styles.appFooter}>
          <p className={styles.appPrice}>
            {oneTimePlan && (
              <>
                ¥{oneTimePlan.price.toLocaleString()}
                {subscriptionPlan && <br />}
              </>
            )}
            {subscriptionPlan && (
              <>
                ¥{subscriptionPlan.price.toLocaleString()}
                <span className={styles.subscriptionSuffix}>/月</span>
              </>
            )}
            {!oneTimePlan && !subscriptionPlan && "¥0"}
          </p>
          <div className={styles.ratingDateCont}>
            <Rating value={app.rating} className={styles.rating} />
            <p className={styles.listingDate}>{formatDate(app.createdAt)}</p>
          </div>
        </div>
      </Link>

      {/* ドットボタン */}
      <button
        ref={refs.setReference}
        type="button"
        className={styles.actionMenuBtn}
        data-open={menuOpen ? "true" : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
      >
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </button>

      <FloatingPortal>
        {/* biome-ignore lint: div */}
        <div
          ref={refs.setFloating}
          className={cn(styles.actionMenu, menuOpen && styles.show)}
          style={{
            ...floatingStyles,
            pointerEvents: menuOpen ? "auto" : "none",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ul>
            <li>
              <button
                type="button"
                className={styles.actionMenuItem}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(app.publicId);
                }}
              >
                <span>編集</span>
                <Image
                  className={styles.editImg}
                  src="/images/edit.png"
                  alt="編集"
                  width={16}
                  height={16}
                />
              </button>
            </li>
            <li>
              <button
                type="button"
                className={cn(styles.actionMenuItem, styles.delete)}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDeleteRequest(app.publicId, app.name);
                }}
              >
                <span>削除</span>
                <Image
                  className={styles.deleteImg}
                  src="/images/delete.png"
                  alt="削除"
                  width={15}
                  height={15}
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
interface ProductsListProps {
  initialApps: App[];
}

export function ProductsList({ initialApps }: ProductsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [apps, setApps] = useState<App[]>(initialApps);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const [displayMode, setDisplayMode] = useState<ViewMode>(getInitialViewMode);
  const [viewVisible, setViewVisible] = useState(true);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [activeSortIndex, setActiveSortIndex] = useState(0);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [cachedDeleteTarget, setCachedDeleteTarget] = useState<{
    publicId: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortMenuRef = useRef<HTMLDivElement>(null);
  const { setControls } = useMypageAppsHeaderControls();
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<ProductsFilters>(() =>
    parseProductsFilters(searchParams),
  );
  const [draftFilters, setDraftFilters] = useState<ProductsFilters>(filters);
  const [pendingReset, setPendingReset] = useState(false);

  const availableTags = useMemo(() => {
    const map = new Map<number, string>();
    apps.forEach((app) => {
      app.tags?.forEach((tag) => {
        if (!map.has(tag.id)) map.set(tag.id, tag.name);
      });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [apps]);

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
    const restored = parseProductsFilters(searchParams);
    setFilters((current) =>
      areProductsFiltersEqual(current, restored) ? current : restored,
    );
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    applyProductsFiltersToParams(params, filters);
    const currentQuery = searchParams.toString();
    const nextQuery = params.toString();
    if (currentQuery === nextQuery) return;
    router.replace(nextQuery ? `?${nextQuery}` : "?", { scroll: false });
  }, [filters, router, searchParams]);

  // sortMenu外クリック（actionMenuはAppItemRow側で管理するので不要）
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

  const handleViewChange = useCallback(
    (mode: ViewMode) => {
      if (mode === viewMode) return;
      setViewMode(mode);
    },
    [viewMode],
  );

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

  const handleSort = useCallback(
    (index: number) => {
      setActiveSortIndex(index);
      updateSortIndicator(index);
    },
    [updateSortIndicator],
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月${String(date.getDate()).padStart(2, "0")}日`;
  };

  const handleEdit = useCallback(
    (appPublicId: string) => {
      router.push(`/apps/${appPublicId}/edit`);
    },
    [router],
  );

  const handleDeleteRequest = useCallback((publicId: string, name: string) => {
    setCachedDeleteTarget({ publicId, name });
    setDeleteTargetId(publicId);
  }, []);

  const handleDelete = async () => {
    if (cachedDeleteTarget === null) return;
    setDeleting(true);
    try {
      await fetcher(`/api/mypage/products/${cachedDeleteTarget.publicId}`, {
        method: "DELETE",
      });
      setApps((prev) =>
        prev.filter((app) => app.publicId !== cachedDeleteTarget.publicId),
      );
      setDeleteTargetId(null);
    } catch (err) {
      console.error("Delete failed:", err);
      setErrorMessage("削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => setDeleteTargetId(null);

  const handleModalClosed = () => {
    if (deleteTargetId === null) setCachedDeleteTarget(null);
  };

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
    setDraftFilters(DEFAULT_PRODUCTS_FILTERS);
    setPendingReset(true);
  }, []);

  const handleFilterApply = useCallback(() => {
    setFilters(draftFilters);
    setFilterModalOpen(false);
    setPendingReset(false);
  }, [draftFilters]);

  useEffect(() => {
    const sortLabels = ["新しい順", "古い順", "値段順", "高評価順"];
    setControls({
      left: (
        <div className={styles.listController}>
          <button
            type="button"
            className={styles.filter}
            onClick={openFilterModal}
          >
            <Image
              src="/images/filter.png"
              width={30}
              height={30}
              alt="フィルター"
            />
          </button>
          <div className={styles.sortMenuCont}>
            <button
              type="button"
              className={styles.sort}
              onClick={() => setSortMenuOpen(!sortMenuOpen)}
            >
              <Image
                src="/images/sort.png"
                width={30}
                height={30}
                alt="並べ替え"
              />
            </button>
            <div
              ref={sortMenuRef}
              className={cn(styles.sortMenu, { [styles.show]: sortMenuOpen })}
            >
              <div className={styles.sortMenuIndicator} />
              <ul>
                {sortLabels.map((label, index) => (
                  // biome-ignore lint: indexが変化することはないため
                  <li key={index}>
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
                ))}
              </ul>
            </div>
          </div>
        </div>
      ),
      right: (
        <>
          <div className={styles.searchBar}>
            <form onSubmit={(e) => e.preventDefault()}>
              <button type="submit">
                <Image
                  src="/images/search.png"
                  width={20}
                  height={20}
                  alt="検索"
                />
              </button>
              <input
                type="text"
                placeholder=""
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
    searchQuery,
    viewMode,
    handleSort,
    handleViewChange,
    openFilterModal,
    setControls,
  ]);

  const filteredApps = useMemo(() => {
    let result = apps;
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (app) =>
          app.name.toLowerCase().includes(query) ||
          app.summary.toLowerCase().includes(query),
      );
    }
    if (filters.priceRange !== "all") {
      result = result.filter((app) => {
        if (!app.salesPlans.length) return true;
        const minPrice = Math.min(...app.salesPlans.map((p) => p.price || 0));
        if (filters.priceRange === "low")
          return minPrice > 0 && minPrice <= 1000;
        if (filters.priceRange === "mid")
          return minPrice > 1000 && minPrice <= 5000;
        return minPrice > 5000;
      });
    }
    if (filters.format !== "all") {
      result = result.filter((app) =>
        app.salesPlans.some((p) => p.salesFormat === filters.format),
      );
    }
    if (filters.listingTypes.length > 0) {
      result = result.filter((app) =>
        filters.listingTypes.includes(app.isBewtsProjectApp ? "bewts" : "bewt"),
      );
    }
    if (filters.highRatingOnly)
      result = result.filter((app) => Number(app.rating) >= 4);
    if (filters.withSalesOnly)
      result = result.filter((app) => (app._count?.purchases ?? 0) > 0);
    if (filters.tagIds.length > 0) {
      result = result.filter(
        (app) =>
          app.tags?.some((tag) => filters.tagIds.includes(tag.id)) ?? false,
      );
    }
    return result;
  }, [apps, searchQuery, filters]);

  const sortedFilteredApps = useMemo(() => {
    const sorted = [...filteredApps];
    switch (activeSortIndex) {
      case 0:
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      case 1:
        sorted.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        break;
      case 2:
        sorted.sort(
          (a, b) =>
            (a.salesPlans[0]?.price || 0) - (b.salesPlans[0]?.price || 0),
        );
        break;
      case 3:
        sorted.sort((a, b) => Number(b.rating) - Number(a.rating));
        break;
    }
    return sorted;
  }, [filteredApps, activeSortIndex]);

  return (
    <div className={styles.mypageContent}>
      <main>
        <div
          data-view-visible={viewVisible ? "true" : "false"}
          className={cn(styles.apps, {
            [styles.cardView]: displayMode === "card",
            [styles.gridView]: displayMode === "grid",
          })}
        >
          {sortedFilteredApps.map((app) => (
            <AppItemRow
              key={app.publicId}
              app={app}
              searchQuery={searchQuery}
              onEdit={handleEdit}
              onDeleteRequest={handleDeleteRequest}
              formatDate={formatDate}
            />
          ))}
        </div>
        <p
          className={cn(styles.noResults, {
            [styles.visible]: sortedFilteredApps.length === 0,
          })}
        >
          {apps.length === 0
            ? "出品したアプリはありません"
            : "該当するアプリが見つかりませんでした"}
        </p>
      </main>

      <ConfirmModal
        open={deleteTargetId !== null}
        message="このアプリを削除しますか？"
        appName={cachedDeleteTarget?.name || ""}
        onConfirm={handleDelete}
        onCancel={handleDeleteCancel}
        onAnimationEnd={handleModalClosed}
        confirmLabel={deleting ? "削除中..." : "削除"}
        cancelLabel="キャンセル"
      />
      <ErrorModal
        open={!!errorMessage}
        title="アプリ削除エラー"
        message={errorMessage ?? ""}
        onClose={() => setErrorMessage(null)}
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
          <div className={filterModalStyles.toggleRow}>
            {(["all", "P", "S"] as const).map((val) => (
              <button
                key={val}
                type="button"
                className={cn(
                  filterModalStyles.chipButton,
                  draftFilters.format === val &&
                    filterModalStyles.chipButtonActive,
                )}
                onClick={() =>
                  setDraftFilters((prev) => ({ ...prev, format: val }))
                }
              >
                <span>
                  {{ all: "すべて", P: "買い切り", S: "サブスク" }[val]}
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
        <section className={filterModalStyles.section}>
          <h2 className={filterModalStyles.sectionTitle}>販売実績</h2>
          <div className={filterModalStyles.toggleRow}>
            <label className={filterModalStyles.toggleItem}>
              <input
                type="checkbox"
                checked={draftFilters.withSalesOnly}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    withSalesOnly: e.target.checked,
                  }))
                }
              />
              <span className={filterModalStyles.checkmark} />
              <span>購入実績ありのみ</span>
            </label>
          </div>
        </section>
      </FilterModal>
    </div>
  );
}
