"use client";

import { useTabIndicator } from "@/app/(sidebar)/components/useTabIndicator";
import { ConfirmModal } from "@/components/ConfirmModal";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import Image from "next/image";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FaPlus } from "react-icons/fa6";
import { DetailPanel } from "./DetailPanel";
import styles from "./GanttChart.module.scss";
import {
  type ApiBewtsRoomResponse,
  type ApiGanttResponse,
  type ApiGanttTask,
  type AssigneeUser,
  type BewtsRole,
  dateToX,
  extractAssigneesFromTask,
  formatLocalDateInputValue,
  formatLocalDateTimeInputValue,
  type GanttSegment,
  type GanttTask,
  generateColumns,
  getBaseAssigneeIdsFromTask,
  getPixelsPerMs,
  normalizeSegments,
  parseLocalDateInput,
  segmentsOverlap,
  type SessionLike,
  snapToUnit,
  type StatusFilter,
  VIEW_CONFIG,
  type ViewMode,
} from "./ganttShared";
import { SortableTaskRow } from "./SortableTaskRow";

// ============ MAIN COMPONENT ============
export function GanttChart({
  roomId,
  isAllRoom,
  roles,
}: {
  roomId: number;
  isAllRoom: boolean;
  roles: BewtsRole[];
}) {
  const SKELETON_FADE_MS = 250;
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSkeletonMounted, setIsSkeletonMounted] = useState(true);
  const [isSkeletonVisible, setIsSkeletonVisible] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const {
    tabbedRef: viewTabbedRef,
    indicatorRef: viewIndicatorRef,
    updateTabIndicator: updateViewIndicator,
  } = useTabIndicator<ViewMode>(viewMode);
  const {
    tabbedRef: statusTabbedRef,
    indicatorRef: statusIndicatorRef,
    updateTabIndicator: updateStatusIndicator,
  } = useTabIndicator<StatusFilter>(statusFilter);
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);
  const { data: session } = authClient.useSession();
  const currentUserId = useMemo(() => {
    const rawId = (session as SessionLike | null)?.user?.id;
    const n = Number(rawId);
    return Number.isFinite(n) ? n : null;
  }, [session]);
  const createInitialRange = useCallback(() => {
    const center = new Date();
    center.setHours(0, 0, 0, 0);
    const spanMs = 86_400_000 * 90;
    return {
      start: new Date(center.getTime() - spanMs / 2),
      end: new Date(center.getTime() + spanMs / 2),
    };
  }, []);
  const [viewStart, setViewStart] = useState<Date>(() => {
    return createInitialRange().start;
  });
  const [viewEnd, setViewEnd] = useState<Date>(() => {
    return createInitialRange().end;
  });

  const dragRef = useRef<{
    taskId: number;
    segIdx: number;
    mode: "move" | "resize-left" | "resize-right";
    startClientX: number;
    originalStart: Date;
    originalEnd: Date;
  } | null>(null);

  const [assigneeUsers, setAssigneeUsers] = useState<AssigneeUser[]>([]);
  const ganttContainerRef = useRef<HTMLDivElement | null>(null);
  const hasAppliedInitialTodayScrollRef = useRef(false);
  const todayScrollEndTimerRef = useRef<number | null>(null);
  const todayScrollSessionRef = useRef(false);
  const [isTodayScrolling, setIsTodayScrolling] = useState(false);

  const clearTodayScrollEndTimer = useCallback(() => {
    if (todayScrollEndTimerRef.current != null) {
      window.clearTimeout(todayScrollEndTimerRef.current);
      todayScrollEndTimerRef.current = null;
    }
  }, []);

  const finishTodayScrollSession = useCallback(() => {
    todayScrollSessionRef.current = false;
    setIsTodayScrolling(false);
    clearTodayScrollEndTimer();
  }, [clearTodayScrollEndTimer]);

  const scheduleTodayScrollEndFallback = useCallback(() => {
    clearTodayScrollEndTimer();
    todayScrollEndTimerRef.current = window.setTimeout(() => {
      finishTodayScrollSession();
    }, 2000);
  }, [clearTodayScrollEndTimer, finishTodayScrollSession]);

  // 初期表示 & ローディング完了後にもインジケータを表示する
  useEffect(() => {
    if (loading) return;
    let rafId: number | null = null;
    const timeoutId = window.setTimeout(() => {
      rafId = window.requestAnimationFrame(() => {
        updateViewIndicator();
        updateStatusIndicator();
      });
    }, SKELETON_FADE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      if (rafId != null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [loading, updateViewIndicator, updateStatusIndicator]);

  // 担当者候補（チャットメンバー）を取得
  useEffect(() => {
    const loadMembers = async () => {
      try {
        const res = await fetch(`/api/bewts/rooms/${roomId}`);
        if (!res.ok) return;
        const data = (await res.json()) as ApiBewtsRoomResponse;
        const map = new Map<number, AssigneeUser>();
        (data.members ?? []).forEach((m) => {
          if (m.user) {
            map.set(m.user.id, {
              id: m.user.id,
              name: m.user.name ?? "",
              image: m.user.image ?? null,
            });
          }
        });
        setAssigneeUsers(Array.from(map.values()));
      } catch (e) {
        console.error("Failed to load bewts room members for gantt", e);
      }
    };

    loadMembers();
  }, [roomId]);

  // Fetch chart data
  const fetchChart = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bewts/rooms/${roomId}/gantt`);
      if (!res.ok) return;
      const data = (await res.json()) as ApiGanttResponse;
      const normalizedTasks: GanttTask[] = (data.tasks ?? []).map((t) => {
        const segments = normalizeSegments(t.segments ?? []);
        const assignees = extractAssigneesFromTask(t);
        return {
          ...t,
          assignees,
          segments,
        };
      });
      setTasks(normalizedTasks);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchChart();
  }, [fetchChart]);

  useEffect(() => {
    let rafId: number | null = null;
    let timeoutId: number | null = null;

    if (loading) {
      setIsSkeletonMounted(true);
      rafId = window.requestAnimationFrame(() => {
        setIsSkeletonVisible(true);
      });
    } else {
      setIsSkeletonVisible(false);
      timeoutId = window.setTimeout(() => {
        setIsSkeletonMounted(false);
      }, SKELETON_FADE_MS);
    }

    return () => {
      if (rafId != null) {
        window.cancelAnimationFrame(rafId);
      }
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [loading]);

  useEffect(() => {
    const el = ganttContainerRef.current;
    if (!el) return;

    const onScroll = () => {
      if (!todayScrollSessionRef.current) return;
      setIsTodayScrolling(true);
    };

    const onScrollEnd = () => {
      if (!todayScrollSessionRef.current) return;
      finishTodayScrollSession();
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", onScrollEnd as EventListener);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", onScrollEnd as EventListener);
    };
  }, [finishTodayScrollSession]);

  useEffect(() => {
    return () => {
      clearTodayScrollEndTimer();
    };
  }, [clearTodayScrollEndTimer]);

  const pxPerMs = getPixelsPerMs(viewMode);

  const numCols = useMemo(() => {
    const cfg = VIEW_CONFIG[viewMode];
    const spanMs = Math.max(viewEnd.getTime() - viewStart.getTime(), 0);
    return Math.max(Math.floor(spanMs / cfg.cellMs) + 1, 4);
  }, [viewStart, viewEnd, viewMode]);

  const columns = useMemo(
    () => generateColumns(viewStart, numCols, viewMode),
    [viewStart, numCols, viewMode],
  );

  const totalColWidth = useMemo(() => {
    if (columns.length === 0) return 800;
    const lastCol = columns[columns.length - 1];
    return (
      Math.round(dateToX(lastCol.startDate, viewStart, pxPerMs)) +
      VIEW_CONFIG[viewMode].cellWidth
    );
  }, [columns, viewStart, pxPerMs, viewMode]);

  useEffect(() => {
    if (loading) return;
    if (hasAppliedInitialTodayScrollRef.current) return;

    let rafId: number | null = null;
    let isDisposed = false;
    let attempt = 0;
    const maxAttempts = 20;

    const tryScrollToToday = () => {
      if (isDisposed || hasAppliedInitialTodayScrollRef.current) return;

      const container = ganttContainerRef.current;
      if (!container) {
        if (attempt < maxAttempts) {
          attempt += 1;
          rafId = window.requestAnimationFrame(tryScrollToToday);
        }
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayX = Math.round(dateToX(today, viewStart, pxPerMs));
      const maxScrollLeft = Math.max(
        container.scrollWidth - container.clientWidth,
        0,
      );
      const nextScrollLeft = Math.max(0, Math.min(todayX, maxScrollLeft));

      container.scrollLeft = nextScrollLeft;
      hasAppliedInitialTodayScrollRef.current = true;
    };

    const timeoutId = window.setTimeout(() => {
      rafId = window.requestAnimationFrame(tryScrollToToday);
    }, SKELETON_FADE_MS);

    return () => {
      isDisposed = true;
      window.clearTimeout(timeoutId);
      if (rafId != null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [loading, viewStart, pxPerMs]);

  const filteredTasks = useMemo(() => {
    let base = tasks;

    if (onlyMyTasks && currentUserId != null) {
      base = base.filter((t) => {
        const assigneeIds = getBaseAssigneeIdsFromTask(t);
        return assigneeIds.includes(currentUserId);
      });
    }

    if (statusFilter === "all") return base;
    if (statusFilter === "incomplete")
      return base.filter((t) => t.status !== "完了");
    return base.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter, onlyMyTasks, currentUserId]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setTasks((prev) => {
        const oldIdx = prev.findIndex((t) => t.id === active.id);
        const newIdx = prev.findIndex((t) => t.id === over.id);
        const reordered = arrayMove(prev, oldIdx, newIdx).map((t, i) => ({
          ...t,
          displayOrder: i + 1,
        }));
        fetch(`/api/bewts/rooms/${roomId}/gantt/tasks/reorder`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds: reordered.map((t) => t.id) }),
        });
        return reordered;
      });
    },
    [roomId],
  );

  // Bar drag
  const handleBarDragStart = useCallback(
    (e: ReactPointerEvent, taskId: number, segIdx: number) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const seg = task.segments[segIdx];
      dragRef.current = {
        taskId,
        segIdx,
        mode: "move",
        startClientX: e.clientX,
        originalStart: new Date(seg.startAt),
        originalEnd: new Date(seg.endAt),
      };
    },
    [tasks],
  );

  const handleBarResizeStart = useCallback(
    (
      e: ReactPointerEvent,
      taskId: number,
      segIdx: number,
      side: "left" | "right",
    ) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const seg = task.segments[segIdx];
      dragRef.current = {
        taskId,
        segIdx,
        mode: side === "left" ? "resize-left" : "resize-right",
        startClientX: e.clientX,
        originalStart: new Date(seg.startAt),
        originalEnd: new Date(seg.endAt),
      };
    },
    [tasks],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startClientX;
      const dMs = dx / pxPerMs;
      const snappedDMs = snapToUnit(dMs, VIEW_CONFIG[viewMode].snapMs);

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== drag.taskId) return t;

          const segments = t.segments.map((s) => ({ ...s }));
          const seg = segments[drag.segIdx];
          if (!seg) return t;

          let newStart = new Date(drag.originalStart);
          let newEnd = new Date(drag.originalEnd);

          if (drag.mode === "move") {
            newStart = new Date(drag.originalStart.getTime() + snappedDMs);
            newEnd = new Date(drag.originalEnd.getTime() + snappedDMs);
          } else if (drag.mode === "resize-left") {
            newStart = new Date(drag.originalStart.getTime() + snappedDMs);
            if (newStart >= drag.originalEnd) return t;
          } else if (drag.mode === "resize-right") {
            newEnd = new Date(drag.originalEnd.getTime() + snappedDMs);
            if (newEnd <= drag.originalStart) return t;
          }

          if (segmentsOverlap(segments, drag.segIdx, newStart, newEnd)) {
            return t;
          }

          segments[drag.segIdx] = {
            ...seg,
            startAt: newStart.toISOString(),
            endAt: newEnd.toISOString(),
          };

          return {
            ...t,
            segments,
          };
        }),
      );
    },
    [pxPerMs, viewMode],
  );

  const handlePointerUp = useCallback(async () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;

    // persist: use latest tasks state
    setTasks((prev) => {
      const task = prev.find((t) => t.id === drag.taskId);
      if (task) {
        if (!task.isNew) {
          fetch(`/api/bewts/rooms/${roomId}/gantt/tasks/${drag.taskId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ segments: task.segments }),
          });
        }
      }
      return prev;
    });
  }, [roomId]);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const handleNewTask = useCallback(async () => {
    const now = new Date();
    now.setHours(9, 0, 0, 0);

    setTasks((prev) => {
      const existingDraft = prev.find((t) => t.isNew);
      if (existingDraft) {
        setSelectedTaskId(existingDraft.id);
        setPanelVisible(true);
        return prev;
      }

      const tempId =
        prev.length === 0 ? -1 : Math.min(...prev.map((t) => t.id)) - 1;

      const segments: GanttSegment[] = [
        {
          id: null,
          startAt: now.toISOString(),
          endAt: new Date(now.getTime() + 3 * 86_400_000).toISOString(),
          color: null,
          label: "期間 1",
          note: "",
          order: 0,
        },
      ];

      const draftTask: GanttTask = {
        id: tempId,
        name: "新しいタスク",
        description: "",
        progress: 0,
        status: "未着手",
        memo: "",
        color: null,
        displayOrder: prev.length + 1,
        assigneeId: null,
        assignee: null,
        assignees: [],
        segments,
        isNew: true,
      };

      setSelectedTaskId(tempId);
      setPanelVisible(true);
      return [...prev, draftTask];
    });
  }, []);

  const handleSaveTask = useCallback(
    async (updated: Partial<GanttTask> & { assigneeUserIds?: number[] }) => {
      if (selectedTaskId == null) return;
      const currentTask = tasks.find((t) => t.id === selectedTaskId);
      if (!currentTask) return;

      if (currentTask.isNew) {
        const res = await fetch(`/api/bewts/rooms/${roomId}/gantt/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: updated.name ?? currentTask.name,
            description: updated.description ?? currentTask.description ?? "",
            status: updated.status ?? currentTask.status,
            progress: updated.progress ?? currentTask.progress,
            memo: updated.memo ?? currentTask.memo ?? "",
            color: updated.color ?? currentTask.color,
            segments: updated.segments ?? currentTask.segments,
            assigneeUserIds:
              updated.assigneeUserIds ??
              getBaseAssigneeIdsFromTask(currentTask),
          }),
        });

        if (res.ok) {
          const createdRaw = (await res.json()) as ApiGanttTask;
          const segments = normalizeSegments(createdRaw.segments ?? []);
          const assignees = extractAssigneesFromTask(createdRaw);

          const created: GanttTask = {
            ...createdRaw,
            segments,
            assignees,
          };

          setTasks((prev) =>
            prev.map((t) => (t.id === selectedTaskId ? created : t)),
          );
          setSelectedTaskId(created.id);
        }
      } else {
        const res = await fetch(
          `/api/bewts/rooms/${roomId}/gantt/tasks/${selectedTaskId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updated),
          },
        );
        if (res.ok) {
          const saved = (await res.json()) as ApiGanttTask;
          const segments = normalizeSegments(saved.segments ?? []);
          const assignees = extractAssigneesFromTask(saved);
          setTasks((prev) =>
            prev.map((t) =>
              t.id === selectedTaskId
                ? ({
                    ...saved,
                    segments,
                    assignees,
                  } as GanttTask)
                : t,
            ),
          );
        }
      }
    },
    [roomId, selectedTaskId, tasks],
  );

  const handleDeleteTask = useCallback(async () => {
    if (selectedTaskId == null) return;
    const currentTask = tasks.find((t) => t.id === selectedTaskId);
    if (!currentTask) return;

    if (currentTask.isNew) {
      setTasks((prev) => prev.filter((t) => t.id !== selectedTaskId));
      setSelectedTaskId(null);
      setIsDeleteModalOpen(false);
      return;
    }

    setIsDeletingTask(true);
    const res = await fetch(
      `/api/bewts/rooms/${roomId}/gantt/tasks/${selectedTaskId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== selectedTaskId));
      setSelectedTaskId(null);
      setIsDeleteModalOpen(false);
    }
    setIsDeletingTask(false);
  }, [roomId, selectedTaskId, tasks]);

  const handleDownload = useCallback(async () => {
    const res = await fetch(`/api/bewts/rooms/${roomId}/gantt/download`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const cd = res.headers.get("Content-Disposition") ?? "";
    const match = cd.match(/filename\*=UTF-8''(.+)/);
    a.download = match
      ? decodeURIComponent(match[1])
      : `ガントチャート_room${roomId}.xlsx`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  }, [roomId]);

  const navigate = useCallback(
    (direction: -1 | 1) => {
      const span = viewEnd.getTime() - viewStart.getTime();
      const shift = span / 2;
      setViewStart((prev) => new Date(prev.getTime() + direction * shift));
      setViewEnd((prev) => new Date(prev.getTime() + direction * shift));
    },
    [viewStart, viewEnd],
  );

  const jumpToToday = useCallback(() => {
    const container = ganttContainerRef.current;
    if (!container) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayX = Math.round(dateToX(today, viewStart, pxPerMs));
    const maxScrollLeft = Math.max(
      container.scrollWidth - container.clientWidth,
      0,
    );
    const nextScrollLeft = Math.max(0, Math.min(todayX, maxScrollLeft));

    todayScrollSessionRef.current = true;
    setIsTodayScrolling(true);
    container.scrollTo({
      left: nextScrollLeft,
      behavior: "smooth",
    });
    scheduleTodayScrollEndFallback();
  }, [viewStart, pxPerMs, scheduleTodayScrollEndFallback]);

  const statusCounts = useMemo(() => {
    const todo = tasks.filter((t) => t.status === "未着手").length;
    const wip = tasks.filter((t) => t.status === "作業中").length;
    const done = tasks.filter((t) => t.status === "完了").length;
    return { todo, wip, done };
  }, [tasks]);

  // Group headers for top header row
  const groupHeaders = useMemo(() => {
    const groups: { label: string; startX: number; endX: number }[] = [];
    let cur: { label: string; startX: number; endX: number } | null = null;
    const cfg = VIEW_CONFIG[viewMode];
    for (const col of columns) {
      const x = Math.round(dateToX(col.startDate, viewStart, pxPerMs));
      if (col.isGroupStart && col.groupLabel) {
        if (cur) groups.push(cur);
        cur = { label: col.groupLabel, startX: x, endX: x + cfg.cellWidth };
      } else if (cur) {
        cur.endX = x + cfg.cellWidth;
      }
    }
    if (cur) groups.push(cur);
    return groups;
  }, [columns, viewStart, pxPerMs, viewMode]);

  if (isSkeletonMounted) {
    return (
      <div className={styles.root}>
        <div
          className={cn(
            styles.loadingSkeleton,
            isSkeletonVisible
              ? styles.loadingSkeletonVisible
              : styles.loadingSkeletonHidden,
          )}
          aria-hidden="true"
        >
          <div className={styles.loadingSkeletonTopBar}>
            <div className={cn(styles.skeletonBlock, styles.skeletonLabel)} />
            <div className={cn(styles.skeletonBlock, styles.skeletonTabs)} />
          </div>

          <div className={styles.loadingSkeletonStatusBar}>
            <div className={cn(styles.skeletonBlock, styles.skeletonLabel)} />
            <div
              className={cn(styles.skeletonBlock, styles.skeletonTabsWide)}
            />
            <div className={cn(styles.skeletonBlock, styles.skeletonButton)} />
            <div className={cn(styles.skeletonBlock, styles.skeletonBadges)} />
          </div>

          <div className={styles.loadingSkeletonMain}>
            <div className={styles.loadingSkeletonHeader}>
              <div
                className={cn(styles.skeletonBlock, styles.skeletonTinyButton)}
              />
              <div
                className={cn(styles.skeletonBlock, styles.skeletonDateRange)}
              />
              <div
                className={cn(styles.skeletonBlock, styles.skeletonTinyButton)}
              />
              <div
                className={cn(styles.skeletonBlock, styles.skeletonTodayButton)}
              />
              <div
                className={cn(styles.skeletonBlock, styles.skeletonCheckbox)}
              />
            </div>

            <div className={styles.loadingSkeletonTable}>
              {Array.from(
                { length: 6 },
                (_, i) => `gantt-skeleton-row-${i}`,
              ).map((rowKey) => (
                <div key={rowKey} className={styles.loadingSkeletonTableRow}>
                  <div
                    className={cn(
                      styles.skeletonBlock,
                      styles.skeletonCellTask,
                    )}
                  />
                  <div
                    className={cn(
                      styles.skeletonBlock,
                      styles.skeletonCellProgress,
                    )}
                  />
                  <div
                    className={cn(
                      styles.skeletonBlock,
                      styles.skeletonCellStatus,
                    )}
                  />
                  <div
                    className={cn(
                      styles.skeletonBlock,
                      styles.skeletonCellAssignee,
                    )}
                  />
                  <div
                    className={cn(
                      styles.skeletonBlock,
                      styles.skeletonCellTimeline,
                    )}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* Top bar: period view tabs */}
      <div className={styles.topBar}>
        <span className={styles.topBarLabel}>表示期間</span>
        <div className={styles.tabGroup} ref={viewTabbedRef}>
          <div ref={viewIndicatorRef} className={styles.tabbedIndicator} />
          {(["hour", "day", "week", "month", "quarter"] as ViewMode[]).map(
            (m) => (
              <button
                key={m}
                type="button"
                className={cn(
                  styles.tabBtn,
                  viewMode === m && styles.tabBtnActive,
                )}
                data-tab={m}
                onClick={() => setViewMode(m)}
              >
                {VIEW_CONFIG[m].label}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className={styles.statusBar}>
        <span className={styles.topBarLabel}>進捗</span>
        <div className={styles.tabGroup} ref={statusTabbedRef}>
          <div ref={statusIndicatorRef} className={styles.tabbedIndicator} />
          {(
            [
              ["all", "すべて"],
              ["未着手", "未着手"],
              ["作業中", "作業中"],
              ["完了", "完了"],
              ["incomplete", "完了以外"],
            ] as [StatusFilter, string][]
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              className={cn(
                styles.tabBtn,
                statusFilter === f && styles.tabBtnActive,
              )}
              data-tab={f}
              onClick={() => setStatusFilter(f)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.newTaskBtn}
          onClick={handleNewTask}
        >
          <FaPlus />
          新規タスク
        </button>
        <div className={styles.statusBadges}>
          <span className={cn(styles.badge, styles.badgeTodo)}>
            未着手 {statusCounts.todo}
          </span>
          <span className={cn(styles.badge, styles.badgeWip)}>
            作業中 {statusCounts.wip}
          </span>
          <span className={cn(styles.badge, styles.badgeDone)}>
            完了 {statusCounts.done}
          </span>
        </div>
        <button
          type="button"
          className={styles.downloadBtn}
          onClick={handleDownload}
          title="Excelダウンロード"
        >
          <Image
            src="/images/download.png"
            className={styles.downloadBtnIcon}
            alt="ダウンロード"
            width={663}
            height={615}
          />
        </button>
      </div>

      {/* biome-ignore lint: Main(クリックで編集パネル閉じる) */}
      <div
        className={styles.mainArea}
        onClick={() => {
          if (selectedTaskId != null) {
            setPanelVisible(false);
          }
        }}
      >
        {/* Chart header */}
        <div className={styles.chartHeader}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => navigate(-1)}
          >
            ◀
          </button>
          <div className={styles.dateRangePicker}>
            <input
              type={viewMode === "hour" ? "datetime-local" : "date"}
              className={styles.dateInput}
              value={
                viewMode === "hour"
                  ? formatLocalDateTimeInputValue(viewStart)
                  : formatLocalDateInputValue(viewStart)
              }
              onChange={(e) => {
                const d =
                  viewMode === "hour"
                    ? new Date(e.target.value)
                    : parseLocalDateInput(e.target.value, false);
                if (!Number.isNaN(d.getTime())) setViewStart(d);
              }}
            />
            <span className={styles.dateRangeSep}>〜</span>
            <input
              type={viewMode === "hour" ? "datetime-local" : "date"}
              className={styles.dateInput}
              value={
                viewMode === "hour"
                  ? formatLocalDateTimeInputValue(viewEnd)
                  : formatLocalDateInputValue(viewEnd)
              }
              onChange={(e) => {
                const d =
                  viewMode === "hour"
                    ? new Date(e.target.value)
                    : parseLocalDateInput(e.target.value, true);
                if (!Number.isNaN(d.getTime())) setViewEnd(d);
              }}
            />
          </div>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => navigate(1)}
          >
            ▶
          </button>
          <button
            type="button"
            className={styles.sortBtn}
            style={isTodayScrolling ? { background: "#00ffff33" } : undefined}
            onClick={jumpToToday}
          >
            今日
          </button>
          <div className={styles.chartHeaderRight}>
            <label className={styles.myTasksToggleItem}>
              <input
                type="checkbox"
                checked={onlyMyTasks}
                onChange={(e) => setOnlyMyTasks(e.target.checked)}
              />
              <span className={styles.myTasksCheckmark} />
              <span>自分のタスクのみ</span>
            </label>
          </div>
        </div>

        <div className={styles.contentArea}>
          <div className={styles.chartArea}>
            {/* Gantt container */}
            <div className={styles.ganttContainer} ref={ganttContainerRef}>
              <div className={styles.ganttTable}>
                {/* Sticky header */}
                <div className={styles.ganttHeaderRow}>
                  <div className={styles.colTask}>タスク</div>
                  <div className={styles.colProgress}>進捗</div>
                  <div className={styles.colStatus}>状態</div>
                  <div className={styles.colAssignee}>担当者</div>
                  <div
                    className={styles.headerTimeline}
                    style={{ minWidth: totalColWidth }}
                  >
                    {/* Group label row */}
                    <div
                      className={styles.headerGroupRow}
                      style={{ minWidth: totalColWidth }}
                    >
                      {groupHeaders.map((g) => (
                        <div
                          key={`${g.label}-${g.startX}`}
                          className={styles.headerGroup}
                          style={{ left: g.startX, width: g.endX - g.startX }}
                        >
                          <div className={styles.headerGroupLabel}>
                            {g.label}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Unit label row */}
                    <div
                      className={styles.headerUnitRow}
                      style={{ minWidth: totalColWidth }}
                    >
                      {columns.map((col) => {
                        const x = Math.round(
                          dateToX(col.startDate, viewStart, pxPerMs),
                        );
                        return (
                          <div
                            key={col.key}
                            className={cn(
                              styles.headerUnit,
                              col.isWeekend && styles.headerUnitWeekend,
                              col.isGroupStart && styles.headerUnitGroupStart,
                            )}
                            style={{
                              left: x,
                              width: VIEW_CONFIG[viewMode].cellWidth,
                            }}
                          >
                            {col.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Task rows */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={filteredTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredTasks.map((task) => (
                      <SortableTaskRow
                        key={task.id}
                        task={task}
                        isSelected={selectedTaskId === task.id}
                        onSelect={() => {
                          if (selectedTaskId === task.id) {
                            // 同じタスクを再度クリックした場合はパネルの開閉をトグル
                            setPanelVisible((v) => !v);
                          } else {
                            setSelectedTaskId(task.id);
                            setPanelVisible(true);
                            setIsDeleteModalOpen(false);
                          }
                        }}
                        columns={columns}
                        viewMode={viewMode}
                        viewStart={viewStart}
                        totalColWidth={totalColWidth}
                        assigneeUsers={assigneeUsers}
                        isAllRoom={isAllRoom}
                        roles={roles}
                        onBarDragStart={handleBarDragStart}
                        onBarResizeStart={handleBarResizeStart}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {filteredTasks.length === 0 && (
                  <div className={styles.emptyState}>
                    タスクがありません。「＋
                    新規タスク」からタスクを追加してください。
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detail panel */}
          {selectedTask && (
            <DetailPanel
              task={selectedTask}
              onClose={() => {
                setPanelVisible(false);
              }}
              onSave={handleSaveTask}
              onDelete={() => setIsDeleteModalOpen(true)}
              assigneeUsers={assigneeUsers}
              isAllRoom={isAllRoom}
              roles={roles}
              isVisible={panelVisible}
              onAnimationEnd={() => {
                if (panelVisible) return;
                if (selectedTaskId == null) return;
                const task = tasks.find((t) => t.id === selectedTaskId);
                if (task?.isNew) {
                  setTasks((prev) =>
                    prev.filter((t) => t.id !== selectedTaskId),
                  );
                }
                setSelectedTaskId(null);
                setIsDeleteModalOpen(false);
              }}
            />
          )}
        </div>
      </div>

      <ConfirmModal
        open={isDeleteModalOpen && !!selectedTask}
        title="タスク削除"
        message="このタスクを削除しますか？"
        appName={selectedTask?.name}
        confirmLabel={isDeletingTask ? "削除中..." : "削除"}
        cancelLabel="キャンセル"
        onConfirm={handleDeleteTask}
        onCancel={() => {
          if (isDeletingTask) return;
          setIsDeleteModalOpen(false);
        }}
      />
    </div>
  );
}
