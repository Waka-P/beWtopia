import { cn } from "@/lib/cn";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import { useRef } from "react";
import styles from "./GanttChart.module.scss";
import {
  type AssigneeUser,
  type BewtsRole,
  type Column,
  computeAssigneeDisplay,
  dateToX,
  DEFAULT_USER_ICON,
  type GanttTask,
  getPixelsPerMs,
  getTaskDefaultColor,
  snapToUnit,
  TASK_COLORS,
  VIEW_CONFIG,
  type ViewMode,
} from "./ganttShared";

export function SortableTaskRow({
  task,
  isSelected,
  onSelect,
  columns,
  viewMode,
  viewStart,
  totalColWidth,
  assigneeUsers,
  isAllRoom,
  roles,
  onBarDragStart,
  onBarResizeStart,
}: {
  task: GanttTask;
  isSelected: boolean;
  onSelect: () => void;
  columns: Column[];
  viewMode: ViewMode;
  viewStart: Date;
  totalColWidth: number;
  assigneeUsers: AssigneeUser[];
  isAllRoom: boolean;
  roles: BewtsRole[];
  onBarDragStart: (
    e: React.PointerEvent,
    taskId: number,
    segIdx: number,
  ) => void;
  onBarResizeStart: (
    e: React.PointerEvent,
    taskId: number,
    segIdx: number,
    side: "left" | "right",
  ) => void;
}) {
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntilRef = useRef(0);
  const suppressNextClickRef = useRef(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : undefined,
  };

  const pxPerMs = getPixelsPerMs(viewMode);
  const cfg = VIEW_CONFIG[viewMode];
  const viewStartMs = viewStart.getTime();

  const statusColor =
    task.status === "完了"
      ? "#6aef9a"
      : task.status === "作業中"
        ? "#efcf6a"
        : "#6acfef";
  const statusBg =
    task.status === "完了"
      ? "#1a4a2a"
      : task.status === "作業中"
        ? "#4a3a1a"
        : "#1a3a5a";

  const ROW_H = 42;
  const BAR_H = 20;
  const barTop = (ROW_H - BAR_H) / 2;
  const DRAG_THRESHOLD_PX = 4;

  const defaultTaskColor = task.color ?? getTaskDefaultColor(task.id);
  const taskColorIndex = TASK_COLORS.indexOf(defaultTaskColor);
  const defaultBorderColor =
    taskColorIndex >= 0
      ? TASK_COLORS[(taskColorIndex + 1) % TASK_COLORS.length]
      : TASK_COLORS[(Math.abs(task.id) + 1) % TASK_COLORS.length];
  const {
    assignees,
    label: assigneeLabel,
    showAvatar,
  } = computeAssigneeDisplay(task, assigneeUsers, isAllRoom, roles);

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={dndStyle}
      className={cn(styles.ganttRow, isSelected && styles.ganttRowSelected)}
      onPointerDownCapture={(e) => {
        pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMoveCapture={(e) => {
        const start = pointerDownPosRef.current;
        if (!start) return;
        const movedX = Math.abs(e.clientX - start.x);
        const movedY = Math.abs(e.clientY - start.y);
        if (movedX > DRAG_THRESHOLD_PX || movedY > DRAG_THRESHOLD_PX) {
          suppressClickUntilRef.current = Date.now() + 250;
        }
      }}
      onPointerUpCapture={() => {
        pointerDownPosRef.current = null;
      }}
      onPointerCancelCapture={() => {
        pointerDownPosRef.current = null;
      }}
      onClick={(e) => {
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (Date.now() < suppressClickUntilRef.current) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.stopPropagation();
        onSelect();
      }}
    >
      <div className={styles.cellTask}>
        <span
          {...attributes}
          {...listeners}
          className={styles.dragHandle}
          title="ドラッグして並び替え"
        >
          ⋮⋮
        </span>
        <span>{task.name}</span>
      </div>

      <div className={styles.cellProgress}>
        <span>{task.progress}%</span>
        <div className={styles.miniProgressWrap}>
          <div
            className={styles.miniProgressFill}
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>

      <div className={styles.cellStatus}>
        <span
          className={styles.statusBadge}
          style={{ color: statusColor, background: statusBg }}
        >
          {task.status}
        </span>
      </div>

      <div className={styles.cellAssignee}>
        {showAvatar && assignees[0] && (
          <div className={styles.avatarSmall}>
            <Image
              src={assignees[0].image || DEFAULT_USER_ICON}
              alt={assignees[0].name ?? "担当者"}
              width={22}
              height={22}
              style={{ borderRadius: "999px" }}
            />
          </div>
        )}
        <span className={styles.assigneeName}>{assigneeLabel}</span>
      </div>

      <div
        className={styles.cellTimeline}
        data-timeline={task.id}
        style={{
          minWidth: totalColWidth,
          height: `${ROW_H}px`,
          position: "relative",
        }}
      >
        {columns.map((col) => {
          const x = Math.round(dateToX(col.startDate, viewStart, pxPerMs));
          return (
            <div
              key={col.key}
              className={cn(
                styles.timelineCell,
                col.isGroupStart && styles.timelineCellGroupStart,
                col.isWeekend && styles.timelineCellWeekend,
              )}
              style={{
                position: "absolute",
                left: x,
                top: 0,
                bottom: 0,
                width: cfg.cellWidth,
                pointerEvents: "none",
              }}
            />
          );
        })}

        {(() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayX = Math.round(dateToX(today, viewStart, pxPerMs));
          if (todayX < 0 || todayX > totalColWidth + cfg.cellWidth) return null;
          return (
            <div className={styles.todayMarker} style={{ left: todayX }} />
          );
        })()}

        {task.segments.map((seg, idx) => {
          const segStart = new Date(seg.startAt);
          const segEnd = new Date(seg.endAt);
          const snappedStartMs =
            viewStartMs +
            snapToUnit(segStart.getTime() - viewStartMs, cfg.snapMs);
          const snappedEndMs =
            viewStartMs +
            snapToUnit(segEnd.getTime() - viewStartMs, cfg.snapMs);
          const x1 = Math.round(
            dateToX(new Date(snappedStartMs), viewStart, pxPerMs),
          );
          const x2 = Math.round(
            dateToX(new Date(snappedEndMs), viewStart, pxPerMs),
          );
          const w = Math.max(x2 - x1, 8);

          return (
            <div
              key={`seg-${task.id}-${idx}`}
              className={styles.ganttBar}
              style={{
                left: x1,
                top: barTop,
                width: w,
                height: BAR_H,
                background: defaultTaskColor,
                boxShadow: `inset 3px 0 0 ${defaultBorderColor}`,
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                suppressNextClickRef.current = true;
                suppressClickUntilRef.current = Date.now() + 300;
                onBarDragStart(e, task.id, idx);
              }}
            >
              <div
                className={styles.resizeHandleLeft}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  suppressNextClickRef.current = true;
                  suppressClickUntilRef.current = Date.now() + 300;
                  onBarResizeStart(e, task.id, idx, "left");
                }}
              />
              {seg.label && (
                <span className={styles.barLabel}>{seg.label}</span>
              )}
              <div
                className={styles.resizeHandleRight}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  suppressNextClickRef.current = true;
                  suppressClickUntilRef.current = Date.now() + 300;
                  onBarResizeStart(e, task.id, idx, "right");
                }}
              />
            </div>
          );
        })}
      </div>
    </button>
  );
}
