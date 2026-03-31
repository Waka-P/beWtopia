"use client";

import Avatar from "@/components/Avatar";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ErrorModal } from "@/components/ErrorModal";
import { FilterModal } from "@/components/FilterModal";
import filterModalStyles from "@/components/FilterModal.module.scss";
import { JoinRequestModal } from "@/components/JoinRequestModal";
import { cn } from "@/lib/cn";
import { formatTimeAgo } from "@/utils/date";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import HighlightedText from "../components/HighlightedText";
import SearchBar from "../components/SearchBar/SearchBar";
import { SkillFilterPicker } from "../components/SkillFilterPicker";
import SortMenu, {
  type SortOption,
  SortUtils,
} from "../components/SortMenu/SortMenu";
import styles from "./Projects.module.scss";

type ProjectMember = {
  id: number;
  name: string;
  image?: string | null;
  joinedAt?: string | null;
};

type Project = {
  id: number;
  publicId: string;
  name: string;
  description: string;
  memberCount: number; // 現在の埋まり（リーダー除く）
  maxMembers: number;
  // 総員（リーダー含む現在の人数）と総キャパシティ（leader + maxMembers）
  totalMemberCount?: number;
  totalCapacity?: number | null;
  skills: string[];
  leaderName: string | null;
  leaderImage?: string | null;
  createdAt: string;
  durationDays: number | null;
  userRoleName?: string | null; // only for joined page
  userRoleNames?: string[];
  // progress is derived from Gantt tasks; null/undefined means "do not show progress"
  progress?: number | null;
  // new fields
  status?: "RECRUITING" | "DEVELOPING" | "COMPLETED";
  members?: ProjectMember[];
  // available roles for applicants to request (非割当)
  availableRoles?: { id: number; name: string }[];
  // ログインユーザーが既に申請済みかどうか
  hasApplied?: boolean;
};

type ProjectFilters = {
  statuses: {
    recruiting: boolean;
    developing: boolean;
    completed: boolean;
  };
  /** 空きのあるプロジェクトのみ */
  onlyNotFull: boolean;
  /** 必要スキル名（いずれかを含むプロジェクトに絞る） */
  skills: string[];
};

const DEFAULT_PROJECT_FILTERS: ProjectFilters = {
  statuses: {
    recruiting: true,
    developing: true,
    completed: true,
  },
  onlyNotFull: false,
  skills: [],
};

const parseProjectFilters = (params: {
  get: (key: string) => string | null;
  getAll: (key: string) => string[];
}) => {
  const statusTokens = (params.get("f_status") ?? "")
    .split(",")
    .filter(Boolean);
  const hasStatusToken = statusTokens.length > 0;
  const statuses = {
    recruiting: hasStatusToken ? statusTokens.includes("recruiting") : true,
    developing: hasStatusToken ? statusTokens.includes("developing") : true,
    completed: hasStatusToken ? statusTokens.includes("completed") : true,
  };

  const skills = params
    .getAll("f_skill")
    .map((value: string) => value.trim())
    .filter(
      (value: string, index: number, arr: string[]) =>
        value.length > 0 && arr.indexOf(value) === index,
    )
    .sort((a: string, b: string) => a.localeCompare(b, "ja"));

  return {
    statuses,
    onlyNotFull: params.get("f_open") === "1",
    skills,
  } satisfies ProjectFilters;
};

const areProjectFiltersEqual = (a: ProjectFilters, b: ProjectFilters) =>
  a.statuses.recruiting === b.statuses.recruiting &&
  a.statuses.developing === b.statuses.developing &&
  a.statuses.completed === b.statuses.completed &&
  a.onlyNotFull === b.onlyNotFull &&
  a.skills.length === b.skills.length &&
  a.skills.every((value, index) => value === b.skills[index]);

