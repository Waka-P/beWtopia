import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const { roomId } = await params;
  const id = Number(roomId);

  const room = await prisma.bewtsRoom.findUnique({
    where: { id },
    include: {
      members: { select: { userId: true } },
      project: { select: { leaderId: true, name: true } },
    },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isMember = room.members.some((m) => m.userId === userId);
  const isLeader = room.project?.leaderId === userId;
  const perm = await prisma.bewtsPermission.findFirst({
    where: { projectId: room.projectId, userId },
  });
  if (!isMember && !isLeader && !perm)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const chart = await prisma.bewtsGanttChart.findUnique({
    where: { roomId: id },
    include: {
      tasks: {
        include: {
          assignee: { select: { name: true } },
          segments: { orderBy: { order: "asc" } },
        },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "beWtopia";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("ガントチャート", {
    views: [{ state: "frozen", xSplit: 4, ySplit: 2 }],
  });

  // Determine date range across all segments
  const allDates: Date[] = [];
  for (const task of chart?.tasks ?? []) {
    for (const seg of task.segments) {
      allDates.push(seg.startAt, seg.endAt);
    }
  }

  let rangeStart: Date;
  let rangeEnd: Date;

  if (allDates.length === 0) {
    const now = new Date();
    rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else {
    const minTs = Math.min(...allDates.map((d) => d.getTime()));
    const maxTs = Math.max(...allDates.map((d) => d.getTime()));
    // Add 3-day buffer
    rangeStart = new Date(minTs - 3 * 86400000);
    rangeEnd = new Date(maxTs + 3 * 86400000);
  }

  // Normalize to midnight
  rangeStart.setHours(0, 0, 0, 0);
  rangeEnd.setHours(0, 0, 0, 0);

  // Build array of days
  const days: Date[] = [];
  const cur = new Date(rangeStart);
  while (cur <= rangeEnd) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  // -- Columns --
  // Fixed: A=タスク名, B=ステータス, C=進捗, D=担当者
  const fixedCols = 4;

  sheet.getColumn(1).width = 28;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 8;
  sheet.getColumn(4).width = 14;
  for (let i = 0; i < days.length; i++) {
    sheet.getColumn(fixedCols + 1 + i).width = 4.2;
  }

  // -- Header row 1: month groups --
  const headerRow1 = sheet.getRow(1);
  headerRow1.height = 16;

  // Fixed header cells
  const fixedHeaderStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: "FF00D4FF" }, size: 11 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF040D14" } },
    alignment: { vertical: "middle", horizontal: "center" },
    border: {
      bottom: { style: "thin", color: { argb: "FF0E3A52" } },
      right: { style: "thin", color: { argb: "FF0E3A52" } },
    },
  };

  ["タスク名", "ステータス", "進捗%", "担当者"].forEach((h, i) => {
    const cell = headerRow1.getCell(i + 1);
    cell.value = h;
    Object.assign(cell.style, fixedHeaderStyle);
  });

  // Month group cells
  // Group consecutive days by year/month
  const monthGroups: { label: string; start: number; count: number }[] = [];
  let curMonth = "";
  let curStart = 0;
  let curCount = 0;
  days.forEach((d, i) => {
    const label = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (label !== curMonth) {
      if (curCount > 0)
        monthGroups.push({ label: curMonth, start: curStart, count: curCount });
      curMonth = label;
      curStart = i;
      curCount = 1;
    } else {
      curCount++;
    }
  });
  if (curCount > 0)
    monthGroups.push({ label: curMonth, start: curStart, count: curCount });

  for (const mg of monthGroups) {
    const colStart = fixedCols + 1 + mg.start;
    const colEnd = colStart + mg.count - 1;
    const cell = headerRow1.getCell(colStart);
    cell.value = mg.label;
    cell.style = {
      font: { bold: true, color: { argb: "FF5A8A9F" }, size: 9 },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF040D14" },
      },
      alignment: { vertical: "middle", horizontal: "center" },
      border: {
        bottom: { style: "thin", color: { argb: "FF0E3A52" } },
        right: { style: "thin", color: { argb: "FF0E3A52" } },
      },
    };
    if (mg.count > 1) {
      sheet.mergeCells(1, colStart, 1, colEnd);
    }
  }

  // -- Header row 2: day numbers --
  const headerRow2 = sheet.getRow(2);
  headerRow2.height = 16;

  // Fixed cells on row 2 — leave blank with same style
  for (let i = 1; i <= fixedCols; i++) {
    const cell = headerRow2.getCell(i);
    cell.style = {
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF040D14" },
      },
      border: {
        bottom: { style: "medium", color: { argb: "FF1A6080" } },
        right: { style: "thin", color: { argb: "FF0E3A52" } },
      },
    };
  }

  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  days.forEach((d, i) => {
    const colIdx = fixedCols + 1 + i;
    const cell = headerRow2.getCell(colIdx);
    const dow = d.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6;
    cell.value = `${d.getDate()}\n${dayNames[dow]}`;
    cell.style = {
      font: {
        bold: false,
        color: { argb: isWeekend ? "FF6ACFEF" : "FF5A8A9F" },
        size: 8,
      },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isWeekend ? "FF071A26" : "FF040D14" },
      },
      alignment: { vertical: "middle", horizontal: "center", wrapText: true },
      border: {
        bottom: { style: "medium", color: { argb: "FF1A6080" } },
        right: {
          style: "thin",
          color: { argb: isWeekend ? "FF1A6080" : "FF0E3A52" },
        },
      },
    };
    if (isWeekend) {
      headerRow2.height = 28;
    }
  });

  // -- STATUS COLORS --
  const statusFill = (s: string): string => {
    if (s === "完了") return "FF2A7A4A";
    if (s === "作業中") return "FF7A6A2A";
    return "FF2A5A7A";
  };
  const statusTextColor = (s: string): string => {
    if (s === "完了") return "FF6AEF9A";
    if (s === "作業中") return "FFEFCF6A";
    return "FF6ACFEF";
  };

  // Bar colors per segment index
  const barColors = [
    "FF3A7A5A",
    "FF2A5A8A",
    "FF5A3A7A",
    "FF1A5A5A",
    "FF5A3A1A",
  ];

  // -- Task rows --
  for (const [rowIdx, task] of (chart?.tasks ?? []).entries()) {
    const rowNum = rowIdx + 3; // data starts at row 3
    const row = sheet.getRow(rowNum);
    row.height = 22;

    const eveBg = rowIdx % 2 === 0 ? "FF071A26" : "FF071220";
    const baseBorder: Partial<ExcelJS.Borders> = {
      bottom: { style: "thin", color: { argb: "FF0E3A52" } },
      right: { style: "thin", color: { argb: "FF0E3A52" } },
    };

    // Task name
    const nameCell = row.getCell(1);
    nameCell.value = task.name;
    nameCell.style = {
      font: { color: { argb: "FFC8EAF5" }, size: 11 },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: eveBg } },
      alignment: { vertical: "middle", horizontal: "left" },
      border: baseBorder,
    };

    // Status
    const statusCell = row.getCell(2);
    statusCell.value = task.status;
    statusCell.style = {
      font: {
        color: { argb: statusTextColor(task.status) },
        bold: true,
        size: 10,
      },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: statusFill(task.status) },
      },
      alignment: { vertical: "middle", horizontal: "center" },
      border: baseBorder,
    };

    // Progress
    const progCell = row.getCell(3);
    progCell.value = task.progress;
    progCell.numFmt = '0"%"';
    progCell.style = {
      font: { color: { argb: "FF00D4FF" }, bold: true, size: 10 },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: eveBg } },
      alignment: { vertical: "middle", horizontal: "center" },
      border: baseBorder,
    };

    // Assignee
    const assigneeCell = row.getCell(4);
    assigneeCell.value = task.assignee?.name ?? "";
    assigneeCell.style = {
      font: { color: { argb: "FF5A8A9F" }, size: 10 },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: eveBg } },
      alignment: { vertical: "middle", horizontal: "left" },
      border: baseBorder,
    };

    // Timeline cells — fill background first
    for (let di = 0; di < days.length; di++) {
      const colIdx = fixedCols + 1 + di;
      const dateCell = row.getCell(colIdx);
      const dow = days[di].getDay();
      const isWeekend = dow === 0 || dow === 6;
      dateCell.style = {
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isWeekend ? "FF071A26" : eveBg },
        },
        border: {
          bottom: { style: "thin", color: { argb: "FF0E3A52" } },
          right: {
            style: "thin",
            color: { argb: isWeekend ? "FF1A6080" : "FF0E3A52" },
          },
        },
      };
    }

    // Paint segments
    for (const [segIdx, seg] of task.segments.entries()) {
      const segColor = barColors[segIdx % barColors.length];
      const segStart = new Date(seg.startAt);
      const segEnd = new Date(seg.endAt);
      segStart.setHours(0, 0, 0, 0);
      segEnd.setHours(0, 0, 0, 0);

      for (let di = 0; di < days.length; di++) {
        const day = days[di];
        if (day >= segStart && day <= segEnd) {
          const colIdx = fixedCols + 1 + di;
          const dateCell = row.getCell(colIdx);
          // Paint with bar color; first/last get label
          const isFirst = day.getTime() === segStart.getTime();
          dateCell.style = {
            fill: {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: segColor },
            },
            font: {
              color: { argb: "FFC8EAF5" },
              size: 7,
              bold: isFirst,
            },
            alignment: { vertical: "middle", horizontal: "center" },
            border: {
              bottom: { style: "thin", color: { argb: "FF0E3A52" } },
              right: { style: "thin", color: { argb: "FF0E3A52" } },
            },
          };
          if (isFirst && seg.label) {
            dateCell.value = seg.label;
          }
        }
      }
    }

    row.commit();
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  const roomName = room.name ?? "gantt";
  const fileName = encodeURIComponent(`ガントチャート_${roomName}.xlsx`);

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
    },
  });
}
