type ViewMode = "hour" | "day" | "week" | "month" | "quarter";
type StatusFilter = "all" | "未着手" | "作業中" | "完了" | "incomplete";

type GanttSegment = {
  id: number | null;
  startAt: string;
  endAt: string;
  color: string | null;
  label: string | null;
  note: string | null;
  order: number;
};

type GanttTask = {
  id: number;
  name: string;
  description: string | null;
  progress: number;
  status: string;
  memo: string | null;
  color: string | null;
  displayOrder: number;
  assigneeId: number | null;
  assignee: { id: number; name: string | null; image: string | null } | null;
  assignees?: { id: number; name: string | null; image: string | null }[];
  segments: GanttSegment[];
  isNew?: boolean;
};

type AssigneeUser = {
  id: number;
  name: string;
  image: string | null;
};

type BewtsRole = {
  id: number;
  name: string;
  userIds: number[];
};

type ApiAssigneeUser = {
  id: number;
  name: string | null;
  image: string | null;
};

type ApiAssignment = {
  user?: ApiAssigneeUser | null;
};

type ApiGanttTask = Omit<GanttTask, "segments" | "assignees" | "isNew"> & {
  segments?: GanttSegment[];
  assignments?: ApiAssignment[];
  assignee?: ApiAssigneeUser | null;
};

type ApiBewtsRoomMember = {
  user?: ApiAssigneeUser | null;
};

type ApiBewtsRoomResponse = {
  members?: ApiBewtsRoomMember[];
};

type ApiGanttResponse = {
  tasks?: ApiGanttTask[];
};

type SessionLike = {
  user?: {
    id?: unknown;
  };
};

const STATUS_LABELS = ["未着手", "作業中", "完了"] as const;
const BAR_BRIGHT = ["#4aaa7a", "#3a8acc", "#7a4aaa", "#2aafaf", "#cf7a3a"];
const DEFAULT_USER_ICON = "/images/user-icon-default.png";
const TASK_COLORS = [
  "#4aaa7a",
  "#7aaf3a",
  "#af8a3a",
  "#cf7a3a",
  "#ef4a4a",
  "#af4aaf",
  "#7a4aaa",
  "#4a7aef",
  "#3a8acc",
  "#2aafaf",
];

const ALL_ASSIGNEES_PICKER_ID = "__ALL_ASSIGNEES__";
const ROLE_ASSIGNEE_PICKER_PREFIX = "__ROLE__:";

function extractAssigneesFromTask(task: {
  assignments?: ApiAssignment[];
  assignee?: ApiAssigneeUser | null;
}): ApiAssigneeUser[] {
  if (Array.isArray(task.assignments)) {
    return task.assignments
      .map((assignment) => assignment?.user)
      .filter(
        (user): user is ApiAssigneeUser =>
          user != null && typeof user.id === "number",
      );
  }
  if (task.assignee && typeof task.assignee.id === "number") {
    return [task.assignee];
  }
  return [];
}

function getBaseAssigneeIdsFromTask(task: GanttTask): number[] {
  if (task.assignees && task.assignees.length > 0) {
    return task.assignees.map((a) => a.id);
  }
  if (task.assigneeId) {
    return [task.assigneeId];
  }
  return [];
}

function mapAssigneeIdsToPickerItemIds(
  assigneeIds: number[],
  assigneeUsers: AssigneeUser[],
  isAllRoom: boolean,
  roles: BewtsRole[],
): Array<number | string> {
  const allUserIds = assigneeUsers.map((u) => u.id);

  if (
    allUserIds.length > 0 &&
    assigneeIds.length === allUserIds.length &&
    allUserIds.every((id) => assigneeIds.includes(id))
  ) {
    return [ALL_ASSIGNEES_PICKER_ID];
  }

  if (isAllRoom && assigneeIds.length > 0) {
    const assignedSet = new Set(assigneeIds);
    const matchedRole = roles.find((role) => {
      const roleSet = new Set(role.userIds);
      return (
        roleSet.size === assignedSet.size &&
        Array.from(roleSet).every((id) => assignedSet.has(id))
      );
    });
    if (matchedRole) {
      return [`${ROLE_ASSIGNEE_PICKER_PREFIX}${matchedRole.id}`];
    }
  }

  return assigneeIds;
}

