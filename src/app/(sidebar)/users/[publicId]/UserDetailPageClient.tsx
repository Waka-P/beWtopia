"use client";

import AppCard from "@/app/(sidebar)/components/AppCard";
import { ChatOrderModal } from "@/app/(sidebar)/components/ChatOrderModal";
import { ChatScoutModal } from "@/app/(sidebar)/components/ChatScoutModal";
import Rating from "@/app/(sidebar)/components/Rating";
import { useTabIndicator } from "@/app/(sidebar)/components/useTabIndicator";
import { WcoinTipModal } from "@/app/(sidebar)/components/WcoinTipModal";
import homeStyles from "@/app/(sidebar)/home.module.scss";
import commonStyles from "@/app/(sidebar)/search/common.module.scss";
import Avatar from "@/components/Avatar";
import {
  BlockUserConfirmModal,
  UserConfirmModal,
} from "@/components/BlockUserConfirmModal";
import { FilterModal } from "@/components/FilterModal";
import filterModalStyles from "@/components/FilterModal.module.scss";
import { fetcher } from "@/utils/fetcher";
import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TagFilterPicker } from "../../components/TagFilterPicker";
import styles from "./page.module.scss";

export type UserDetailApp = {
  id: number;
  publicId: string;
  name: string;
  summary: string;
  description: string;
  rating: number;
  iconUrl: string | null;
  thumbnailUrl: string | null;
  // 検索画面と同じフィルタ項目を扱うための追加情報（存在しない場合もある）
  salesPlans?: { price: number; salesFormat: "P" | "S" }[];
  _count?: {
    purchases: number;
  };
  tags?: { id: number; name: string }[];
  isBewtsProjectApp?: boolean;
};

export type UserDetailReview = {
  id: number;
  rating: number;
  text: string;
  app: {
    id: number;
    publicId: string;
    name: string;
    summary: string;
    iconUrl: string | null;
  };
};

export type UserDetailPrivacyActions = {
  follow: boolean;
  order: boolean;
  scout: boolean;
  tip: boolean;
};

export type UserDetailData = {
  id: number;
  publicId: string;
  name: string;
  image: string | null;
  rating: number;
  followerCount: number;
  isFollowing: boolean;
  isBlocked: boolean;
  isMe: boolean;
  isBlockedBy: boolean;
  occupation: string;
  achievements: string;
  externalLinks: string[];
  selfIntro: string;
  tags: string[];
  privacyActions: UserDetailPrivacyActions;
  apps: UserDetailApp[];
  reviews: UserDetailReview[];
};

export type UserDetailPageClientProps = {
  data: UserDetailData;
  preview?: boolean;
};

type AppsFilters = {
  onlyFavorites: boolean;
  priceRange: "all" | "low" | "mid" | "high";
  format: "all" | "P" | "S";
  highRatingOnly: boolean;
  withSalesOnly: boolean;
  tagIds: number[];
  listingTypes: ("bewt" | "bewts")[];
};

type ReviewsFilters = {
  goodOnly: boolean;
};

const DEFAULT_APPS_FILTERS: AppsFilters = {
  onlyFavorites: false,
  priceRange: "all",
  format: "all",
  highRatingOnly: false,
  withSalesOnly: false,
  tagIds: [],
  listingTypes: ["bewt", "bewts"],
};

const DEFAULT_REVIEWS_FILTERS: ReviewsFilters = {
  goodOnly: false,
};

const parseAppsFilters = (params: { get: (key: string) => string | null }) => {
  const priceRangeValue = params.get("fa_price");
  const priceRange: AppsFilters["priceRange"] =
    priceRangeValue === "low" ||
    priceRangeValue === "mid" ||
    priceRangeValue === "high"
      ? priceRangeValue
      : "all";

  const formatValue = params.get("fa_format");
  const format: AppsFilters["format"] =
    formatValue === "P" || formatValue === "S" ? formatValue : "all";

  const tagIds = (params.get("fa_tags") ?? "")
    .split(",")
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b);

  const listingTypesRaw = (params.get("fa_types") ?? "")
    .split(",")
    .filter(
      (value): value is "bewt" | "bewts" =>
        value === "bewt" || value === "bewts",
    );
  const listingTypes = ["bewt", "bewts"].filter((value) =>
    listingTypesRaw.includes(value as "bewt" | "bewts"),
  ) as ("bewt" | "bewts")[];

  return {
    onlyFavorites: params.get("fa_fav") === "1",
    priceRange,
    format,
    highRatingOnly: params.get("fa_high") === "1",
    withSalesOnly: params.get("fa_sales") === "1",
    tagIds,
    listingTypes:
      listingTypes.length > 0
        ? listingTypes
        : [...DEFAULT_APPS_FILTERS.listingTypes],
  } satisfies AppsFilters;
};

const parseReviewsFilters = (params: { get: (key: string) => string | null }) =>
  ({
    goodOnly: params.get("fr_good") === "1",
  }) satisfies ReviewsFilters;

const areAppsFiltersEqual = (a: AppsFilters, b: AppsFilters) =>
  a.onlyFavorites === b.onlyFavorites &&
  a.priceRange === b.priceRange &&
  a.format === b.format &&
  a.highRatingOnly === b.highRatingOnly &&
  a.withSalesOnly === b.withSalesOnly &&
  a.tagIds.length === b.tagIds.length &&
  a.tagIds.every((value, index) => value === b.tagIds[index]) &&
  a.listingTypes.length === b.listingTypes.length &&
  a.listingTypes.every((value, index) => value === b.listingTypes[index]);

const areReviewsFiltersEqual = (a: ReviewsFilters, b: ReviewsFilters) =>
  a.goodOnly === b.goodOnly;

