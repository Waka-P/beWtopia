"use client";
import { ConfirmModal } from "@/components/ConfirmModal";
import { FilterModal } from "@/components/FilterModal";
import filterModalStyles from "@/components/FilterModal.module.scss";
import { cn } from "@/lib/cn";
import { getLocalStorage, setLocalStorage } from "@/utils/localStorage";
import { toggleFavoriteOnServer } from "@/utils/toggleFavorite";
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
import { useCallback, useEffect, useMemo, useState } from "react";
import HighlightedText from "../../components/HighlightedText";
import SearchBar from "../../components/SearchBar/SearchBar";
import SortMenu, {
  type SortOption,
  SortUtils,
} from "../../components/SortMenu/SortMenu";
import { TagFilterPicker } from "../../components/TagFilterPicker";
import {
  type ViewMode,
  ViewModeToggle,
} from "../../components/ViewModeToggle/ViewModeToggle";
import commonStyles from "../common.module.scss";
import { useSearchHeaderControls } from "../headerContext";
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
  isBewtsProjectApp?: boolean;
  tags?: { id: number; name: string }[];
  owner?: { name: string; image: string | null } | null;
  _count: { purchases: number };
  isFavorite?: boolean;
};

type SearchAppFilters = {
  onlyFavorites: boolean;
  priceRange: "all" | "low" | "mid" | "high";
  format: "all" | "P" | "S";
  highRatingOnly: boolean;
  withSalesOnly: boolean;
  tagIds: number[];
  listingTypes: ("bewt" | "bewts")[];
};

const DEFAULT_SEARCH_APP_FILTERS: SearchAppFilters = {
  onlyFavorites: false,
  priceRange: "all",
  format: "all",
  highRatingOnly: false,
  withSalesOnly: false,
  tagIds: [],
  listingTypes: ["bewt", "bewts"],
};

const SEARCH_APP_LISTING_TYPE_ORDER: ("bewt" | "bewts")[] = ["bewt", "bewts"];

const parseSearchAppFilters = (params: {
  get: (key: string) => string | null;
}) => {
  const priceRangeValue = params.get("f_price");
  const priceRange: SearchAppFilters["priceRange"] =
    priceRangeValue === "low" ||
    priceRangeValue === "mid" ||
    priceRangeValue === "high"
      ? priceRangeValue
      : "all";

  const formatValue = params.get("f_format");
  const format: SearchAppFilters["format"] =
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
  const listingTypes = SEARCH_APP_LISTING_TYPE_ORDER.filter((value) =>
    listingTypesRaw.includes(value),
  );

  return {
    onlyFavorites: params.get("f_fav") === "1",
    priceRange,
    format,
    highRatingOnly: params.get("f_high") === "1",
    withSalesOnly: params.get("f_sales") === "1",
    tagIds,
    listingTypes:
      listingTypes.length > 0
        ? listingTypes
        : [...DEFAULT_SEARCH_APP_FILTERS.listingTypes],
  } satisfies SearchAppFilters;
};

const areSearchAppFiltersEqual = (a: SearchAppFilters, b: SearchAppFilters) =>
  a.onlyFavorites === b.onlyFavorites &&
  a.priceRange === b.priceRange &&
  a.format === b.format &&
  a.highRatingOnly === b.highRatingOnly &&
  a.withSalesOnly === b.withSalesOnly &&
  a.tagIds.length === b.tagIds.length &&
  a.tagIds.every((value, index) => value === b.tagIds[index]) &&
  a.listingTypes.length === b.listingTypes.length &&
  a.listingTypes.every((value, index) => value === b.listingTypes[index]);