function computeHiddenUserIdsForPicker(
  selectedPickerItemIds: Array<number | string>,
  assigneeUsers: AssigneeUser[],
  roles: BewtsRole[],
): number[] {
  const hidden = new Set<number>();

  const isAllSelected = selectedPickerItemIds.includes(ALL_ASSIGNEES_PICKER_ID);
  if (isAllSelected) {
    assigneeUsers.forEach((u) => {
      hidden.add(u.id);
    });
  }

  selectedPickerItemIds.forEach((v) => {
    if (typeof v === "string" && v.startsWith(ROLE_ASSIGNEE_PICKER_PREFIX)) {
      const roleIdStr = v.slice(ROLE_ASSIGNEE_PICKER_PREFIX.length);
      const roleId = Number(roleIdStr);
      const role = roles.find((r) => r.id === roleId);
      if (role) {
        role.userIds.forEach((id) => {
          hidden.add(id);
        });
      }
    }
  });

  return Array.from(hidden);
}

function resolvePickerSelection(
  incoming: Array<number | string>,
  assigneeUsers: AssigneeUser[],
  roles: BewtsRole[],
): {
  nextPickerItemIds: Array<number | string>;
  assigneeUserIds: number[];
} {
  const hasAll = incoming.includes(ALL_ASSIGNEES_PICKER_ID);
  const allUserIds = assigneeUsers.map((u) => u.id);

  let nextPickerItemIds: Array<number | string>;
  if (hasAll) {
    nextPickerItemIds = [ALL_ASSIGNEES_PICKER_ID];
  } else {
    const seen = new Set<string | number>();
    nextPickerItemIds = [];
    for (const v of incoming) {
      if (!seen.has(v)) {
        seen.add(v);
        nextPickerItemIds.push(v);
      }
    }
  }

  const userIdSet = new Set<number>();
  if (hasAll) {
    for (const id of allUserIds) {
      userIdSet.add(id);
    }
  } else {
    for (const v of nextPickerItemIds) {
      if (typeof v === "number") {
        if (allUserIds.includes(v)) {
          userIdSet.add(v);
        }
      } else if (v.startsWith(ROLE_ASSIGNEE_PICKER_PREFIX)) {
        const roleIdStr = v.slice(ROLE_ASSIGNEE_PICKER_PREFIX.length);
        const roleId = Number(roleIdStr);
        const role = roles.find((r) => r.id === roleId);
        if (role) {
          role.userIds.forEach((id) => {
            userIdSet.add(id);
          });
        }
      }
    }
  }

  return {
    nextPickerItemIds,
    assigneeUserIds: Array.from(userIdSet),
  };
}