const applyAppsFiltersToParams = (
  params: URLSearchParams,
  filters: AppsFilters,
) => {
  if (filters.onlyFavorites) params.set("fa_fav", "1");
  else params.delete("fa_fav");

  if (filters.priceRange !== DEFAULT_APPS_FILTERS.priceRange)
    params.set("fa_price", filters.priceRange);
  else params.delete("fa_price");

  if (filters.format !== DEFAULT_APPS_FILTERS.format)
    params.set("fa_format", filters.format);
  else params.delete("fa_format");

  if (filters.highRatingOnly) params.set("fa_high", "1");
  else params.delete("fa_high");

  if (filters.withSalesOnly) params.set("fa_sales", "1");
  else params.delete("fa_sales");

  if (filters.tagIds.length > 0)
    params.set("fa_tags", filters.tagIds.join(","));
  else params.delete("fa_tags");

  const defaultTypes = DEFAULT_APPS_FILTERS.listingTypes;
  const sameTypes =
    filters.listingTypes.length === defaultTypes.length &&
    filters.listingTypes.every((value, index) => value === defaultTypes[index]);
  if (sameTypes) params.delete("fa_types");
  else params.set("fa_types", filters.listingTypes.join(","));
};

const applyReviewsFiltersToParams = (
  params: URLSearchParams,
  filters: ReviewsFilters,
) => {
  if (filters.goodOnly) params.set("fr_good", "1");
  else params.delete("fr_good");
};