const applyProjectFiltersToParams = (
  params: URLSearchParams,
  filters: ProjectFilters,
) => {
  const selectedStatuses = [
    filters.statuses.recruiting ? "recruiting" : null,
    filters.statuses.developing ? "developing" : null,
    filters.statuses.completed ? "completed" : null,
  ].filter((value): value is string => value != null);

  if (selectedStatuses.length === 3) params.delete("f_status");
  else params.set("f_status", selectedStatuses.join(","));

  if (filters.onlyNotFull) params.set("f_open", "1");
  else params.delete("f_open");

  params.delete("f_skill");
  for (const skill of filters.skills) {
    params.append("f_skill", skill);
  }
};

export default function ProjectsList({
  projects,
  isJoined = false,
}: {
  projects: Project[];
  isJoined?: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [sortedProjects, setSortedProjects] = useState<Project[]>(projects);
  const [selectedProject, setSelectedProject] = useState<{
    publicId: string;
    name: string;
    availableRoles?: { id: number; name: string }[];
  } | null>(null);
  const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(
    null,
  );
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<ProjectFilters>(() =>
    parseProjectFilters(searchParams),
  );
  const [draftFilters, setDraftFilters] = useState<ProjectFilters>(filters);
  const [pendingReset, setPendingReset] = useState(false);
  const [closeTarget, setCloseTarget] = useState<{
    publicId: string;
    name: string;
    status?: "RECRUITING" | "DEVELOPING" | "COMPLETED";
  } | null>(null);
  const [closeProcessing, setCloseProcessing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    publicId: string;
    name: string;
  } | null>(null);
  const [deleteProcessing, setDeleteProcessing] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // 一覧上での「申請済み」状態をローカルで管理（サーバーからの hasApplied も初期値に反映）
  const [appliedMap, setAppliedMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const p of projects) {
      if (p.hasApplied) {
        initial[p.publicId] = true;
      }
    }
    return initial;
  });

  // プロジェクト一覧が変わった場合はローカル状態も同期
  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const p of projects) {
      if (p.hasApplied) {
        next[p.publicId] = true;
      }
    }
    setAppliedMap(next);
  }, [projects]);

  // メニュー外をクリックしたらメニューを閉じる
  useEffect(() => {
    if (!openMenuProjectId) return;

    const handleClickOutside = () => {
      setOpenMenuProjectId(null);
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [openMenuProjectId]);

  const backHref = isJoined ? "/bewts" : "/bewts/joined";
  const backLabel = isJoined
    ? "募集中プロジェクト一覧"
    : "参加中プロジェクト一覧";

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

    const basePath = isJoined ? "/bewts/joined" : "/bewts";
    const newUrl = nextQuery ? `${basePath}?${nextQuery}` : basePath;
    router.replace(newUrl, { scroll: false });
  }, [isJoined, router, searchParams, searchQuery]);

  useEffect(() => {
    const restored = parseProjectFilters(searchParams);
    setFilters((current) =>
      areProjectFiltersEqual(current, restored) ? current : restored,
    );
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    applyProjectFiltersToParams(params, filters);
    const currentQuery = searchParams.toString();
    const nextQuery = params.toString();
    if (currentQuery === nextQuery) return;
    const basePath = isJoined ? "/bewts/joined" : "/bewts";
    const nextUrl = nextQuery ? `${basePath}?${nextQuery}` : basePath;
    router.replace(nextUrl, { scroll: false });
  }, [filters, isJoined, router, searchParams]);

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
    setDraftFilters(DEFAULT_PROJECT_FILTERS);
    setPendingReset(true);
  };

  const handleFilterApply = () => {
    setFilters(draftFilters);
    setFilterModalOpen(false);
    setPendingReset(false);
  };

  const filteredProjects = useMemo(() => {
    let result = projects;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) => {
        const inName = p.name.toLowerCase().includes(query);
        const inDescription = p.description.toLowerCase().includes(query);
        const inSkills = p.skills.some((s) => s.toLowerCase().includes(query));
        const inLeader = (p.leaderName ?? "").toLowerCase().includes(query);
        return inName || inDescription || inSkills || inLeader;
      });
    }

    // フィルタ条件
    result = result.filter((p) => {
      const status = p.status;
      const { statuses, onlyNotFull } = filters;

      // ステータス（未設定の場合は常に通す）
      if (status) {
        const matchStatus =
          (status === "RECRUITING" && statuses.recruiting) ||
          (status === "DEVELOPING" && statuses.developing) ||
          (status === "COMPLETED" && statuses.completed);
        if (!matchStatus) return false;
      }

      // 空きのあるプロジェクトのみ
      if (
        onlyNotFull &&
        p.maxMembers != null &&
        p.memberCount >= p.maxMembers
      ) {
        return false;
      }

      // スキルフィルタ（指定されたスキル名のいずれかを含む場合に通す）
      if (filters.skills.length > 0) {
        const skillSet = new Set(filters.skills);
        const hasRequiredSkill = p.skills.some((s) => skillSet.has(s));
        if (!hasRequiredSkill) return false;
      }

      return true;
    });

    return result;
  }, [projects, searchQuery, filters]);

  const sortOptions: SortOption<Project>[] = useMemo(
    () => [
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
        key: "members_desc",
        label: "人数順",
        compareFn: (a, b) => b.memberCount - a.memberCount,
      },
    ],
    [],
  );

  const currentSort = searchParams.get("sort") || "newest";

  const handleSortChange = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", key);

    const basePath = isJoined ? "/bewts/joined" : "/bewts";
    const newUrl = params.toString()
      ? `${basePath}?${params.toString()}`
      : basePath;
    router.replace(newUrl, { scroll: false });
  };

  const availableSkills = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      p.skills.forEach((s) => {
        if (s.trim().length > 0) {
          set.add(s);
        }
      });
    });
    return Array.from(set).map((name) => ({ id: name, name }));
  }, [projects]);

  const handleCloseRecruiting = async () => {
    if (!closeTarget || closeProcessing) return;

    setCloseProcessing(true);
    try {
      const response = await fetch(
        `/api/bewts/${closeTarget.publicId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "DEVELOPING" }),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          (data?.error as string | undefined) || "募集の締切に失敗しました",
        );
      }

      setCloseTarget(null);
      router.refresh();
    } catch (error) {
      setErrorModal({
        title: "締切に失敗しました",
        message:
          error instanceof Error
            ? error.message
            : "時間をおいて再度お試しください。",
      });
    } finally {
      setCloseProcessing(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteTarget || deleteProcessing) return;

    setDeleteProcessing(true);
    try {
      const response = await fetch(`/api/bewts/${deleteTarget.publicId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          (data?.error as string | undefined) ||
            "プロジェクトの削除に失敗しました",
        );
      }

      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      setErrorModal({
        title: "削除に失敗しました",
        message:
          error instanceof Error
            ? error.message
            : "時間をおいて再度お試しください。",
      });
    } finally {
      setDeleteProcessing(false);
    }
  };

  return (
    <div>
      <div className={styles.topRow}>
        <Link href={backHref} className={styles.trail}>
          <span className={styles.trailArrow}>&#9664;</span>
          {backLabel}
        </Link>
      </div>
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>
            {isJoined ? "参加中プロジェクト一覧" : "募集中プロジェクト一覧"}
          </h1>
          <div className={styles.headerControls}>
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
                <SortMenu
                  items={filteredProjects}
                  options={sortOptions}
                  onChange={setSortedProjects}
                  value={currentSort}
                  onSortChange={handleSortChange}
                />
              </div>
            </div>
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="プロジェクトを検索"
              className={styles.searchBar}
            />
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className={styles.emptyState}>
            {isJoined
              ? "参加中のプロジェクトはありません"
              : "募集中のプロジェクトはありません"}
          </div>
        ) : (
          <div className={styles.projectsGrid}>
            {sortedProjects.map((p) => {
              const isApplied = appliedMap[p.publicId] || p.hasApplied;
              const myRoleNames =
                p.userRoleNames && p.userRoleNames.length > 0
                  ? p.userRoleNames
                  : p.userRoleName
                    ? [p.userRoleName]
                    : [];
              const isLeader = myRoleNames.includes("リーダー");
              const isMenuOpen = isLeader && openMenuProjectId === p.publicId;
              const statusClass =
                p.status === "RECRUITING"
                  ? "recruiting"
                  : p.status === "DEVELOPING"
                    ? "developing"
                    : "completed";
              const statusLabel =
                p.status === "RECRUITING"
                  ? "募集中"
                  : p.status === "DEVELOPING"
                    ? "開発中"
                    : "完了";
              // Prefer Gantt-derived progress when available; otherwise do not show a progress bar
              const hasGanttProgress = typeof p.progress === "number";
              const progressValue = hasGanttProgress
                ? Math.max(0, Math.min(100, Math.round(p.progress as number)))
                : null;

              return (
                <div className={styles.cardWrapper} key={p.id}>
                  <Link href={`/bewts/${p.publicId}`} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <h2 className={styles.cardTitle}>
                        <HighlightedText text={p.name} keyword={searchQuery} />
                      </h2>
                      <div className={styles.cardHeaderRight}>
                        {!isLeader && (
                          <div
                            className={cn(
                              styles.statusBadge,
                              styles[statusClass],
                              statusClass,
                            )}
                          >
                            <span className={styles.statusDot} />
                            {statusLabel}
                          </div>
                        )}
                        {isLeader && (
                          <>
                            <div
                              className={cn(
                                styles.statusBadge,
                                styles[statusClass],
                                statusClass,
                                styles.leaderStatus,
                                isMenuOpen && styles.hideLeaderStatus,
                              )}
                            >
                              <span className={styles.statusDot} />
                              {statusLabel}
                            </div>
                            <button
                              type="button"
                              className={cn(
                                styles.actionMenuBtn,
                                styles.leaderMenuBtn,
                                isMenuOpen && styles.showLeaderMenuBtn,
                              )}
                              aria-label="menu"
                              aria-haspopup="true"
                              aria-expanded={isMenuOpen}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenMenuProjectId((prev) =>
                                  prev === p.publicId ? null : p.publicId,
                                );
                              }}
                            >
                              <span className={styles.dot} />
                              <span className={styles.dot} />
                              <span className={styles.dot} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {!isJoined && (
                      <p className={styles.cardDesc}>
                        <HighlightedText
                          text={p.description}
                          keyword={searchQuery}
                        />
                      </p>
                    )}

                    {isJoined && (
                      <p className={styles.roleLabel}>
                        あなたの役割：
                        <strong>
                          {myRoleNames.length > 0
                            ? myRoleNames.join(" / ")
                            : "メンバー"}
                        </strong>
                      </p>
                    )}

                    <div className={styles.userRow}>
                      <div className={styles.userInfo}>
                        <div className={styles.leaderAvatar}>
                          <Avatar
                            src={p.leaderImage || null}
                            alt={`${p.leaderName}さんのアイコン`}
                            className={styles.avatar}
                          />
                          <Image
                            src="/images/leader.png"
                            alt="リーダー"
                            className={styles.leaderBadge}
                            width={20}
                            height={20}
                          />
                        </div>
                        <span className={styles.username}>
                          {p.leaderName ?? "—"}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div className={styles.memberAvatars}>
                          {(p.members ?? []).slice(0, 4).map((m) => (
                            <div
                              key={m.id}
                              title={m.name}
                              className={styles.memberBubble}
                            >
                              <Avatar
                                src={m.image || null}
                                alt={`${m.name}さんのアイコン`}
                                className={styles.memberAvatar}
                              />
                            </div>
                          ))}
                          {(p.members ?? []).length > 4 && (
                            <div
                              className={cn(
                                styles.memberBubble,
                                styles.moreBubble,
                              )}
                            >
                              +{(p.members ?? []).length - 4}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            flexShrink: 0,
                          }}
                        >
                          <span className={styles.memberCount}>
                            {p.memberCount}/{p.maxMembers}名
                          </span>
                          {typeof p.totalCapacity === "number" && (
                            <small style={{ color: "#8ba0b8" }}>
                              （総員: {p.totalMemberCount}/{p.totalCapacity}名）
                            </small>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={styles.tags}>
                      {p.skills.map((s) => (
                        <span className={styles.tag} key={s}>
                          <HighlightedText text={s} keyword={searchQuery} />
                        </span>
                      ))}
                    </div>

                    <div className={styles.cardMeta}>
                      <span className={styles.createdAt}>
                        <Image
                          src="/images/calendar.png"
                          alt="作成日"
                          width={16}
                          height={16}
                        />
                        {formatTimeAgo(p.createdAt)}に作成
                      </span>
                      <span className={styles.duration}>
                        <Image
                          src="/images/timer.png"
                          alt="期間"
                          width={16}
                          height={16}
                        />
                        {p.durationDays
                          ? `${p.durationDays}日間`
                          : "期間未設定"}
                      </span>
                    </div>

                    <div className={styles.cardFooter}>
                      <div className={styles.cardMeta}>
                        {hasGanttProgress && progressValue !== null ? (
                          <div className={styles.progressSection}>
                            <div className={styles.progressLabel}>
                              進捗：{progressValue}%
                            </div>
                            <div className={styles.progressTrack}>
                              <div
                                className={styles.progressFill}
                                style={{ width: `${progressValue}%` }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className={styles.cardMeta}>
                        {/* placeholder to keep spacing inside the Link */}
                      </div>
                    </div>
                  </Link>

                  {isLeader && (
                    <div
                      className={cn(
                        styles.actionMenu,
                        isMenuOpen && styles.show,
                      )}
                      role="menu"
                      aria-hidden={!isMenuOpen}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <ul>
                        <li>
                          <button
                            type="button"
                            className={styles.actionMenuItem}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setOpenMenuProjectId(null);
                              router.push(`/bewts/${p.publicId}/settings/edit`);
                            }}
                          >
                            <span>編集</span>
                            <Image
                              className={styles.actionMenuIcon}
                              src="/images/edit.png"
                              alt="編集"
                              width={15}
                              height={15}
                            />
                          </button>
                        </li>
                        {p.status === "RECRUITING" && (
                          <li>
                            <button
                              type="button"
                              className={styles.actionMenuItem}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenMenuProjectId(null);
                                setCloseTarget({
                                  publicId: p.publicId,
                                  name: p.name,
                                  status: p.status,
                                });
                              }}
                            >
                              <span>締切</span>
                              <Image
                                className={styles.actionMenuIcon}
                                src="/images/finish.png"
                                alt="締切"
                                width={15}
                                height={15}
                              />
                            </button>
                          </li>
                        )}
                        <li>
                          <button
                            type="button"
                            className={styles.actionMenuItem}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setOpenMenuProjectId(null);
                              setDeleteTarget({
                                publicId: p.publicId,
                                name: p.name,
                              });
                            }}
                          >
                            <span>削除</span>
                            <Image
                              className={styles.actionMenuIcon}
                              src="/images/delete.png"
                              alt="削除"
                              width={15}
                              height={15}
                            />
                          </button>
                        </li>
                      </ul>
                    </div>
                  )}

                  <div className={styles.cardOverlayActions}>
                    {isJoined ? (
                      <Link
                        href={`/bewts/${p.publicId}/chat`}
                        className={styles.btnChat}
                      >
                        チャット
                      </Link>
                    ) : isApplied ? (
                      <button
                        type="button"
                        className={styles.joinRequested}
                        disabled
                      >
                        申請済み
                      </button>
                    ) : p.maxMembers != null &&
                      p.memberCount >= p.maxMembers ? (
                      <div style={{ color: "var(--error)", fontWeight: 700 }}>
                        満員
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.btnJoin}
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedProject({
                            publicId: p.publicId,
                            name: p.name,
                            availableRoles: p.availableRoles ?? [],
                          });
                        }}
                      >
                        参加申請
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 参加申請モーダル */}
      {selectedProject && (
        <JoinRequestModal
          open={!!selectedProject}
          onOpenChange={(open) => !open && setSelectedProject(null)}
          projectName={selectedProject.name}
          projectPublicId={selectedProject.publicId}
          availableRoles={selectedProject.availableRoles ?? []}
          onSuccess={() => {
            if (selectedProject) {
              setAppliedMap((prev) => ({
                ...prev,
                [selectedProject.publicId]: true,
              }));
            }
            setSelectedProject(null);
          }}
        />
      )}

      {/* 一覧フィルターモーダル */}
      <FilterModal
        open={filterModalOpen}
        onOpenChange={handleFilterModalOpenChange}
        onReset={handleFilterReset}
        onApply={handleFilterApply}
      >
        {availableSkills.length > 0 && (
          <section className={filterModalStyles.section}>
            <h2 className={filterModalStyles.sectionTitle}>スキル</h2>
            <SkillFilterPicker
              skills={availableSkills}
              selectedSkillIds={draftFilters.skills}
              onChange={(ids) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  skills: ids
                    .map((id) => String(id).trim())
                    .filter((name) => name.length > 0),
                }))
              }
            />
          </section>
        )}
        <section className={filterModalStyles.section}>
          <h2 className={filterModalStyles.sectionTitle}>ステータス</h2>
          <div className={filterModalStyles.chipRow}>
            <button
              type="button"
              className={cn(
                filterModalStyles.chipButton,
                draftFilters.statuses.recruiting &&
                  filterModalStyles.chipButtonActive,
              )}
              onClick={() =>
                setDraftFilters((prev) => ({
                  ...prev,
                  statuses: {
                    ...prev.statuses,
                    recruiting: !prev.statuses.recruiting,
                  },
                }))
              }
            >
              <span className={filterModalStyles.chipDot} />
              <span>募集中</span>
            </button>
            <button
              type="button"
              className={cn(
                filterModalStyles.chipButton,
                draftFilters.statuses.developing &&
                  filterModalStyles.chipButtonActive,
              )}
              onClick={() =>
                setDraftFilters((prev) => ({
                  ...prev,
                  statuses: {
                    ...prev.statuses,
                    developing: !prev.statuses.developing,
                  },
                }))
              }
            >
              <span className={filterModalStyles.chipDot} />
              <span>開発中</span>
            </button>
            <button
              type="button"
              className={cn(
                filterModalStyles.chipButton,
                draftFilters.statuses.completed &&
                  filterModalStyles.chipButtonActive,
              )}
              onClick={() =>
                setDraftFilters((prev) => ({
                  ...prev,
                  statuses: {
                    ...prev.statuses,
                    completed: !prev.statuses.completed,
                  },
                }))
              }
            >
              <span className={filterModalStyles.chipDot} />
              <span>完了</span>
            </button>
          </div>
        </section>

        <section className={filterModalStyles.section}>
          <h2 className={filterModalStyles.sectionTitle}>募集状況</h2>
          <div className={filterModalStyles.toggleRow}>
            <label className={filterModalStyles.toggleItem}>
              <input
                type="checkbox"
                checked={draftFilters.onlyNotFull}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    onlyNotFull: e.target.checked,
                  }))
                }
              />
              <span className={filterModalStyles.checkmark} />
              <span>空きのあるプロジェクトのみ</span>
            </label>
          </div>
        </section>
      </FilterModal>

      <ConfirmModal
        open={Boolean(closeTarget)}
        title="募集を締め切りますか？"
        message="ステータスを「開発中」に変更します。"
        appName={closeTarget?.name}
        confirmLabel={closeProcessing ? "処理中..." : "締め切る"}
        cancelLabel="キャンセル"
        onCancel={() => {
          if (closeProcessing) return;
          setCloseTarget(null);
        }}
        onConfirm={() => {
          void handleCloseRecruiting();
        }}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="プロジェクトを削除しますか？"
        message="この操作は取り消せません。"
        appName={deleteTarget?.name}
        confirmLabel={deleteProcessing ? "削除中..." : "削除する"}
        cancelLabel="キャンセル"
        onCancel={() => {
          if (deleteProcessing) return;
          setDeleteTarget(null);
        }}
        onConfirm={() => {
          void handleDeleteProject();
        }}
      />

      <ErrorModal
        open={Boolean(errorModal)}
        onClose={() => setErrorModal(null)}
        title={errorModal?.title ?? ""}
        message={errorModal?.message ?? ""}
      />
    </div>
  );
}
