import type { MyProfileResponse } from "@/app/api/mypage/profile/route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import ProfilePageClient from "./ProfilePageClient";
import type { JobOption } from "./types";

export const metadata: Metadata = {
  title: "マイページ - プロフィール",
};
export const dynamic = "force-dynamic";

async function getInitialData(): Promise<{
  profile: MyProfileResponse | null;
  jobOptions: JobOption[];
  errorMessage: string | null;
}> {
  try {
    const headersList = await headers();

    // ReadonlyHeaders をそのまま渡すと Headers 初期化時にシンボルキーで落ちるため、素の Headers にコピーする
    const h = new Headers();
    headersList.forEach((value, key) => {
      h.append(key, value);
    });

    const session = await auth.api.getSession({ headers: h });

    if (!session?.user?.id) {
      return {
        profile: null,
        jobOptions: [],
        errorMessage: "プロフィールの取得に失敗しました",
      };
    }

    const userId = Number.parseInt(session.user.id, 10);

    const [user, jobs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          userTags: {
            include: { tag: true },
          },
          jobs: {
            include: { job: true },
          },
        },
      }),
      prisma.job.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
    ]);

    const jobOptions: JobOption[] = (jobs ?? []).map((job) => ({
      id: String(job.id),
      name: job.name,
    }));

    if (!user) {
      return {
        profile: null,
        jobOptions,
        errorMessage: "プロフィールの取得に失敗しました",
      };
    }

    // route.ts の GET と揃えた整形
    const externalLinks = (() => {
      const raw = user.externalLink;
      if (!raw) return [] as string[];
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
    })();

    const jobNames = (user.jobs ?? [])
      .map((uj) => uj.job?.name)
      .filter((v): v is string => typeof v === "string" && v.length > 0);

    const occupation = jobNames.length > 0 ? jobNames.join("／") : "";
    const jobIds = (user.jobs ?? []).map((uj) => uj.jobId);

    const [followerCount, followingCount] = await Promise.all([
      prisma.userFollow.count({ where: { followingId: userId } }),
      prisma.userFollow.count({ where: { followerId: userId } }),
    ]);

    const profile: MyProfileResponse = {
      id: user.id,
      name: user.name,
      image: user.image ?? session.user.image ?? null,
      achievements: user.achievements ?? "",
      selfIntro: user.selfIntro ?? "",
      externalLinks,
      occupation,
      jobIds,
      followerCount,
      followingCount,
    };

    return { profile, jobOptions, errorMessage: null };
  } catch (e) {
    console.error("failed to load profile", e);
    return {
      profile: null,
      jobOptions: [],
      errorMessage: "プロフィールの取得に失敗しました",
    };
  }
}

export default async function Profile() {
  const { profile, jobOptions, errorMessage } = await getInitialData();

  return (
    <ProfilePageClient
      initialProfile={profile}
      initialJobOptions={jobOptions}
      initialErrorMessage={errorMessage}
    />
  );
}