export default function UserDetailPageClient({
  data,
  preview = false,
}: UserDetailPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"apps" | "reviews">("apps");
  const [favoriteAppIds, setFavoriteAppIds] = useState<number[]>([]);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState<boolean>(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showToggle, setShowToggle] = useState(false);
  const [followerCount, setFollowerCount] = useState<number>(
    data.followerCount ?? 0,
  );
  const [isFollowing, setIsFollowing] = useState<boolean>(
    data.isFollowing ?? false,
  );
  const [isFollowHover, setIsFollowHover] = useState(false);
  const [followProcessing, setFollowProcessing] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [activeSortIndex, setActiveSortIndex] = useState(0);
  const [sortedApps, setSortedApps] = useState<UserDetailApp[]>(
    () => data.apps,
  );
  const [isBlocked, setIsBlocked] = useState<boolean>(data.isBlocked ?? false);
  const [blockProcessing, setBlockProcessing] = useState(false);
  const privacyActions: UserDetailPrivacyActions = data.privacyActions ?? {
    follow: false,
    order: false,
    scout: false,
    tip: false,
  };
  const { tabbedRef, indicatorRef } = useTabIndicator<"apps" | "reviews">(
    activeTab,
  );
  const descRef = useRef<HTMLParagraphElement | null>(null);
  const userNameRef = useRef<HTMLHeadingElement | null>(null);
  const collapsedDescHeightRef = useRef<number | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const occupation = data.occupation;
  const externalLinks = data.externalLinks;

  // Tip modal states
  const [tipOpen, setTipOpen] = useState(false);
  const [chatProcessing, setChatProcessing] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderRoomPublicId, setOrderRoomPublicId] = useState<string | null>(
    null,
  );
  const [userNameOverflow, setUserNameOverflow] = useState(0);
  const [orderRoomProcessing, setOrderRoomProcessing] = useState(false);
  const [scoutOpen, setScoutOpen] = useState(false);
  const [scoutRoomProcessing, setScoutRoomProcessing] = useState(false);

  const blockedRelation = isBlocked || data.isBlockedBy;
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const [appsFilters, setAppsFilters] = useState<AppsFilters>(() =>
    parseAppsFilters(searchParams),
  );
  const [draftAppsFilters, setDraftAppsFilters] =
    useState<AppsFilters>(appsFilters);
  const [pendingReset, setPendingReset] = useState(false);

  const [reviewsFilters, setReviewsFilters] = useState<ReviewsFilters>(() =>
    parseReviewsFilters(searchParams),
  );
  const [draftReviewsFilters, setDraftReviewsFilters] =
    useState<ReviewsFilters>(reviewsFilters);

  const availableAppTags = useMemo(() => {
    const map = new Map<number, string>();
    sortedApps.forEach((app) => {
      app.tags?.forEach((tag) => {
        if (!map.has(tag.id)) {
          map.set(tag.id, tag.name);
        }
      });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [sortedApps]);

  useEffect(() => {
    const measure = () => {
      const nameEl = userNameRef.current;
      if (!nameEl) return;

      const overflow = Math.max(nameEl.scrollWidth - nameEl.clientWidth, 0);
      setUserNameOverflow(overflow);
    };

    measure();
    window.addEventListener("resize", measure);

    return () => {
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest("[data-home-action-menu]")) return;
      if (target.closest("[data-home-action-menu-btn]")) return;
      if (target.closest(`.${styles.headerActionMenu}`)) return;

      if (sortMenuOpen && sortMenuRef.current) {
        const menuEl = sortMenuRef.current;
        const isInsideMenu = menuEl.contains(target);
        const isSortButton = target.closest("[data-sort-button]");
        if (!isInsideMenu && !isSortButton) {
          setSortMenuOpen(false);
        }
      }

      setOpenMenuId(null);
      setHeaderMenuOpen(false);
    };

    if (preview) return;

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [sortMenuOpen, preview]);

  useEffect(() => {
    setSortedApps(data.apps);
  }, [data.apps]);

  useEffect(() => {
    if (preview) return;
    const restoredApps = parseAppsFilters(searchParams);
    const restoredReviews = parseReviewsFilters(searchParams);
    setAppsFilters((current) =>
      areAppsFiltersEqual(current, restoredApps) ? current : restoredApps,
    );
    setReviewsFilters((current) =>
      areReviewsFiltersEqual(current, restoredReviews)
        ? current
        : restoredReviews,
    );
  }, [preview, searchParams]);

  useEffect(() => {
    if (preview) return;
    const params = new URLSearchParams(searchParams.toString());
    applyAppsFiltersToParams(params, appsFilters);
    applyReviewsFiltersToParams(params, reviewsFilters);
    const currentQuery = searchParams.toString();
    const nextQuery = params.toString();
    if (currentQuery === nextQuery) return;
    router.replace(nextQuery ? `?${nextQuery}` : "?", { scroll: false });
  }, [appsFilters, preview, reviewsFilters, router, searchParams]);

  const openFilterModal = useCallback(() => {
    setDraftAppsFilters(appsFilters);
    setDraftReviewsFilters(reviewsFilters);
    setPendingReset(false);
    setFilterModalOpen(true);
  }, [appsFilters, reviewsFilters]);

  const handleFilterModalOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setDraftAppsFilters(appsFilters);
        setDraftReviewsFilters(reviewsFilters);
        setPendingReset(false);
      } else if (pendingReset) {
        setAppsFilters(draftAppsFilters);
        setReviewsFilters(draftReviewsFilters);
        setPendingReset(false);
      } else {
        setPendingReset(false);
      }
      setFilterModalOpen(open);
    },
    [
      appsFilters,
      draftAppsFilters,
      draftReviewsFilters,
      pendingReset,
      reviewsFilters,
    ],
  );

  const handleFilterReset = useCallback(() => {
    if (activeTab === "apps") {
      setDraftAppsFilters(DEFAULT_APPS_FILTERS);
    } else {
      setDraftReviewsFilters(DEFAULT_REVIEWS_FILTERS);
    }
    setPendingReset(true);
  }, [activeTab]);

  const handleFilterApply = useCallback(() => {
    if (activeTab === "apps") {
      setAppsFilters(draftAppsFilters);
    } else {
      setReviewsFilters(draftReviewsFilters);
    }
    setFilterModalOpen(false);
    setPendingReset(false);
  }, [activeTab, draftAppsFilters, draftReviewsFilters]);

  useEffect(() => {
    if (preview) return;

    const mainEl = document.querySelector(
      `.${styles.main}`,
    ) as HTMLElement | null;
    if (!mainEl) return;

    // 親要素の中で最初にスク役割可能な要素を探す
    const findScrollContainer = (el: HTMLElement): HTMLElement => {
      let node: HTMLElement | null = el;
      while (node && node !== document.body) {
        if (node.scrollHeight > node.clientHeight) return node;
        node = node.parentElement;
      }
      return (
        (document.scrollingElement as HTMLElement) || document.documentElement
      );
    };

    let scrollContainer = findScrollContainer(mainEl);

    const getTabContents = () =>
      Array.from(document.querySelectorAll(`.${styles.tabContent}`)) as
        | HTMLElement[]
        | [];

    let tabContents = getTabContents();
    if (!tabContents.length) return;

    const updateScrollLock = () => {
      // 再取得して常に最新の DOM を使う
      tabContents = getTabContents();
      scrollContainer = findScrollContainer(mainEl);

      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;

      const isScrolledToBottom = scrollTop + clientHeight >= scrollHeight - 1;

      tabContents.forEach((content) => {
        if (isScrolledToBottom) {
          content.classList.add(styles.tabContentScrollEnabled);
        } else {
          content.classList.remove(styles.tabContentScrollEnabled);
        }
      });
    };

    updateScrollLock();

    const onScroll = () => updateScrollLock();
    const onResize = () => updateScrollLock();

    scrollContainer.addEventListener("scroll", onScroll);
    window.addEventListener("resize", onResize);

    const onWheel = (event: WheelEvent) => {
      const activeContent = document.querySelector(
        `.${styles.tabContent}.${styles.tabContentActive}`,
      ) as HTMLElement | null;
      if (!activeContent) return;

      const target = event.target as HTMLElement | null;
      if (!target || !activeContent.contains(target)) return;

      const deltaY = event.deltaY;
      const isScrollEnabled = activeContent.classList.contains(
        styles.tabContentScrollEnabled,
      );

      const parentScrollTop = scrollContainer.scrollTop;
      const parentScrollHeight = scrollContainer.scrollHeight;
      const parentClientHeight = scrollContainer.clientHeight;
      const canParentScrollDown =
        parentScrollTop + parentClientHeight < parentScrollHeight - 1;
      const canParentScrollUp = parentScrollTop > 0;

      const contentScrollTop = activeContent.scrollTop;
      const contentScrollHeight = activeContent.scrollHeight;
      const contentClientHeight = activeContent.clientHeight;
      const atContentTop = contentScrollTop <= 0;
      const atContentBottom =
        contentScrollTop + contentClientHeight >= contentScrollHeight - 1;

      // 下方向スク役割
      if (deltaY > 0) {
        // 親にまだ余裕がある場合は親を優先
        if (!isScrollEnabled) {
          event.preventDefault();
          scrollContainer.scrollBy({ top: deltaY, left: 0, behavior: "auto" });
          return;
        }

        // コンテンツがボトムで親がスク役割できるなら親をスク役割
        if (atContentBottom && canParentScrollDown) {
          event.preventDefault();
          scrollContainer.scrollBy({ top: deltaY, left: 0, behavior: "auto" });
        }
        return;
      }

      // 上方向スク役割
      if (deltaY < 0) {
        if (isScrollEnabled && atContentTop && canParentScrollUp) {
          event.preventDefault();
          scrollContainer.scrollBy({ top: deltaY, left: 0, behavior: "auto" });
        }
      }
    };

    document.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      scrollContainer.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("wheel", onWheel);
    };
  }, [preview]);

  useEffect(() => {
    if (!descRef.current) return;
    const desc = descRef.current;
    const computed = window.getComputedStyle(desc);
    const lineHeight = parseFloat(computed.lineHeight || "0");
    if (!lineHeight) return;

    const maxHeightPx = lineHeight * 2;
    collapsedDescHeightRef.current = maxHeightPx;

    if (desc.scrollHeight <= maxHeightPx + 1) {
      setShowToggle(false);
      desc.style.maxHeight = "none";
      return;
    }

    setShowToggle(true);

    if (!descExpanded) {
      desc.style.maxHeight = `${maxHeightPx}px`;
    } else {
      desc.style.maxHeight = `${desc.scrollHeight}px`;
    }
  }, [descExpanded]);

  const handleToggleDescription = () => {
    const desc = descRef.current;
    const collapsed = collapsedDescHeightRef.current;
    if (!desc || collapsed == null) return;

    const fullHeight = desc.scrollHeight;

    if (descExpanded) {
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
      desc.classList.add(styles.descriptionExpanded, styles.descriptionFade);
      desc.style.maxHeight = `${fullHeight}px`;

      window.setTimeout(() => {
        desc.classList.remove(styles.descriptionFade);
      }, 100);

      setDescExpanded(true);
    }
  };

  const toggleFavorite = (appId: number) => {
    setFavoriteAppIds((prev: number[]) =>
      prev.includes(appId)
        ? prev.filter((id: number) => id !== appId)
        : [...prev, appId],
    );
  };

  const sortLabels = ["新しい順", "古い順", "値段順", "高評価順"];

  const updateSortIndicator = useCallback((index: number) => {
    if (!sortMenuRef.current) return;

    const menuItems = sortMenuRef.current.querySelectorAll(
      `.${commonStyles.sortMenuItem}`,
    );
    const targetItem = menuItems[index] as HTMLElement | undefined;
    const indicator = sortMenuRef.current.querySelector(
      `.${commonStyles.sortMenuIndicator}`,
    ) as HTMLElement | null;

    if (!targetItem || !indicator) return;

    const menuRect = sortMenuRef.current.getBoundingClientRect();
    const itemRect = targetItem.getBoundingClientRect();

    const paddingTop = parseFloat(
      getComputedStyle(sortMenuRef.current).paddingTop || "0",
    );
    const top = itemRect.top - menuRect.top - paddingTop;
    indicator.style.transform = `translateY(${top}px)`;
  }, []);

  const handleSort = (index: number) => {
    setActiveSortIndex(index);

    const next = [...sortedApps];

    switch (index) {
      case 0: // 新しい順（id の降順で代用）
        next.sort((a, b) => b.id - a.id);
        break;
      case 1: // 古い順（id の昇順で代用）
        next.sort((a, b) => a.id - b.id);
        break;
      case 2: // 値段順（価格情報がないためそのまま）
        break;
      case 3: // 高評価順
        next.sort((a, b) => b.rating - a.rating);
        break;
      default:
        break;
    }

    setSortedApps(next);
    updateSortIndicator(index);
  };

  const filteredApps = useMemo(() => {
    let result = sortedApps;

    if (appsFilters.onlyFavorites) {
      result = result.filter((app) => favoriteAppIds.includes(app.id));
    }

    // 価格レンジフィルタ（検索画面と同仕様）
    if (appsFilters.priceRange !== "all") {
      result = result.filter((app) => {
        const salesPlans = app.salesPlans ?? [];
        if (!salesPlans.length) return true;

        const minPrice = Math.min(...salesPlans.map((p) => p.price || 0));

        if (appsFilters.priceRange === "low") {
          return minPrice > 0 && minPrice <= 1000;
        }
        if (appsFilters.priceRange === "mid") {
          return minPrice > 1000 && minPrice <= 5000;
        }
        // high
        return minPrice > 5000;
      });
    }

    // 販売形式フィルタ
    if (appsFilters.format !== "all") {
      result = result.filter((app) =>
        (app.salesPlans ?? []).some(
          (p) => p.salesFormat === appsFilters.format,
        ),
      );
    }

    // 出品形式フィルタ（ビュート / ビューズ）
    if (appsFilters.listingTypes.length > 0) {
      result = result.filter((app) => {
        const listingType = app.isBewtsProjectApp ? "bewts" : "bewt";
        return appsFilters.listingTypes.includes(listingType);
      });
    }

    if (appsFilters.highRatingOnly) {
      result = result.filter((app) => app.rating >= 4);
    }

    // 販売実績ありのみ
    if (appsFilters.withSalesOnly) {
      result = result.filter((app) => (app._count?.purchases ?? 0) > 0);
    }

    // タグフィルタ
    if (appsFilters.tagIds.length > 0) {
      result = result.filter(
        (app) =>
          app.tags?.some((tag) => appsFilters.tagIds.includes(tag.id)) ?? false,
      );
    }

    return result;
  }, [sortedApps, appsFilters, favoriteAppIds]);

  const filteredReviews = useMemo(() => {
    let result = data.reviews;

    if (reviewsFilters.goodOnly) {
      result = result.filter((review) => review.rating >= 4);
    }

    return result;
  }, [data.reviews, reviewsFilters]);

  useEffect(() => {
    if (sortMenuOpen) {
      requestAnimationFrame(() => updateSortIndicator(activeSortIndex));
    }
  }, [sortMenuOpen, activeSortIndex, updateSortIndicator]);

  const appsEmpty = data.apps.length === 0;
  const reviewsEmpty = data.reviews.length === 0;
  const followLabel = isFollowing
    ? isFollowHover
      ? "フォロー解除"
      : "フォロー中"
    : "フォロー";

  const handleToggleFollow = async () => {
    if (preview || data.isMe || blockedRelation || followProcessing) return;

    const next = !isFollowing;
    setFollowProcessing(true);
    try {
      const res = await fetch(`/api/users/${data.id}/follow`, {
        method: next ? "POST" : "DELETE",
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        console.error("failed to toggle follow", await res.text());
        return;
      }

      setIsFollowing(next);
      setFollowerCount((prev) => {
        if (next) return prev + 1;
        return Math.max(0, prev - 1);
      });
    } catch (e) {
      console.error("failed to toggle follow", e);
    } finally {
      setFollowProcessing(false);
    }
  };

  const handleToggleBlock = async () => {
    if (preview || data.isMe || blockProcessing) return;

    const next = !isBlocked;
    setBlockProcessing(true);
    try {
      const res = await fetch(`/api/users/${data.id}/block`, {
        method: next ? "POST" : "DELETE",
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        console.error("failed to toggle block", await res.text());
        return;
      }

      setIsBlocked(next);
    } catch (e) {
      console.error("failed to toggle block", e);
    } finally {
      setBlockProcessing(false);
    }
  };

  const handleOpenOrderModal = async () => {
    if (preview || data.isMe || blockedRelation || orderRoomProcessing) return;

    // 既にルームがある場合は再利用
    if (orderRoomPublicId) {
      setHeaderMenuOpen(false);
      setOpenMenuId(null);
      setOrderOpen(true);
      return;
    }

    setOrderRoomProcessing(true);
    try {
      const room = await fetcher<{ publicId: string }>("/api/chat/rooms", {
        method: "POST",
        body: JSON.stringify({ targetUserId: data.publicId }),
      });

      if (room?.publicId) {
        setOrderRoomPublicId(room.publicId);
        setHeaderMenuOpen(false);
        setOpenMenuId(null);
        setOrderOpen(true);
      }
    } catch (e) {
      // 認証切れの場合はログインへ
      if (e && typeof e === "object" && "status" in e) {
        const status = (e as { status?: number }).status;
        if (status === 401) {
          window.location.href = "/login";
          return;
        }
      }
      console.error("failed to open order modal", e);
    } finally {
      setOrderRoomProcessing(false);
    }
  };

  const handleStartChat = async () => {
    if (preview || data.isMe || chatProcessing || blockedRelation) return;

    setChatProcessing(true);
    try {
      const room = await fetcher<{ publicId: string }>("/api/chat/rooms", {
        method: "POST",
        body: JSON.stringify({ targetUserId: data.publicId }),
      });

      if (room?.publicId) {
        router.push(`/chat/${room.publicId}`);
      }
    } catch (e) {
      // 認証切れの場合はログインへ
      if (e && typeof e === "object" && "status" in e) {
        const status = (e as { status?: number }).status;
        if (status === 401) {
          window.location.href = "/login";
          return;
        }
      }
      console.error("failed to start chat", e);
    } finally {
      setChatProcessing(false);
    }
  };

  const handleOpenScoutModal = async () => {
    if (preview || data.isMe || blockedRelation || scoutRoomProcessing) return;

    // 既にルームがある場合は再利用（オーダーと共通のチャットルーム）
    if (orderRoomPublicId) {
      setHeaderMenuOpen(false);
      setOpenMenuId(null);
      setScoutOpen(true);
      return;
    }

    setScoutRoomProcessing(true);
    try {
      const room = await fetcher<{ publicId: string }>("/api/chat/rooms", {
        method: "POST",
        body: JSON.stringify({ targetUserId: data.publicId }),
      });

      if (room?.publicId) {
        setOrderRoomPublicId(room.publicId);
        setHeaderMenuOpen(false);
        setOpenMenuId(null);
        setScoutOpen(true);
      }
    } catch (e) {
      // 認証切れの場合はログインへ
      if (e && typeof e === "object" && "status" in e) {
        const status = (e as { status?: number }).status;
        if (status === 401) {
          window.location.href = "/login";
          return;
        }
      }
      console.error("failed to open scout modal", e);
    } finally {
      setScoutRoomProcessing(false);
    }
  };

  return (
    <div className={styles.userDetailPage}>
      {!preview && (
        <div className={styles.topRow}>
          <Link href="/search/users" className={styles.trail}>
            <span className={styles.trailArrow}>&#9664;</span>
            ユーザ一覧
          </Link>
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.userSection}>
          <div className={styles.userHeader}>
            <Avatar
              src={data.image}
              alt={`${data.name}さんのアイコン`}
              className={styles.userIcon}
            />
            <div className={styles.userInfo}>
              <h2
                ref={userNameRef}
                className={clsx(
                  styles.userName,
                  userNameOverflow > 0 && styles.marqueeReady,
                )}
                style={
                  {
                    "--marquee-distance": `${userNameOverflow}px`,
                  } as CSSProperties
                }
              >
                <span className={styles.marqueeText}>{data.name}</span>
              </h2>
              <div className={styles.userRating}>
                <Rating value={data.rating} />
              </div>
            </div>
            <div className={styles.userHeaderRight}>
              <div className={styles.followerCount}>
                <Image
                  src="/images/follow-filled.png"
                  alt="フォロワー"
                  width={20}
                  height={20}
                />
                <span className={styles.followerCountNumber}>
                  {followerCount}
                </span>
              </div>
              <button
                type="button"
                className={clsx(
                  styles.followBtn,
                  isFollowing && styles.followBtnActive,
                  preview && styles.previewDisabled,
                )}
                disabled={
                  preview ||
                  data.isMe ||
                  !privacyActions.follow ||
                  blockedRelation ||
                  followProcessing
                }
                onClick={preview ? undefined : () => void handleToggleFollow()}
                onMouseEnter={
                  preview ? undefined : () => setIsFollowHover(true)
                }
                onMouseLeave={
                  preview ? undefined : () => setIsFollowHover(false)
                }
              >
                <span
                  className={clsx(
                    styles.followText,
                    isFollowing && isFollowHover && styles.followTextSmall,
                  )}
                >
                  {followLabel}
                </span>
              </button>
              <button
                type="button"
                className={clsx(
                  styles.chatBtn,
                  preview && styles.previewDisabled,
                )}
                disabled={
                  preview || data.isMe || chatProcessing || blockedRelation
                }
                onClick={preview ? undefined : () => void handleStartChat()}
                aria-label="チャットを開始"
              >
                <Image
                  src="/images/chat.png"
                  alt="チャット"
                  width={28}
                  height={28}
                />
              </button>
              <div className={styles.headerActionMenu}>
                <button
                  type="button"
                  className={clsx(
                    styles.actionMenuBtn,
                    preview && styles.previewDisabled,
                  )}
                  aria-haspopup="true"
                  aria-expanded={headerMenuOpen}
                  disabled={preview}
                  onClick={
                    preview
                      ? undefined
                      : () => {
                          setOpenMenuId(null);
                          setHeaderMenuOpen((prev: boolean) => !prev);
                        }
                  }
                >
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </button>
                <div
                  className={clsx(
                    styles.actionMenu,
                    headerMenuOpen && styles.show,
                  )}
                >
                  <ul>
                    <li>
                      <button
                        type="button"
                        className={styles.actionMenuItem}
                        disabled={
                          !privacyActions.order ||
                          blockedRelation ||
                          preview ||
                          data.isMe ||
                          orderRoomProcessing
                        }
                        aria-disabled={
                          !privacyActions.order ||
                          blockedRelation ||
                          preview ||
                          data.isMe ||
                          orderRoomProcessing
                        }
                        onClick={() => {
                          if (
                            !privacyActions.order ||
                            blockedRelation ||
                            preview ||
                            data.isMe ||
                            orderRoomProcessing
                          ) {
                            return;
                          }
                          void handleOpenOrderModal();
                        }}
                      >
                        <span>オーダー</span>
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className={styles.actionMenuItem}
                        disabled={
                          !privacyActions.scout ||
                          blockedRelation ||
                          preview ||
                          data.isMe ||
                          scoutRoomProcessing
                        }
                        aria-disabled={
                          !privacyActions.scout ||
                          blockedRelation ||
                          preview ||
                          data.isMe ||
                          scoutRoomProcessing
                        }
                        onClick={() => {
                          if (
                            !privacyActions.scout ||
                            blockedRelation ||
                            preview ||
                            data.isMe ||
                            scoutRoomProcessing
                          ) {
                            return;
                          }
                          void handleOpenScoutModal();
                        }}
                      >
                        <span>スカウト</span>
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className={styles.actionMenuItem}
                        disabled={
                          !privacyActions.tip ||
                          blockedRelation ||
                          preview ||
                          data.isMe
                        }
                        aria-disabled={
                          !privacyActions.tip ||
                          blockedRelation ||
                          preview ||
                          data.isMe
                        }
                        onClick={() => {
                          if (
                            !privacyActions.tip ||
                            blockedRelation ||
                            preview ||
                            data.isMe
                          )
                            return;
                          setHeaderMenuOpen(false);
                          setOpenMenuId(null);
                          setTipOpen(true);
                        }}
                      >
                        <span>投げ銭</span>
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className={clsx(styles.actionMenuItem, styles.blockBtn)}
                        disabled={preview || data.isMe || blockProcessing}
                        onClick={
                          preview
                            ? undefined
                            : () => {
                                setBlockConfirmOpen(true);
                              }
                        }
                      >
                        <span>{isBlocked ? "ブロック解除" : "ブロック"}</span>
                        <Image
                          src="/images/block.png"
                          alt={isBlocked ? "ブロック解除" : "ブロック"}
                          width={20}
                          height={20}
                        />
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.profCont}>
            <div className={styles.profRow}>
              <h2 className={styles.profTitle}>職業</h2>
              <div className={styles.profOccupation}>{occupation || "-"}</div>
            </div>

            <div className={styles.profRow}>
              <h2 className={styles.profTitle}>実績</h2>
              <div className={styles.profExperience}>
                {data.achievements || "登録されていません"}
              </div>
            </div>
            <div className={styles.profRow}>
              <div className={styles.profLinkBody}>
                {externalLinks.length > 0 ? (
                  <div className={styles.linkCont}>
                    <Image
                      src="/images/link.png"
                      width={24}
                      height={24}
                      alt="リンク"
                    />
                    <div className={styles.userLinkCont}>
                      {externalLinks.map((link) => (
                        <a
                          key={link}
                          href={link}
                          className={styles.userLink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {link}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={styles.linkCont}>
                    <Image
                      src="/images/link.png"
                      width={24}
                      height={24}
                      alt="リンク"
                    />
                    <span>登録されていません</span>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.userDescWrap}>
              <p ref={descRef} className={styles.userDesc}>
                {data.selfIntro || "自己紹介はまだ登録されていません。"}
              </p>
              {showToggle && (
                <button
                  type="button"
                  className={styles.allView}
                  onClick={handleToggleDescription}
                >
                  {descExpanded ? "閉じる" : "すべて表示"}
                </button>
              )}
            </div>

            <div className={styles.tabArea}>
              <div className={styles.tabTop}>
                <div ref={tabbedRef} className={styles.tabbed}>
                  <div ref={indicatorRef} className={styles.tabbedIndicator} />
                  <button
                    type="button"
                    className={clsx(styles.tabBtn, {
                      [styles.activeTab]: activeTab === "apps",
                    })}
                    data-tab="apps"
                    onClick={() => setActiveTab("apps")}
                  >
                    出品一覧
                  </button>
                  <button
                    type="button"
                    className={clsx(styles.tabBtn, {
                      [styles.activeTab]: activeTab === "reviews",
                    })}
                    data-tab="reviews"
                    onClick={() => setActiveTab("reviews")}
                  >
                    販売実績
                  </button>
                </div>

                <div className={commonStyles.listController}>
                  <button
                    className={commonStyles.filter}
                    type="button"
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
                    <button
                      className={commonStyles.sort}
                      type="button"
                      data-sort-button
                      onClick={() => setSortMenuOpen((prev) => !prev)}
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
                      className={clsx(
                        commonStyles.sortMenu,
                        sortMenuOpen && commonStyles.show,
                      )}
                    >
                      <div className={commonStyles.sortMenuIndicator} />
                      <ul>
                        {sortLabels.map((label, index) => (
                          <li key={label}>
                            <button
                              type="button"
                              className={clsx(commonStyles.sortMenuItem, {
                                [commonStyles.active]:
                                  index === activeSortIndex,
                              })}
                              onClick={() => handleSort(index)}
                            >
                              {label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={styles.tabContainer}
                style={{
                  transform:
                    activeTab === "apps"
                      ? "translateX(0)"
                      : "translateX(-100%)",
                }}
              >
                <div
                  className={clsx(
                    styles.tabContent,
                    activeTab === "apps" && styles.tabContentActive,
                  )}
                >
                  {appsEmpty ? (
                    <p className={styles.placeholderText}>
                      まだ出品されているアプリはありません。
                    </p>
                  ) : filteredApps.length === 0 ? (
                    <p className={styles.placeholderText}>
                      条件に合うアプリがありません。
                    </p>
                  ) : (
                    <div
                      className={clsx(
                        homeStyles.appsCont,
                        preview && styles.previewAppsDisabled,
                      )}
                    >
                      {filteredApps.map((app) => {
                        const isFavorite = favoriteAppIds.includes(app.id);
                        return (
                          <AppCard
                            key={app.id}
                            app={app}
                            isMenuOpen={preview ? false : openMenuId === app.id}
                            isFavorite={isFavorite}
                            onToggleMenu={() => {
                              if (preview) return;
                              setHeaderMenuOpen(false);
                              setOpenMenuId((prev) =>
                                prev === app.id ? null : app.id,
                              );
                            }}
                            onToggleFavorite={() => {
                              if (preview) return;
                              toggleFavorite(app.id);
                            }}
                            onHide={() => {}}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                <div
                  className={clsx(
                    styles.tabContent,
                    activeTab === "reviews" && styles.tabContentActive,
                  )}
                >
                  {reviewsEmpty ? (
                    <p className={styles.placeholderText}>
                      まだ販売実績はありません。
                    </p>
                  ) : filteredReviews.length === 0 ? (
                    <p className={styles.placeholderText}>
                      条件に合う販売実績がありません。
                    </p>
                  ) : (
                    <div
                      className={clsx(
                        styles.reviews,
                        preview && styles.previewAppsDisabled,
                      )}
                    >
                      {filteredReviews.map((review) => (
                        <Link
                          key={review.id}
                          href={
                            preview
                              ? "#"
                              : `/apps/${review.app.publicId}/reviews/${review.id}`
                          }
                          className={styles.reviewItem}
                        >
                          <button
                            type="button"
                            className={styles.reviewAppCont}
                            onClick={(e) => {
                              e.preventDefault();
                              if (preview) return;
                              router.push(`/apps/${review.app.publicId}`);
                            }}
                          >
                            <span className={styles.reviewAppIcon}>
                              <Image
                                src={
                                  review.app.iconUrl ||
                                  "/images/icon-default.png"
                                }
                                alt="アプリ"
                                width={60}
                                height={60}
                              />
                            </span>
                            <div className={styles.reviewAppInfo}>
                              <h2 className={styles.reviewAppName}>
                                {review.app.name}
                              </h2>
                              <p className={styles.reviewAppDesc}>
                                {review.app.summary}
                              </p>
                            </div>
                          </button>
                          <div className={styles.reviewRating}>
                            <Rating value={review.rating} />
                          </div>
                          <p className={styles.reviewText}>{review.text}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <FilterModal
        open={filterModalOpen}
        onOpenChange={handleFilterModalOpenChange}
        onReset={handleFilterReset}
        onApply={handleFilterApply}
      >
        {activeTab === "apps" ? (
          <>
            <section className={filterModalStyles.section}>
              <h2 className={filterModalStyles.sectionTitle}>お気に入り</h2>
              <div className={filterModalStyles.toggleRow}>
                <label className={filterModalStyles.toggleItem}>
                  <input
                    type="checkbox"
                    checked={draftAppsFilters.onlyFavorites}
                    onChange={(e) =>
                      setDraftAppsFilters((prev) => ({
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

            {availableAppTags.length > 0 && (
              <section className={filterModalStyles.section}>
                <h2 className={filterModalStyles.sectionTitle}>タグ</h2>
                <TagFilterPicker
                  tags={availableAppTags}
                  selectedTagIds={draftAppsFilters.tagIds}
                  onChange={(ids) =>
                    setDraftAppsFilters((prev) => ({
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
                <button
                  type="button"
                  className={clsx(
                    filterModalStyles.chipButton,
                    draftAppsFilters.priceRange === "all" &&
                      filterModalStyles.chipButtonActive,
                  )}
                  onClick={() =>
                    setDraftAppsFilters((prev) => ({
                      ...prev,
                      priceRange: "all",
                    }))
                  }
                >
                  <span>すべて</span>
                </button>
                <button
                  type="button"
                  className={clsx(
                    filterModalStyles.chipButton,
                    draftAppsFilters.priceRange === "low" &&
                      filterModalStyles.chipButtonActive,
                  )}
                  onClick={() =>
                    setDraftAppsFilters((prev) => ({
                      ...prev,
                      priceRange: "low",
                    }))
                  }
                >
                  <span>〜¥1,000</span>
                </button>
                <button
                  type="button"
                  className={clsx(
                    filterModalStyles.chipButton,
                    draftAppsFilters.priceRange === "mid" &&
                      filterModalStyles.chipButtonActive,
                  )}
                  onClick={() =>
                    setDraftAppsFilters((prev) => ({
                      ...prev,
                      priceRange: "mid",
                    }))
                  }
                >
                  <span>¥1,001〜¥5,000</span>
                </button>
                <button
                  type="button"
                  className={clsx(
                    filterModalStyles.chipButton,
                    draftAppsFilters.priceRange === "high" &&
                      filterModalStyles.chipButtonActive,
                  )}
                  onClick={() =>
                    setDraftAppsFilters((prev) => ({
                      ...prev,
                      priceRange: "high",
                    }))
                  }
                >
                  <span>¥5,001以上</span>
                </button>
              </div>
            </section>

            <section className={filterModalStyles.section}>
              <h2 className={filterModalStyles.sectionTitle}>販売形式</h2>
              <div className={filterModalStyles.chipRow}>
                <button
                  type="button"
                  className={clsx(
                    filterModalStyles.chipButton,
                    draftAppsFilters.format === "all" &&
                      filterModalStyles.chipButtonActive,
                  )}
                  onClick={() =>
                    setDraftAppsFilters((prev) => ({
                      ...prev,
                      format: "all",
                    }))
                  }
                >
                  <span>すべて</span>
                </button>
                <button
                  type="button"
                  className={clsx(
                    filterModalStyles.chipButton,
                    draftAppsFilters.format === "P" &&
                      filterModalStyles.chipButtonActive,
                  )}
                  onClick={() =>
                    setDraftAppsFilters((prev) => ({
                      ...prev,
                      format: "P",
                    }))
                  }
                >
                  <span>買い切り</span>
                </button>
                <button
                  type="button"
                  className={clsx(
                    filterModalStyles.chipButton,
                    draftAppsFilters.format === "S" &&
                      filterModalStyles.chipButtonActive,
                  )}
                  onClick={() =>
                    setDraftAppsFilters((prev) => ({
                      ...prev,
                      format: "S",
                    }))
                  }
                >
                  <span>サブスク</span>
                </button>
              </div>
            </section>

            <section className={filterModalStyles.section}>
              <h2 className={filterModalStyles.sectionTitle}>出品形式</h2>
              <div className={filterModalStyles.chipRow}>
                <button
                  type="button"
                  className={clsx(
                    filterModalStyles.chipButton,
                    draftAppsFilters.listingTypes.includes("bewt") &&
                      filterModalStyles.chipButtonActive,
                  )}
                  onClick={() =>
                    setDraftAppsFilters((prev) => {
                      const has = prev.listingTypes.includes("bewt");
                      if (has && prev.listingTypes.length === 1) {
                        return prev;
                      }
                      return {
                        ...prev,
                        listingTypes: has
                          ? prev.listingTypes.filter((t) => t !== "bewt")
                          : [...prev.listingTypes, "bewt"],
                      };
                    })
                  }
                >
                  <span>ビュート</span>
                </button>
                <button
                  type="button"
                  className={clsx(
                    filterModalStyles.chipButton,
                    draftAppsFilters.listingTypes.includes("bewts") &&
                      filterModalStyles.chipButtonActive,
                  )}
                  onClick={() =>
                    setDraftAppsFilters((prev) => {
                      const has = prev.listingTypes.includes("bewts");
                      if (has && prev.listingTypes.length === 1) {
                        return prev;
                      }
                      return {
                        ...prev,
                        listingTypes: has
                          ? prev.listingTypes.filter((t) => t !== "bewts")
                          : [...prev.listingTypes, "bewts"],
                      };
                    })
                  }
                >
                  <span>ビューズ</span>
                </button>
              </div>
            </section>

            <section className={filterModalStyles.section}>
              <h2 className={filterModalStyles.sectionTitle}>出品形式</h2>
              <div className={filterModalStyles.chipRow}>
                <button
                  type="button"
                  className={clsx(
                    filterModalStyles.chipButton,
                    draftAppsFilters.listingTypes.includes("bewt") &&
                      filterModalStyles.chipButtonActive,
                  )}
                  onClick={() =>
                    setDraftAppsFilters((prev) => {
                      const has = prev.listingTypes.includes("bewt");
                      return {
                        ...prev,
                        listingTypes: has
                          ? prev.listingTypes.filter((t) => t !== "bewt")
                          : [...prev.listingTypes, "bewt"],
                      };
                    })
                  }
                >
                  <span>ビュート</span>
                </button>
                <button
                  type="button"
                  className={clsx(
                    filterModalStyles.chipButton,
                    draftAppsFilters.listingTypes.includes("bewts") &&
                      filterModalStyles.chipButtonActive,
                  )}
                  onClick={() =>
                    setDraftAppsFilters((prev) => {
                      const has = prev.listingTypes.includes("bewts");
                      return {
                        ...prev,
                        listingTypes: has
                          ? prev.listingTypes.filter((t) => t !== "bewts")
                          : [...prev.listingTypes, "bewts"],
                      };
                    })
                  }
                >
                  <span>ビューズ</span>
                </button>
              </div>
            </section>

            <section className={filterModalStyles.section}>
              <h2 className={filterModalStyles.sectionTitle}>評価</h2>
              <div className={filterModalStyles.toggleRow}>
                <label className={filterModalStyles.toggleItem}>
                  <input
                    type="checkbox"
                    checked={draftAppsFilters.highRatingOnly}
                    onChange={(e) =>
                      setDraftAppsFilters((prev) => ({
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
                    checked={draftAppsFilters.withSalesOnly}
                    onChange={(e) =>
                      setDraftAppsFilters((prev) => ({
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
          </>
        ) : (
          <section className={filterModalStyles.section}>
            <h2 className={filterModalStyles.sectionTitle}>評価</h2>
            <div className={filterModalStyles.toggleRow}>
              <label className={filterModalStyles.toggleItem}>
                <input
                  type="checkbox"
                  checked={draftReviewsFilters.goodOnly}
                  onChange={(e) =>
                    setDraftReviewsFilters((prev) => ({
                      ...prev,
                      goodOnly: e.target.checked,
                    }))
                  }
                />
                <span className={filterModalStyles.checkmark} />
                <span>高評価（★4以上）のみ</span>
              </label>
            </div>
          </section>
        )}
      </FilterModal>
      {!preview && orderRoomPublicId && (
        <ChatOrderModal
          open={orderOpen}
          onOpenChange={setOrderOpen}
          roomPublicId={orderRoomPublicId}
          mode="external"
        />
      )}
      {!preview && (
        <ChatScoutModal
          open={scoutOpen}
          onOpenChange={setScoutOpen}
          targetUserId={data.id}
          roomPublicId={orderRoomPublicId ?? undefined}
          mode="external"
        />
      )}
      {!preview && (
        <WcoinTipModal
          open={tipOpen}
          onOpenChange={setTipOpen}
          receiverUserId={data.id}
        />
      )}
      {!preview && (
        <>
          {!isBlocked && (
            <BlockUserConfirmModal
              open={blockConfirmOpen}
              onOpenChange={(open) => {
                if (!open || !blockProcessing) {
                  setBlockConfirmOpen(open);
                }
              }}
              userName={data.name}
              userImage={data.image}
              processing={blockProcessing}
              onConfirm={() => {
                void handleToggleBlock();
                setBlockConfirmOpen(false);
              }}
            />
          )}
          {isBlocked && (
            <UserConfirmModal
              open={blockConfirmOpen}
              onOpenChange={(open) => {
                if (!open || !blockProcessing) {
                  setBlockConfirmOpen(open);
                }
              }}
              title="このユーザのブロックを解除しますか？"
              description="このユーザのブロックを解除しますか？"
              userName={data.name}
              userImage={data.image}
              confirmLabel="ブロック解除"
              cancelLabel="キャンセル"
              variant="unblock"
              processing={blockProcessing}
              onConfirm={() => {
                void handleToggleBlock();
                setBlockConfirmOpen(false);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
