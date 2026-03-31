"use client";
import Rating from "@/app/(sidebar)/components/Rating";
import Avatar from "@/components/Avatar";
import {
  BlockUserConfirmModal,
  UserConfirmModal,
} from "@/components/BlockUserConfirmModal";
import { FilterModal } from "@/components/FilterModal";
import filterModalStyles from "@/components/FilterModal.module.scss";
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
import { useCallback, useEffect, useMemo, useState } from "react";
import HighlightedText from "../../components/HighlightedText";
import { JobFilterPicker } from "../../components/JobFilterPicker";
import SearchBar from "../../components/SearchBar/SearchBar";
import SortMenu, {
  type SortOption,
  SortUtils,
} from "../../components/SortMenu/SortMenu";
import {
  type ViewMode,
  ViewModeToggle,
} from "../../components/ViewModeToggle/ViewModeToggle";
import commonStyles from "../common.module.scss";
import { useSearchHeaderControls } from "../headerContext";
import styles from "./page.module.scss";

type UserJob = { id: number; name: string };
type UserApp = { publicId: string; appIconUrl: string | null };

type User = {
  id: number;
  publicId: string;
  name: string;
  selfIntro: string | null;
  rating: number | null;
  image: string | null;
  createdAt: string;
  apps: UserApp[];
  jobs: UserJob[];
  canFollow: boolean;
  isFollowed: boolean;
  canBlock: boolean;
  isBlocked: boolean;
};

type SearchUserFilters = {
  followedOnly: boolean;
  withAppsOnly: boolean;
  highRatingOnly: boolean;
  jobIds: number[];
};

const DEFAULT_SEARCH_USER_FILTERS: SearchUserFilters = {
  followedOnly: false,
  withAppsOnly: false,
  highRatingOnly: false,
  jobIds: [],
};

const parseSearchUserFilters = (params: {
  get: (key: string) => string | null;
}) => {
  const jobIds = (params.get("f_jobs") ?? "")
    .split(",")
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b);

  return {
    followedOnly: params.get("f_followed") === "1",
    withAppsOnly: params.get("f_with_apps") === "1",
    highRatingOnly: params.get("f_high") === "1",
    jobIds,
  } satisfies SearchUserFilters;
};

const areSearchUserFiltersEqual = (
  a: SearchUserFilters,
  b: SearchUserFilters,
) =>
  a.followedOnly === b.followedOnly &&
  a.withAppsOnly === b.withAppsOnly &&
  a.highRatingOnly === b.highRatingOnly &&
  a.jobIds.length === b.jobIds.length &&
  a.jobIds.every((value, index) => value === b.jobIds[index]);

const applySearchUserFiltersToParams = (
  params: URLSearchParams,
  filters: SearchUserFilters,
) => {
  if (filters.followedOnly) params.set("f_followed", "1");
  else params.delete("f_followed");

  if (filters.withAppsOnly) params.set("f_with_apps", "1");
  else params.delete("f_with_apps");

  if (filters.highRatingOnly) params.set("f_high", "1");
  else params.delete("f_high");

  if (filters.jobIds.length > 0) params.set("f_jobs", filters.jobIds.join(","));
  else params.delete("f_jobs");
};

// ── アイテム1件ごとのコンポーネント ──────────────────────────────
type SearchUserItemRowProps = {
  user: User;
  searchQuery: string;
  isFollowed: boolean;
  isBlocked: boolean;
  onToggleFollow: (userId: number) => void;
  onHideRequest: (user: User) => void;
  onBlockRequest: (user: User) => void;
};

