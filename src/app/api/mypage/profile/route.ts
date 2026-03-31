import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUserInput } from "@/utils/normalize";
import { NextResponse } from "next/server";

function parseExternalLinks(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((v) => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }
  } catch {
    // JSON でなければ改行区切りとして扱う
  }
  return raw
    .split("\n")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function serializeExternalLinks(links: string[]): string | null {
  const normalized = links.map((v) => v.trim()).filter((v) => v.length > 0);
  if (normalized.length === 0) return null;
  return JSON.stringify(normalized);
}

export type MyProfileResponse = {
  id: number;
  name: string;
  image: string | null;
  achievements: string;
  selfIntro: string;
  externalLinks: string[];
  occupation: string;
  jobIds: number[];
  followerCount: number;
  followingCount: number;
};

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number.parseInt(session.user.id, 10);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userTags: {
        include: { tag: true },
      },
      jobs: {
        include: { job: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const externalLinks = parseExternalLinks(user.externalLink);
  const jobNames = (user.jobs ?? [])
    .map((uj) => uj.job?.name)
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  // 職業は job のみから決定し、複数ある場合は連結表示
  const occupation = jobNames.length > 0 ? jobNames.join("／") : "";
  const jobIds = (user.jobs ?? []).map((uj) => uj.jobId);

  const [followerCount, followingCount] = await Promise.all([
    prisma.userFollow.count({ where: { followingId: userId } }),
    prisma.userFollow.count({ where: { followerId: userId } }),
  ]);

  const body: MyProfileResponse = {
    id: user.id,
    name: user.name,
    // DB に画像がなければ、セッション(Google等のソーシャルログイン)の画像URLをフォールバックとして返す
    image: user.image ?? session.user.image ?? null,
    achievements: user.achievements ?? "",
    selfIntro: user.selfIntro ?? "",
    externalLinks,
    occupation,
    jobIds,
    followerCount,
    followingCount,
  };

  return NextResponse.json(body);
}

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number.parseInt(session.user.id, 10);

  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    achievements?: unknown;
    selfIntro?: unknown;
    externalLinks?: unknown;
    image?: unknown;
    jobIds?: unknown;
  } | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    data.name = normalizeUserInput(body.name);
  }

  if (typeof body.achievements === "string") {
    data.achievements = normalizeUserInput(body.achievements) || null;
  }

  if (typeof body.selfIntro === "string") {
    data.selfIntro = normalizeUserInput(body.selfIntro) || null;
  }

  if (Array.isArray(body.externalLinks)) {
    const links = body.externalLinks
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    data.externalLink = serializeExternalLinks(links);
  }

  if (typeof body.image === "string" || body.image === null) {
    data.image = body.image;
  }

  let jobIds: number[] | undefined;
  if (Array.isArray(body.jobIds)) {
    jobIds = body.jobIds
      .map((v) => {
        if (typeof v === "number") return v;
        if (typeof v === "string") {
          const n = Number(v.trim());
          if (Number.isInteger(n)) return n;
        }
        return null;
      })
      .filter((v): v is number => v !== null);
  }

  if (Object.keys(data).length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  if (jobIds) {
    await prisma.userJob.deleteMany({
      where: { userId },
    });

    if (jobIds.length > 0) {
      await prisma.userJob.createMany({
        data: jobIds.map((jobId) => ({ userId, jobId })),
        skipDuplicates: true,
      });
    }
  }

  const refreshed = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userTags: {
        include: { tag: true },
      },
      jobs: {
        include: { job: true },
      },
    },
  });

  if (!refreshed) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const refreshedExternalLinks = parseExternalLinks(refreshed.externalLink);
  const refreshedJobNames = (refreshed.jobs ?? [])
    .map((uj) => uj.job?.name)
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  // 更新後も職業は job ベースのみ（複数あれば連結）
  const refreshedOccupation =
    refreshedJobNames.length > 0 ? refreshedJobNames.join("／") : "";
  const refreshedJobIds = (refreshed.jobs ?? []).map((uj) => uj.jobId);

  const [followerCount2, followingCount2] = await Promise.all([
    prisma.userFollow.count({ where: { followingId: userId } }),
    prisma.userFollow.count({ where: { followerId: userId } }),
  ]);

  const resBody: MyProfileResponse = {
    id: refreshed.id,
    name: refreshed.name,
    image: refreshed.image,
    achievements: refreshed.achievements ?? "",
    selfIntro: refreshed.selfIntro ?? "",
    externalLinks: refreshedExternalLinks,
    occupation: refreshedOccupation,
    jobIds: refreshedJobIds,
    followerCount: followerCount2,
    followingCount: followingCount2,
  };

  return NextResponse.json(resBody);
}
