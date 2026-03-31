"use client";

import Avatar from "@/components/Avatar";
import { ConfirmModal } from "@/components/ConfirmModal";
import { FilterModal } from "@/components/FilterModal";
import filterModalStyles from "@/components/FilterModal.module.scss";
import { cn } from "@/lib/cn";
import { formatTimeAgo } from "@/utils/date";
import { fetcher } from "@/utils/fetcher";
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
import { useEffect, useMemo, useState } from "react";
import HighlightedText from "../../components/HighlightedText";
import SearchBar from "../../components/SearchBar/SearchBar";
import SortMenu, {
  type SortOption,
  SortUtils,
} from "../../components/SortMenu/SortMenu";
import { TagFilterPicker } from "../../components/TagFilterPicker";
import commonStyles from "../../search/common.module.scss";
import LikeButton from "./LikeButton";
import styles from "./RequestList.module.scss";

type Tag = {
  id: number;
  name: string;
};

type Request = {
  publicId: string;
  title: string;
  content: string;
  createdAt: string;
  user: {
    name: string;
    publicId: string;
    image: string | null;
  };
  tags: Tag[];
  likeCount: number;
  isLiked: boolean;
  canManage?: boolean;
};

type RequestFilters = {
  likedOnly: boolean;
  tagIds: number[];
};

const DEFAULT_REQUEST_FILTERS: RequestFilters = {
  likedOnly: false,
  tagIds: [],
};

const parseRequestFilters = (params: {
  get: (key: string) => string | null;
}) => {
  const tagIds = (params.get("f_tags") ?? "")
    .split(",")
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b);

  return {
    likedOnly: params.get("f_liked") === "1",
    tagIds,
  } satisfies RequestFilters;
};

const areRequestFiltersEqual = (a: RequestFilters, b: RequestFilters) =>
  a.likedOnly === b.likedOnly &&
  a.tagIds.length === b.tagIds.length &&
  a.tagIds.every((value, index) => value === b.tagIds[index]);

const applyRequestFiltersToParams = (
  params: URLSearchParams,
  filters: RequestFilters,
) => {
  if (filters.likedOnly) params.set("f_liked", "1");
  else params.delete("f_liked");

  if (filters.tagIds.length > 0) params.set("f_tags", filters.tagIds.join(","));
  else params.delete("f_tags");
};

type Props = {
  initialRequests: Request[];
};

type RequestCardProps = {
  request: Request;
  searchQuery: string;
  currentLikeCount: number;
  currentIsLiked: boolean;
  onLikeCountChange: (publicId: string, newCount: number) => void;
  onLikeStatusChange: (publicId: string, isLiked: boolean) => void;
  onDeleted: (publicId: string) => void;
};