function SearchUserItemRow({
  user,
  searchQuery,
  isFollowed,
  isBlocked,
  onToggleFollow,
  onHideRequest,
  onBlockRequest,
}: SearchUserItemRowProps) {
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

  const appCount = user.apps.length;
  const visibleApps = user.apps.slice(0, 3);
  const overflowCount = appCount > 3 ? appCount - 3 : 0;
  const description = user.selfIntro ?? "";

  return (
    <div className={styles.user}>
      <Link href={`/users/${user.publicId}`} className={styles.userInner}>
        <div className={styles.userHeader}>
          <Avatar
            src={user.image}
            alt={`${user.name}さんのアイコン`}
            className={styles.userIcon}
          />
          <div className={styles.userInfo}>
            <div className={styles.nameRatingCont}>
              <h2 className={styles.userName}>
                <HighlightedText text={user.name} keyword={searchQuery} />
              </h2>
              <div className={styles.rating}>
                <Rating value={user.rating ? Number(user.rating) : 0} />
              </div>
            </div>
            <p className={styles.userDescList}>
              <HighlightedText text={description} keyword={searchQuery} />
            </p>
          </div>
        </div>
        <p className={styles.userDescGrid}>
          <HighlightedText text={description} keyword={searchQuery} />
        </p>
        <div className={styles.userApps}>
          {appCount === 0 ? (
            <div className={styles.noApps}>
              まだ出品されているアプリはありません
            </div>
          ) : (
            <>
              {visibleApps.map((app) => (
                <object key={app.publicId} className={styles.userApp}>
                  <Link href={`/apps/${app.publicId}`}>
                    <Image
                      src={app.appIconUrl || "/images/icon-default.png"}
                      alt="アプリ"
                      width={60}
                      height={60}
                    />
                  </Link>
                </object>
              ))}
              {overflowCount > 0 && (
                <div className={styles.placeholder}>
                  <div className={styles.inner}>
                    <span>+{overflowCount > 99 ? 99 : overflowCount}</span>
                  </div>
                </div>
              )}
            </>
          )}
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
                className={cn(styles.actionMenuItem, {
                  [styles.active]: isFollowed,
                })}
                data-user-id={user.id}
                disabled={!user.canFollow}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFollow(user.id);
                }}
              >
                <span className={styles.label}>
                  {isFollowed ? "フォロー中" : "フォロー"}
                </span>
                <Image
                  className={styles.icon}
                  src={
                    isFollowed
                      ? "/images/follow-filled.png"
                      : "/images/follow.png"
                  }
                  alt={isFollowed ? "フォロー中" : "フォロー"}
                  width={20}
                  height={20}
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
                  onHideRequest(user);
                }}
              >
                <span>非表示</span>
                <Image
                  src="/images/hidden.png"
                  alt="非表示"
                  width={15}
                  height={15}
                />
              </button>
            </li>
            <li>
              <button
                type="button"
                className={cn(styles.actionMenuItem, styles.blockBtn)}
                disabled={!user.canBlock}
                onClick={(e) => {
                  e.stopPropagation();
                  onBlockRequest(user);
                }}
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
      </FloatingPortal>
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────────
interface SearchUsersClientProps {
  initialUsers: User[];
}

const resolveViewMode = (value: string | null): ViewMode => {
  if (value === "list" || value === "grid" || value === "card") return value;
  return "card";
};

const SEARCH_VIEW_STORAGE_KEY = "bewtopia:viewMode:search";

const getInitialViewMode = () =>
  resolveViewMode(getLocalStorage<string>(SEARCH_VIEW_STORAGE_KEY, "card"));