function computeAssigneeDisplay(
  task: GanttTask,
  assigneeUsers: AssigneeUser[],
  isAllRoom: boolean,
  roles: BewtsRole[],
): {
  assignees: { id: number; name: string | null; image: string | null }[];
  label: string;
  showAvatar: boolean;
} {
  const assignees =
    task.assignees && task.assignees.length > 0
      ? task.assignees
      : task.assignee
        ? [task.assignee]
        : [];

  if (assignees.length === 0) {
    return {
      assignees,
      label: "—",
      showAvatar: false,
    };
  }

  const assignedIds = new Set(assignees.map((a) => a.id));
  const allUserIds = assigneeUsers.map((u) => u.id);

  const isAllSelected =
    allUserIds.length > 0 &&
    assignedIds.size === allUserIds.length &&
    allUserIds.every((id) => assignedIds.has(id));

  let roleLabel: string | null = null;
  let isRoleMultiSelected = false;

  if (!isAllSelected && isAllRoom) {
    const matchedRoles = roles.filter((role) => {
      const roleUserIds = role.userIds;
      return (
        roleUserIds.length > 0 &&
        roleUserIds.length === assignedIds.size &&
        roleUserIds.every((id) => assignedIds.has(id))
      );
    });

    if (matchedRoles.length === 1) {
      roleLabel = matchedRoles[0].name;
    } else if (matchedRoles.length > 1) {
      isRoleMultiSelected = true;
    }
  }

  let label = "—";
  if (isAllSelected) {
    label = "全員";
  } else if (roleLabel) {
    label = roleLabel;
  } else if (isRoleMultiSelected) {
    const roleNames = roles
      .filter((role) => {
        const roleUserIds = role.userIds;
        return (
          roleUserIds.length > 0 &&
          roleUserIds.length === assignedIds.size &&
          roleUserIds.every((id) => assignedIds.has(id))
        );
      })
      .map((role) => role.name);
    if (roleNames.length === 1) {
      label = roleNames[0];
    } else if (roleNames.length > 1) {
      label = `${roleNames[0]} ほか${roleNames.length - 1}役割`;
    }
  } else if (assignees.length === 1) {
    label = assignees[0].name ?? "—";
  } else {
    label = `${assignees[0].name ?? "—"} ほか${assignees.length - 1}名`;
  }

  const showAvatar =
    assignees[0] != null &&
    !isAllSelected &&
    !roleLabel &&
    !isRoleMultiSelected;

  return {
    assignees,
    label,
    showAvatar,
  };
}

function getTaskDefaultColor(taskId: number): string {
  const idx = Math.abs(taskId) % TASK_COLORS.length;
  return TASK_COLORS[idx];
}

type ViewConfig = {
  label: string;
  cellMs: number;
  cellWidth: number;
  snapMs: number;
};

const VIEW_CONFIG: Record<ViewMode, ViewConfig> = {
  hour: {
    label: "時間",
    cellMs: 3_600_000,
    cellWidth: 30,
    snapMs: 3_600_000,
  },
  day: {
    label: "日次",
    cellMs: 86_400_000,
    cellWidth: 40,
    snapMs: 86_400_000,
  },
  week: {
    label: "週次",
    cellMs: 86_400_000 * 7,
    cellWidth: 80,
    snapMs: 86_400_000,
  },
  month: {
    label: "月次",
    cellMs: 86_400_000 * 30.44,
    cellWidth: 100,
    snapMs: 86_400_000,
  },
  quarter: {
    label: "四半期",
    cellMs: 86_400_000 * 91.25,
    cellWidth: 140,
    snapMs: 86_400_000 * 7,
  },
};

function snapToUnit(ms: number, snapMs: number): number {
  return Math.round(ms / snapMs) * snapMs;
}

function dateToX(date: Date, viewStart: Date, pxPerMs: number): number {
  return (date.getTime() - viewStart.getTime()) * pxPerMs;
}

function getPixelsPerMs(mode: ViewMode): number {
  const c = VIEW_CONFIG[mode];
  return c.cellWidth / c.cellMs;
}

function formatLocalDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatLocalDateTimeInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function parseLocalDateInput(value: string, endOfDay = false): Date {
  const [y, m, d] = value.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return new Date(NaN);
  }
  if (endOfDay) {
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

type Column = {
  key: string;
  startDate: Date;
  label: string;
  isGroupStart: boolean;
  groupLabel?: string;
  isWeekend?: boolean;
};

function generateColumns(
  viewStart: Date,
  numCols: number,
  mode: ViewMode,
): Column[] {
  const cols: Column[] = [];
  const cur = new Date(viewStart);
  const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

  for (let i = 0; i < numCols; i++) {
    const d = new Date(cur);
    let label = "";
    let groupLabel = "";
    let isGroupStart = false;
    let isWeekend = false;

    if (mode === "hour") {
      label = `${String(d.getHours()).padStart(2, "0")}`;
      const isNewDay = d.getHours() === 0 || i === 0;
      if (isNewDay) {
        isGroupStart = true;
        groupLabel = `${d.getMonth() + 1}/${d.getDate()}（${DAY_NAMES[d.getDay()]}）`;
      }
      isWeekend = d.getDay() === 0 || d.getDay() === 6;
      cur.setTime(cur.getTime() + 3_600_000);
    } else if (mode === "day") {
      label = String(d.getDate());
      if (d.getDate() === 1 || i === 0) {
        isGroupStart = true;
        groupLabel = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
      isWeekend = d.getDay() === 0 || d.getDay() === 6;
      cur.setDate(cur.getDate() + 1);
    } else if (mode === "week") {
      const weekNum = Math.floor(d.getDate() / 7) + 1;
      label = `W${weekNum}`;
      const prevMonth = i > 0 ? cols[i - 1].startDate.getMonth() : -1;
      if (d.getMonth() !== prevMonth || i === 0) {
        isGroupStart = true;
        groupLabel = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
      cur.setTime(cur.getTime() + 86_400_000 * 7);
    } else if (mode === "month") {
      label = `${d.getMonth() + 1}月`;
      const quarter = Math.floor(d.getMonth() / 3) + 1;
      if (d.getMonth() % 3 === 0 || i === 0) {
        isGroupStart = true;
        groupLabel = `${d.getFullYear()} Q${quarter}`;
      }
      cur.setTime(new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime());
    } else if (mode === "quarter") {
      const quarter = Math.floor(d.getMonth() / 3) + 1;
      label = `Q${quarter}`;
      const prevYear = i > 0 ? cols[i - 1].startDate.getFullYear() : -1;
      const newYear = d.getFullYear() !== prevYear;
      if (newYear || i === 0) {
        isGroupStart = true;
        groupLabel = `${d.getFullYear()}年`;
      }
      cur.setTime(
        new Date(
          d.getFullYear(),
          Math.floor(d.getMonth() / 3) * 3 + 3,
          1,
        ).getTime(),
      );
    }

    cols.push({
      key: d.toISOString(),
      startDate: d,
      label,
      isGroupStart,
      groupLabel,
      isWeekend,
    });
  }
  return cols;
}

function segmentsOverlap(
  segments: GanttSegment[],
  targetIndex: number,
  newStart: Date,
  newEnd: Date,
): boolean {
  const newStartMs = newStart.getTime();
  const newEndMs = newEnd.getTime();
  return segments.some((s, i) => {
    if (i === targetIndex) return false;
    const sStart = new Date(s.startAt).getTime();
    const sEnd = new Date(s.endAt).getTime();
    return sStart < newEndMs && sEnd > newStartMs;
  });
}

function normalizeSegments(segments: GanttSegment[]): GanttSegment[] {
  const sorted = [...segments].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
  const seen = new Set<string>();
  const result: GanttSegment[] = [];

  for (const s of sorted) {
    const key = [
      new Date(s.startAt).getTime(),
      new Date(s.endAt).getTime(),
      s.label ?? "",
      s.note ?? "",
      s.color ?? "",
    ].join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      ...s,
    });
  }

  return result.map((s, i) => ({ ...s, order: i }));
}

export type {
  ApiAssigneeUser,
  ApiAssignment,
  ApiBewtsRoomMember,
  ApiBewtsRoomResponse,
  ApiGanttResponse,
  ApiGanttTask,
  AssigneeUser,
  BewtsRole,
  Column,
  GanttSegment,
  GanttTask,
  SessionLike,
  StatusFilter,
  ViewConfig,
  ViewMode,
};

export {
  ALL_ASSIGNEES_PICKER_ID,
  BAR_BRIGHT,
  DEFAULT_USER_ICON,
  ROLE_ASSIGNEE_PICKER_PREFIX,
  STATUS_LABELS,
  TASK_COLORS,
  VIEW_CONFIG,
  computeAssigneeDisplay,
  computeHiddenUserIdsForPicker,
  dateToX,
  extractAssigneesFromTask,
  formatLocalDateInputValue,
  formatLocalDateTimeInputValue,
  generateColumns,
  getBaseAssigneeIdsFromTask,
  getPixelsPerMs,
  getTaskDefaultColor,
  mapAssigneeIdsToPickerItemIds,
  normalizeSegments,
  parseLocalDateInput,
  resolvePickerSelection,
  segmentsOverlap,
  snapToUnit,
};