function RequestCard({
  request,
  searchQuery,
  currentLikeCount,
  currentIsLiked,
  onLikeCountChange,
  onLikeStatusChange,
  onDeleted,
}: RequestCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await fetcher(`/api/requests/${request.publicId}`, {
        method: "DELETE",
      });
      setConfirmOpen(false);
      onDeleted(request.publicId);
    } catch (error) {
      console.error("削除エラー:", error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className={styles.requestCardWrapper}>
      <Link
        href={`/requests/${request.publicId}`}
        className={styles.requestCard}
      >
        <div className={styles.requestHeader}>
          <div className={styles.requestTitle}>
            <HighlightedText text={request.title} keyword={searchQuery} />
          </div>
          <span className={styles.requestDate}>
            {formatTimeAgo(request.createdAt)}
          </span>
          {request.canManage && (
            <button
              ref={refs.setReference}
              type="button"
              className={styles.actionMenuBtn}
              data-open={menuOpen ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </button>
          )}
        </div>
        <div className={styles.requestMeta}>
          <Avatar
            src={request.user.image}
            alt={request.user.name}
            className={styles.authorAvatar}
          />
          <span className={styles.authorName}>{request.user.name}</span>
        </div>
        <div className={styles.requestTags}>
          {request.tags.slice(0, 5).map((tag) => (
            <span key={tag.id} className={styles.tag}>
              <HighlightedText text={tag.name} keyword={searchQuery} />
            </span>
          ))}
          {request.tags.length > 5 && (
            <span className={styles.ellipsis}>...</span>
          )}
        </div>
        <div
          className={cn(
            currentLikeCount > 0
              ? styles.fixedReactionWrapper
              : styles.hoverReactionWrapper,
          )}
        >
          <LikeButton
            requestPublicId={request.publicId}
            initialLikeCount={currentLikeCount}
            initialIsLiked={currentIsLiked}
            showCount={currentLikeCount > 0}
            onLikeCountChange={(newCount) =>
              onLikeCountChange(request.publicId, newCount)
            }
            onLikeStatusChange={(isLiked) =>
              onLikeStatusChange(request.publicId, isLiked)
            }
          />
        </div>
      </Link>

      {request.canManage && (
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
                <Link
                  href={`/requests/${request.publicId}/edit`}
                  className={styles.actionMenuItem}
                  onClick={() => setMenuOpen(false)}
                >
                  <span>編集</span>
                  <Image
                    className={styles.editImg}
                    src="/images/edit.png"
                    alt="編集"
                    width={16}
                    height={16}
                  />
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  className={cn(styles.actionMenuItem, styles.delete)}
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmOpen(true);
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
      )}

      <ConfirmModal
        open={confirmOpen}
        message="このリクエストを削除しますか？"
        appName={request.title}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
        confirmLabel={deleting ? "削除中..." : "削除"}
        cancelLabel="キャンセル"
      />
    </article>
  );
}

export default function RequestList({ initialRequests }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [sortedRequests, setSortedRequests] =
    useState<Request[]>(initialRequests);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<RequestFilters>(() =>
    parseRequestFilters(searchParams),
  );
  const [draftFilters, setDraftFilters] = useState<RequestFilters>(filters);
  const [pendingReset, setPendingReset] = useState(false);
  const [deletedRequestIds, setDeletedRequestIds] = useState<string[]>([]);

  const [likeCounts, setLikeCounts] = useState<Record<string, number>>(
    initialRequests.reduce(
      (acc, req) => {
        acc[req.publicId] = req.likeCount;
        return acc;
      },
      {} as Record<string, number>,
    ),
  );
  const [likedStates, setLikedStates] = useState<Record<string, boolean>>(
    initialRequests.reduce(
      (acc, req) => {
        acc[req.publicId] = req.isLiked;
        return acc;
      },
      {} as Record<string, boolean>,
    ),
  );

  const allTags = useMemo(() => {
    const map = new Map<number, Tag>();
    for (const req of initialRequests) {
      for (const tag of req.tags) {
        if (!map.has(tag.id)) {
          map.set(tag.id, tag);
        }
      }
    }
    return Array.from(map.values());
  }, [initialRequests]);

  const sortOptions: SortOption<Request>[] = [
    {
      key: "newest",
      label: "新しい順",
      compareFn: SortUtils.sortByDateNewest,
    },
    {
      key: "oldest",
      label: "古い順",
      compareFn: SortUtils.sortByDateOldest,
    },
    {
      key: "popular",
      label: "人気順",
      compareFn: (a, b) => b.likeCount - a.likeCount,
    },
  ];

  const currentSort = searchParams.get("sort") || "newest";

  const handleSortChange = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", key);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (searchQuery) {
      params.set("q", searchQuery);
    } else {
      params.delete("q");
    }

    const currentQuery = searchParams.toString();
    const nextQuery = params.toString();
    if (currentQuery === nextQuery) return;

    const newUrl = nextQuery ? `?${nextQuery}` : "/requests";
    router.replace(newUrl, { scroll: false });
  }, [router, searchParams, searchQuery]);

  useEffect(() => {
    const restored = parseRequestFilters(searchParams);
    setFilters((current) =>
      areRequestFiltersEqual(current, restored) ? current : restored,
    );
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    applyRequestFiltersToParams(params, filters);
    const currentQuery = searchParams.toString();
    const nextQuery = params.toString();
    if (currentQuery === nextQuery) return;
    const newUrl = nextQuery ? `?${nextQuery}` : "/requests";
    router.replace(newUrl, { scroll: false });
  }, [filters, router, searchParams]);

  const openFilterModal = () => {
    setDraftFilters(filters);
    setPendingReset(false);
    setFilterModalOpen(true);
  };

  const handleFilterModalOpenChange = (open: boolean) => {
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
  };

  const handleFilterReset = () => {
    setDraftFilters(DEFAULT_REQUEST_FILTERS);
    setPendingReset(true);
  };

  const handleFilterApply = () => {
    setFilters(draftFilters);
    setFilterModalOpen(false);
    setPendingReset(false);
  };

  const handleLikeCountChange = (publicId: string, newCount: number) => {
    setLikeCounts((prev) => ({ ...prev, [publicId]: newCount }));
  };

  const handleLikeStatusChange = (publicId: string, isLiked: boolean) => {
    setLikedStates((prev) => ({ ...prev, [publicId]: isLiked }));
  };

  // フィルタリング
  const filteredRequests = useMemo(() => {
    let result = initialRequests.filter(
      (req) => !deletedRequestIds.includes(req.publicId),
    );

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (req) =>
          req.title.toLowerCase().includes(query) ||
          req.content.toLowerCase().includes(query) ||
          req.tags.some((tag) => tag.name.toLowerCase().includes(query)),
      );
    }

    // いいね済みのみ
    if (filters.likedOnly) {
      result = result.filter((req) => {
        const currentLiked = likedStates[req.publicId];
        return currentLiked ?? req.isLiked;
      });
    }

    // タグフィルタ
    if (filters.tagIds.length > 0) {
      result = result.filter((req) =>
        req.tags.some((tag) => filters.tagIds.includes(tag.id)),
      );
    }

    return result;
  }, [initialRequests, searchQuery, filters, likedStates, deletedRequestIds]);

  const handleDeleted = (publicId: string) => {
    setDeletedRequestIds((prev) => [...prev, publicId]);
    setSortedRequests((prev) =>
      prev.filter((req) => req.publicId !== publicId),
    );
  };

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>リクエスト一覧</h1>
        <div className={styles.controls}>
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
                items={filteredRequests}
                options={sortOptions}
                onChange={setSortedRequests}
                value={currentSort}
                onSortChange={handleSortChange}
              />
            </div>
          </div>

          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="リクエストを検索..."
            className={styles.searchBar}
          />
        </div>
      </div>

      <FilterModal
        open={filterModalOpen}
        onOpenChange={handleFilterModalOpenChange}
        onReset={handleFilterReset}
        onApply={handleFilterApply}
      >
        <section className={filterModalStyles.section}>
          <h2 className={filterModalStyles.sectionTitle}>リアクション</h2>
          <div className={filterModalStyles.toggleRow}>
            <label className={filterModalStyles.toggleItem}>
              <input
                type="checkbox"
                checked={draftFilters.likedOnly}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    likedOnly: e.target.checked,
                  }))
                }
              />
              <span className={filterModalStyles.checkmark} />
              <span>いいねしたリクエストのみ</span>
            </label>
          </div>
        </section>

        {allTags.length > 0 && (
          <section className={filterModalStyles.section}>
            <h2 className={filterModalStyles.sectionTitle}>タグ</h2>
            <TagFilterPicker
              tags={allTags}
              selectedTagIds={draftFilters.tagIds}
              onChange={(ids) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  tagIds: ids
                    .map((id) => (typeof id === "number" ? id : Number(id)))
                    .filter((id) => !Number.isNaN(id)),
                }))
              }
            />
          </section>
        )}
      </FilterModal>

      <div className={styles.requestList}>
        {sortedRequests.length === 0 ? (
          <p className={styles.noResults}>
            該当するリクエストが見つかりませんでした
          </p>
        ) : (
          sortedRequests.map((request) => {
            const currentLikeCount =
              likeCounts[request.publicId] ?? request.likeCount;
            const currentIsLiked =
              likedStates[request.publicId] ?? request.isLiked;
            return (
              <RequestCard
                key={request.publicId}
                request={request}
                searchQuery={searchQuery}
                currentLikeCount={currentLikeCount}
                currentIsLiked={currentIsLiked}
                onLikeCountChange={handleLikeCountChange}
                onLikeStatusChange={handleLikeStatusChange}
                onDeleted={handleDeleted}
              />
            );
          })
        )}
      </div>
    </>
  );
}