export default function SearchUsersClient({
  initialUsers,
}: SearchUsersClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [users] = useState<User[]>(initialUsers);
  const [sortedUsers, setSortedUsers] = useState<User[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const [displayMode, setDisplayMode] = useState<ViewMode>(getInitialViewMode);
  const [viewVisible, setViewVisible] = useState(true);
  const [followedUserIds, setFollowedUserIds] = useState<number[]>(() =>
    initialUsers.filter((u) => u.isFollowed).map((u) => u.id),
  );
  const [blockedUserIds, setBlockedUserIds] = useState<number[]>(() =>
    initialUsers.filter((u) => u.isBlocked).map((u) => u.id),
  );
  const [blockConfirmUser, setBlockConfirmUser] = useState<User | null>(null);
  const [hiddenUserIds, setHiddenUserIds] = useState<number[]>([]);
  const [hideConfirmUser, setHideConfirmUser] = useState<User | null>(null);

  const { setControls } = useSearchHeaderControls();
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<SearchUserFilters>(() =>
    parseSearchUserFilters(searchParams),
  );
  const [draftFilters, setDraftFilters] = useState<SearchUserFilters>(filters);
  const [pendingReset, setPendingReset] = useState(false);

  const availableJobs = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach((user) => {
      user.jobs.forEach((job) => {
        if (!map.has(job.id)) map.set(job.id, job.name);
      });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [users]);

  const sortOptions: SortOption<User>[] = useMemo(
    () => [
      {
        key: "newest",
        label: "新しい順",
        compareFn: SortUtils.sortByDateNewest,
      },
      {
        key: "name_asc",
        label: "名前順",
        compareFn: (a, b) => a.name.localeCompare(b.name, "ja"),
      },
      {
        key: "posts_desc",
        label: "投稿数順",
        compareFn: (a, b) => b.apps.length - a.apps.length,
      },
      {
        key: "rating_desc",
        label: "高評価順",
        compareFn: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
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

  const filteredUsers = useMemo(() => {
    let result = users;
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          (user.selfIntro || "").toLowerCase().includes(query),
      );
    }
    if (filters.followedOnly)
      result = result.filter((user) => followedUserIds.includes(user.id));
    if (filters.withAppsOnly)
      result = result.filter((user) => user.apps.length > 0);
    if (filters.highRatingOnly)
      result = result.filter((user) => (user.rating ?? 0) >= 4);
    if (filters.jobIds.length > 0) {
      const jobIdSet = new Set(filters.jobIds);
      result = result.filter((user) =>
        user.jobs.some((job) => jobIdSet.has(job.id)),
      );
    }
    return result;
  }, [users, searchQuery, filters, followedUserIds]);

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
    const restored = parseSearchUserFilters(searchParams);
    setFilters((current) =>
      areSearchUserFiltersEqual(current, restored) ? current : restored,
    );
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    applySearchUserFiltersToParams(params, filters);
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
    setDraftFilters(DEFAULT_SEARCH_USER_FILTERS);
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
              items={filteredUsers}
              options={sortOptions}
              onChange={setSortedUsers}
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
            iconVariant="user"
            className={commonStyles.viewToggle}
          />
        </>
      ),
    });
  }, [
    filteredUsers,
    sortOptions,
    currentSort,
    searchQuery,
    viewMode,
    handleSortChange,
    handleViewChange,
    setControls,
    openFilterModal,
  ]);

  const toggleFollow = useCallback(
    async (userId: number) => {
      const button = document.querySelector<HTMLButtonElement>(
        `button[data-user-id="${userId}"]`,
      );
      const isCurrentlyFollowed = followedUserIds.includes(userId);
      const next = !isCurrentlyFollowed;

      if (!button) {
        try {
          const res = await fetch(`/api/users/${userId}/follow`, {
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
          setFollowedUserIds((prev) =>
            next ? [...prev, userId] : prev.filter((id) => id !== userId),
          );
        } catch (e) {
          console.error("failed to toggle follow", e);
        }
        return;
      }

      const label = button.querySelector<HTMLElement>(`.${styles.label}`);
      const icon = button.querySelector<HTMLElement>(`.${styles.icon}`);

      try {
        const res = await fetch(`/api/users/${userId}/follow`, {
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

        label?.classList.add(styles.fadeOut);
        icon?.classList.add(styles.fadeOut);

        setTimeout(() => {
          setFollowedUserIds((prev) => {
            const updated = next
              ? [...prev, userId]
              : prev.filter((id) => id !== userId);
            label?.classList.remove(styles.fadeOut);
            icon?.classList.remove(styles.fadeOut);
            label?.classList.add(styles.fadeIn);
            icon?.classList.add(styles.fadeIn);
            setTimeout(() => {
              label?.classList.remove(styles.fadeIn);
              icon?.classList.remove(styles.fadeIn);
            }, 300);
            return updated;
          });
        }, 300);
      } catch (e) {
        console.error("failed to toggle follow", e);
      }
    },
    [followedUserIds],
  );

  const toggleBlock = useCallback(
    async (userId: number) => {
      const isCurrentlyBlocked = blockedUserIds.includes(userId);
      const next = !isCurrentlyBlocked;
      try {
        const res = await fetch(`/api/users/${userId}/block`, {
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
        setBlockedUserIds((prev) =>
          next ? [...prev, userId] : prev.filter((id) => id !== userId),
        );
      } catch (e) {
        console.error("failed to toggle block", e);
      }
    },
    [blockedUserIds],
  );

  return (
    <main>
      <div
        className={cn(
          styles.users,
          { [styles.listView]: displayMode === "list" },
          { [styles.gridView]: displayMode === "grid" },
          { [styles.fade]: !viewVisible },
        )}
      >
        <div className={styles.usersCont}>
          {sortedUsers.map((user) => {
            if (
              blockedUserIds.includes(user.id) ||
              hiddenUserIds.includes(user.id)
            )
              return null;
            return (
              <SearchUserItemRow
                key={user.publicId}
                user={user}
                searchQuery={searchQuery}
                isFollowed={followedUserIds.includes(user.id)}
                isBlocked={blockedUserIds.includes(user.id)}
                onToggleFollow={toggleFollow}
                onHideRequest={setHideConfirmUser}
                onBlockRequest={setBlockConfirmUser}
              />
            );
          })}
        </div>
      </div>

      <p
        className={cn(commonStyles.noResults, {
          [commonStyles.visible]: filteredUsers.length === 0,
        })}
      >
        該当するユーザが見つかりませんでした
      </p>

      <BlockUserConfirmModal
        open={!!blockConfirmUser}
        onOpenChange={(open) => {
          if (!open) setBlockConfirmUser(null);
        }}
        userName={blockConfirmUser?.name ?? ""}
        userImage={blockConfirmUser?.image ?? null}
        processing={false}
        onConfirm={() => {
          if (!blockConfirmUser) return;
          void toggleBlock(blockConfirmUser.id);
          setBlockConfirmUser(null);
        }}
      />

      <UserConfirmModal
        open={!!hideConfirmUser}
        onOpenChange={(open) => {
          if (!open) setHideConfirmUser(null);
        }}
        title="このユーザを非表示にしますか？"
        description="このユーザを検索結果などから非表示にします。"
        userName={hideConfirmUser?.name ?? ""}
        userImage={hideConfirmUser?.image ?? null}
        confirmLabel="非表示にする"
        cancelLabel="キャンセル"
        variant="block"
        processing={false}
        onConfirm={async () => {
          if (!hideConfirmUser) return;
          try {
            const res = await fetch(`/api/users/${hideConfirmUser.id}/hidden`, {
              method: "POST",
            });
            if (res.status === 401) {
              window.location.href = "/login";
              return;
            }
            if (!res.ok) {
              console.error("failed to hide user", await res.text());
              return;
            }
            setHiddenUserIds((prev) =>
              prev.includes(hideConfirmUser.id)
                ? prev
                : [...prev, hideConfirmUser.id],
            );
          } catch (e) {
            console.error("failed to hide user", e);
          } finally {
            setHideConfirmUser(null);
          }
        }}
      />

      <FilterModal
        open={filterModalOpen}
        onOpenChange={handleFilterModalOpenChange}
        onReset={handleFilterReset}
        onApply={handleFilterApply}
      >
        {availableJobs.length > 0 && (
          <section className={filterModalStyles.section}>
            <h2 className={filterModalStyles.sectionTitle}>職業</h2>
            <JobFilterPicker
              jobs={availableJobs}
              selectedJobIds={draftFilters.jobIds}
              onChange={(ids) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  jobIds: ids
                    .map((id) => (typeof id === "number" ? id : Number(id)))
                    .filter((id) => !Number.isNaN(id)),
                }))
              }
            />
          </section>
        )}
        <section className={filterModalStyles.section}>
          <h2 className={filterModalStyles.sectionTitle}>フォロー状態</h2>
          <div className={filterModalStyles.toggleRow}>
            <label className={filterModalStyles.toggleItem}>
              <input
                type="checkbox"
                checked={draftFilters.followedOnly}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    followedOnly: e.target.checked,
                  }))
                }
              />
              <span className={filterModalStyles.checkmark} />
              <span>フォロー中のみ</span>
            </label>
          </div>
        </section>
        <section className={filterModalStyles.section}>
          <h2 className={filterModalStyles.sectionTitle}>出品状況</h2>
          <div className={filterModalStyles.toggleRow}>
            <label className={filterModalStyles.toggleItem}>
              <input
                type="checkbox"
                checked={draftFilters.withAppsOnly}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    withAppsOnly: e.target.checked,
                  }))
                }
              />
              <span className={filterModalStyles.checkmark} />
              <span>出品ありのみ</span>
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
    </main>
  );
}