const applySearchAppFiltersToParams = (
  params: URLSearchParams,
  filters: SearchAppFilters,
) => {
  if (filters.onlyFavorites) params.set("f_fav", "1");
  else params.delete("f_fav");

  if (filters.priceRange !== DEFAULT_SEARCH_APP_FILTERS.priceRange)
    params.set("f_price", filters.priceRange);
  else params.delete("f_price");

  if (filters.format !== DEFAULT_SEARCH_APP_FILTERS.format)
    params.set("f_format", filters.format);
  else params.delete("f_format");

  if (filters.highRatingOnly) params.set("f_high", "1");
  else params.delete("f_high");

  if (filters.withSalesOnly) params.set("f_sales", "1");
  else params.delete("f_sales");

  if (filters.tagIds.length > 0) params.set("f_tags", filters.tagIds.join(","));
  else params.delete("f_tags");

  const defaultTypes = DEFAULT_SEARCH_APP_FILTERS.listingTypes;
  const sameTypes =
    filters.listingTypes.length === defaultTypes.length &&
    filters.listingTypes.every((value, index) => value === defaultTypes[index]);
  if (sameTypes) params.delete("f_types");
  else params.set("f_types", filters.listingTypes.join(","));
};

// ── アイテム1件ごとのコンポーネント ──────────────────────────────
type SearchAppItemRowProps = {
  app: App;
  searchQuery: string;
  isFavorite: boolean;
  onToggleFavorite: (publicId: string) => void;
  onHideRequest: (app: App) => void;
  formatDate: (dateString: string) => string;
};

function SearchAppItemRow({
  app,
  searchQuery,
  isFavorite,
  onToggleFavorite,
  onHideRequest,
  formatDate,
}: SearchAppItemRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const { refs, floatingStyles } = useFloating({
    open: menuOpen,
    placement: "bottom-end",
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  });

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
  const purchaseCount = app._count?.purchases ?? 0;

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
          <div className={styles.userDateCont}>
            <div className={styles.ownerInfo}>
              <Image
                className={styles.ownerIcon}
                src={app.owner?.image || "/images/icon-default.png"}
                alt={app.owner?.name || "ユーザ"}
                width={24}
                height={24}
                unoptimized
              />
              <span className={styles.ownerName}>
                {app.owner?.name || "ユーザ"}
              </span>
            </div>
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
                className={cn(styles.actionMenuItem, styles.favoriteBtn, {
                  [styles.active]: isFavorite,
                })}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(app.publicId);
                }}
              >
                <span className={styles.favoriteLabel}>
                  {isFavorite ? "お気に入り中" : "お気に入り"}
                </span>
                <Image
                  className={styles.favoriteImg}
                  src={
                    isFavorite
                      ? "/images/favorite-filled.png"
                      : "/images/favorite.png"
                  }
                  alt={isFavorite ? "お気に入り中" : "お気に入り"}
                  width={16}
                  height={16}
                />
              </button>
            </li>
            <li>
              <button
                type="button"
                className={styles.actionMenuItem}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onHideRequest(app);
                }}
              >
                <span style={{ marginRight: "0.5rem" }}>非表示</span>
                <Image
                  src="/images/hidden.png"
                  alt="非表示"
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
interface SearchAppsClientProps {
  initialApps: App[];
}

const resolveViewMode = (value: string | null): ViewMode => {
  if (value === "list" || value === "grid" || value === "card") return value;
  return "card";
};

const SEARCH_VIEW_STORAGE_KEY = "bewtopia:viewMode:search";

const getInitialViewMode = () =>
  resolveViewMode(getLocalStorage<string>(SEARCH_VIEW_STORAGE_KEY, "card"));

export default function SearchAppsClient({
  initialApps,
}: SearchAppsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [apps] = useState<App[]>(initialApps);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const [displayMode, setDisplayMode] = useState<ViewMode>(getInitialViewMode);
  const [viewVisible, setViewVisible] = useState(true);
  const [sortedApps, setSortedApps] = useState<App[]>(initialApps);
  const [favoriteAppIds, setFavoriteAppIds] = useState<string[]>(
    initialApps.filter((app) => app.isFavorite).map((app) => app.publicId),
  );
  const [favoriteProcessingIds, setFavoriteProcessingIds] = useState<string[]>(
    [],
  );
  const [hiddenAppIds, setHiddenAppIds] = useState<string[]>([]);
  const [hideTargetApp, setHideTargetApp] = useState<App | null>(null);

  const { setControls } = useSearchHeaderControls();
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<SearchAppFilters>(() =>
    parseSearchAppFilters(searchParams),
  );
  const [draftFilters, setDraftFilters] = useState<SearchAppFilters>(filters);
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

  const sortOptions: SortOption<App>[] = useMemo(
    () => [
      {
        key: "newest",
        label: "新しい順",
        compareFn: SortUtils.sortByDateNewest,
      },
      { key: "oldest", label: "古い順", compareFn: SortUtils.sortByDateOldest },
      {
        key: "price_asc",
        label: "値段順",
        compareFn: (a, b) =>
          (a.salesPlans[0]?.price || 0) - (b.salesPlans[0]?.price || 0),
      },
      {
        key: "rating_desc",
        label: "高評価順",
        compareFn: (a, b) => Number(b.rating) - Number(a.rating),
      },
    ],
    [],
  );

  const currentSort = searchParams.get("sort") || "newest";

  const handleSortChange = useCallback(
    (key: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("sort", key);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

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
    if (filters.onlyFavorites) {
      result = result.filter((app) => favoriteAppIds.includes(app.publicId));
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
    if (filters.tagIds.length > 0) {
      result = result.filter(
        (app) =>
          app.tags?.some((tag) => filters.tagIds.includes(tag.id)) ?? false,
      );
    }
    if (filters.listingTypes.length > 0) {
      result = result.filter((app) =>
        filters.listingTypes.includes(app.isBewtsProjectApp ? "bewts" : "bewt"),
      );
    }
    if (filters.format !== "all") {
      result = result.filter((app) =>
        app.salesPlans.some((p) => p.salesFormat === filters.format),
      );
    }
    if (filters.highRatingOnly)
      result = result.filter((app) => Number(app.rating) >= 4);
    if (filters.withSalesOnly)
      result = result.filter((app) => (app._count?.purchases ?? 0) > 0);
    return result;
  }, [apps, searchQuery, filters, favoriteAppIds]);

  const visibleFilteredApps = useMemo(
    () => filteredApps.filter((app) => !hiddenAppIds.includes(app.publicId)),
    [filteredApps, hiddenAppIds],
  );

  useEffect(() => {
    setLocalStorage(SEARCH_VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const params = url.searchParams;
    if (searchQuery) {
      params.set("q", searchQuery);
    } else {
      params.delete("q");
    }
    const newSearch = params.toString();
    const currentPath = `${url.pathname}${url.search}`;
    const nextPath = `${url.pathname}${newSearch ? `?${newSearch}` : ""}`;
    if (currentPath !== nextPath) router.replace(nextPath, { scroll: false });
  }, [searchQuery, router]);

  useEffect(() => {
    const restored = parseSearchAppFilters(searchParams);
    setFilters((current) =>
      areSearchAppFiltersEqual(current, restored) ? current : restored,
    );
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    applySearchAppFiltersToParams(params, filters);
    const currentQuery = searchParams.toString();
    const nextQuery = params.toString();
    if (currentQuery === nextQuery) return;
    router.replace(nextQuery ? `?${nextQuery}` : "?", { scroll: false });
  }, [filters, router, searchParams]);

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

  const handleViewChange = useCallback(
    (mode: ViewMode) => {
      if (mode === viewMode) return;
      setViewMode(mode);
    },
    [viewMode],
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
    setDraftFilters(DEFAULT_SEARCH_APP_FILTERS);
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
        <div className={commonStyles.listController}>
          <button
            type="button"
            className={commonStyles.filter}
            onClick={openFilterModal}
          >
            <Image
              src="/images/filter.png"
              width={30}
              height={30}
              alt="フィルター"
            />
          </button>
          <div className={commonStyles.sortMenuCont}>
            <SortMenu
              items={visibleFilteredApps}
              options={sortOptions}
              onChange={setSortedApps}
              value={currentSort}
              onSortChange={handleSortChange}
            />
          </div>
        </div>
      ),
      right: (
        <>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            className={commonStyles.searchBar}
          />
          <ViewModeToggle
            mode={viewMode}
            onChange={handleViewChange}
            className={commonStyles.viewToggle}
          />
        </>
      ),
    });
  }, [
    visibleFilteredApps,
    sortOptions,
    currentSort,
    searchQuery,
    viewMode,
    handleSortChange,
    handleViewChange,
    setControls,
    openFilterModal,
  ]);

  const toggleFavorite = useCallback(
    async (appPublicId: string) => {
      if (favoriteProcessingIds.includes(appPublicId)) return;
      const nextIsFavorite = !favoriteAppIds.includes(appPublicId);
      setFavoriteProcessingIds((prev) => [...prev, appPublicId]);
      try {
        const data = await toggleFavoriteOnServer(appPublicId, nextIsFavorite);
        if (!data) return;
        setFavoriteAppIds((prev) => {
          const exists = prev.includes(appPublicId);
          if (data.isFavorite) return exists ? prev : [...prev, appPublicId];
          return exists ? prev.filter((id) => id !== appPublicId) : prev;
        });
      } catch (e) {
        console.error("failed to toggle favorite", e);
      } finally {
        setFavoriteProcessingIds((prev) =>
          prev.filter((id) => id !== appPublicId),
        );
      }
    },
    [favoriteAppIds, favoriteProcessingIds],
  );

  const handleHideConfirm = async () => {
    if (!hideTargetApp) return;
    try {
      const res = await fetch(`/api/apps/${hideTargetApp.publicId}/hidden`, {
        method: "POST",
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        console.error("failed to hide app", await res.text());
        return;
      }
      setHiddenAppIds((prev) =>
        prev.includes(hideTargetApp.publicId)
          ? prev
          : [...prev, hideTargetApp.publicId],
      );
    } catch (e) {
      console.error("failed to hide app", e);
    } finally {
      setHideTargetApp(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月${String(date.getDate()).padStart(2, "0")}日`;
  };

  return (
    <main>
      <div
        className={cn(
          styles.apps,
          { [styles.cardView]: displayMode === "card" },
          { [styles.gridView]: displayMode === "grid" },
          { [styles.fade]: !viewVisible },
        )}
      >
        {sortedApps.map((app) => {
          if (hiddenAppIds.includes(app.publicId)) return null;
          return (
            <SearchAppItemRow
              key={app.publicId}
              app={app}
              searchQuery={searchQuery}
              isFavorite={favoriteAppIds.includes(app.publicId)}
              onToggleFavorite={toggleFavorite}
              onHideRequest={setHideTargetApp}
              formatDate={formatDate}
            />
          );
        })}
      </div>

      <p
        className={cn(commonStyles.noResults, {
          [commonStyles.visible]: visibleFilteredApps.length === 0,
        })}
      >
        該当するアプリが見つかりませんでした
      </p>

      <ConfirmModal
        open={!!hideTargetApp}
        title="アプリを非表示にしますか？"
        message="設定画面から再表示できます。"
        appName={hideTargetApp?.name}
        confirmLabel="非表示にする"
        cancelLabel="キャンセル"
        onConfirm={handleHideConfirm}
        onCancel={() => setHideTargetApp(null)}
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
          <h2 className={filterModalStyles.sectionTitle}>お気に入り</h2>
          <div className={filterModalStyles.toggleRow}>
            <label className={filterModalStyles.toggleItem}>
              <input
                type="checkbox"
                checked={draftFilters.onlyFavorites}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    onlyFavorites: e.target.checked,
                  }))
                }
              />
              <span className={filterModalStyles.checkmark} />
              <span>お気に入りのみ</span>
            </label>
          </div>
        </section>
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
    </main>
  );
}
