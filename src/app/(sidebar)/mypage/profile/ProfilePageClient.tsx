"use client";

import UserDetailPageClient, {
  type UserDetailData,
} from "@/app/(sidebar)/users/[publicId]/UserDetailPageClient";
import type { MyProfileResponse } from "@/app/api/mypage/profile/route";
import { Modal } from "@/components/Modal/Modal";
import { authClient } from "@/lib/auth-client";
import { useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { ProfileActions } from "./components/ProfileActions";
import { ProfileAvatarSection } from "./components/ProfileAvatarSection";
import { ProfileDetailSections } from "./components/ProfileDetailSections";
import { ProfileHeader } from "./components/ProfileHeader";
import { ProfileMessage } from "./components/ProfileMessage";
import styles from "./page.module.scss";
import type { EditableProfile, JobFormValues, JobOption } from "./types";

const initialProfileState: EditableProfile = {
  name: "",
  occupation: "",
  achievements: "",
  externalLinks: [],
  selfIntro: "",
  image: null,
  rating: 0,
};

type ProfilePageClientProps = {
  initialProfile: MyProfileResponse | null;
  initialJobOptions: JobOption[];
  initialErrorMessage?: string | null;
};

function toEditableProfile(data: MyProfileResponse | null): EditableProfile {
  if (!data) {
    return {
      ...initialProfileState,
      // 編集用には少なくとも1つの空リンク入力を用意
      externalLinks: [""],
    };
  }

  const next: EditableProfile = {
    name: data.name ?? "",
    occupation: data.occupation ?? "",
    achievements: data.achievements ?? "",
    selfIntro: data.selfIntro ?? "",
    externalLinks: Array.isArray(data.externalLinks) ? data.externalLinks : [],
    image: data.image ?? null,
    // API 側では rating を返していないが、将来追加される可能性も考慮しておく
    rating:
      typeof (data as unknown as { rating?: number }).rating === "number"
        ? ((data as unknown as { rating?: number }).rating ?? 0)
        : 0,
  };

  if (next.externalLinks.length === 0) {
    next.externalLinks = [""];
  }

  return next;
}

export default function ProfilePageClient({
  initialProfile,
  initialJobOptions,
  initialErrorMessage,
}: ProfilePageClientProps) {
  const { data: session } = authClient.useSession();

  const followerCount = initialProfile?.followerCount ?? 0;
  const followingCount = initialProfile?.followingCount ?? 0;

  const [profile, setProfile] = useState<EditableProfile>(() =>
    toEditableProfile(initialProfile),
  );
  const [userId, setUserId] = useState<number | null>(
    initialProfile && Number.isFinite(initialProfile.id)
      ? initialProfile.id
      : null,
  );
  const [initial, setInitial] = useState<EditableProfile | null>(
    toEditableProfile(initialProfile),
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(
    initialErrorMessage ?? null,
  );
  const [messageType, setMessageType] = useState<"success" | "error" | null>(
    initialErrorMessage ? "error" : null,
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [jobOptions] = useState<JobOption[]>(initialJobOptions ?? []);
  const [previewOpen, setPreviewOpen] = useState(false);

  const jobFormMethods = useForm<JobFormValues>({
    defaultValues: {
      jobIds:
        Array.isArray(initialProfile?.jobIds) &&
        initialProfile.jobIds.length > 0
          ? initialProfile.jobIds.map((id) => String(id))
          : [],
      newJobNames: [],
    },
  });

  const handleChange = <K extends keyof EditableProfile>(
    key: K,
    value: EditableProfile[K],
  ) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    if (initial) {
      setProfile(initial);
    } else {
      setProfile(toEditableProfile(initialProfile));
    }
    setMessage(null);
    setMessageType(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setMessageType(null);

    try {
      const { jobIds, newJobNames } = jobFormMethods.getValues();

      const finalJobIds: string[] = [];

      for (const name of newJobNames) {
        const trimmed = name.trim();
        if (!trimmed) continue;

        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });

        if (!res.ok) {
          throw new Error("職業の登録に失敗しました");
        }

        const jobData = (await res.json()) as {
          job: { id: string };
        };

        if (jobData?.job?.id) {
          finalJobIds.push(jobData.job.id);
        }
      }

      const existingJobIds = (jobIds ?? [])
        .filter((id) => typeof id === "string")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      const uniqueJobIds = Array.from(
        new Set([...existingJobIds, ...finalJobIds]),
      );

      const payload = {
        name: profile.name,
        achievements: profile.achievements,
        selfIntro: profile.selfIntro,
        externalLinks: profile.externalLinks.filter((v) => v.trim().length > 0),
        image: profile.image,
        jobIds: uniqueJobIds,
      };

      const res = await fetch("/api/mypage/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setMessageType("error");
        setMessage("プロフィールの保存に失敗しました");
        return;
      }

      const data = (await res.json()) as MyProfileResponse;

      const next = toEditableProfile(data);

      setProfile(next);
      setUserId(Number.isFinite(data.id) ? data.id : null);
      setInitial(next);

      const jobIdsFromApi = Array.isArray(data.jobIds)
        ? data.jobIds
            .map((id) => String(id).trim())
            .filter((id) => id.length > 0)
        : [];
      jobFormMethods.reset({ jobIds: jobIdsFromApi, newJobNames: [] });
      setEditing(false);
      setMessageType("success");
      // setMessage("プロフィールを保存しました");
    } catch (e) {
      console.error(e);
      setMessageType("error");
      setMessage("プロフィールの保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => {
    if (!editing) return;
    fileInputRef.current?.click();
  };

  const handleAvatarChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploadingImage(true);
    setMessage(null);
    setMessageType(null);

    try {
      const res = await fetch("/api/users/avatar/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        setMessageType("error");
        setMessage("アイコン画像のアップロードに失敗しました");
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) {
        setMessageType("error");
        setMessage("アップロード結果が不正です");
        return;
      }
      setProfile((prev) => ({ ...prev, image: data.url ?? null }));
    } catch (err) {
      console.error("avatar upload failed", err);
      setMessageType("error");
      setMessage("アイコン画像のアップロードに失敗しました");
    } finally {
      setUploadingImage(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  const handleLinkChange = (index: number, value: string) => {
    setProfile((prev) => {
      const nextLinks = [...prev.externalLinks];
      nextLinks[index] = value;
      return { ...prev, externalLinks: nextLinks };
    });
  };

  const handleAddLink = () => {
    setProfile((prev) => ({
      ...prev,
      externalLinks: [...prev.externalLinks, ""],
    }));
  };

  const handleRemoveLink = (index: number) => {
    setProfile((prev) => {
      const nextLinks = prev.externalLinks.filter((_, i) => i !== index);
      return {
        ...prev,
        externalLinks: nextLinks.length > 0 ? nextLinks : [""],
      };
    });
  };

  const buildPreviewData = (): UserDetailData => {
    const { jobIds, newJobNames } = jobFormMethods.getValues();

    const selectedJobNames = (jobIds ?? [])
      .map((id) => jobOptions.find((job) => job.id === id)?.name)
      .filter(
        (name): name is string => typeof name === "string" && name.length > 0,
      );

    const newJobNamesClean = (newJobNames ?? [])
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    const occupationPreview = [...selectedJobNames, ...newJobNamesClean].join(
      "／",
    );

    const rawId = userId ?? (session?.user?.id as string | number | undefined);
    const numericId = typeof rawId === "number" ? rawId : Number(rawId ?? 0);
    const safeId = Number.isFinite(numericId) && numericId > 0 ? numericId : 0;

    return {
      id: safeId,
      publicId: String(rawId ?? safeId ?? ""),
      name: profile.name || (session?.user?.name ?? ""),
      image: profile.image,
      rating: profile.rating ?? 0,
      followerCount: 0,
      // マイページからのプレビューなので常に自分自身
      isMe: true,
      // プレビュー時はフォロー状態は意味がないので常に false
      isFollowing: false,
      isBlocked: false,
      isBlockedBy: false,
      occupation: occupationPreview || profile.occupation || "",
      achievements: profile.achievements,
      externalLinks: profile.externalLinks.filter((v) => v.trim().length > 0),
      selfIntro: profile.selfIntro,
      // プレビュー中はアクションは全て無効扱い
      privacyActions: {
        follow: false,
        order: false,
        scout: false,
        tip: false,
      },
      tags: [],
      apps: [],
      reviews: [],
    };
  };

  return (
    <FormProvider {...jobFormMethods}>
      <div className={styles.container}>
        <ProfileHeader
          editing={editing}
          onToggleEditing={() => {
            if (!editing && initial) {
              setProfile(initial);
            }
            setEditing((prev) => !prev);
            setMessage(null);
            setMessageType(null);
          }}
        />

        <ProfileAvatarSection
          editing={editing}
          profileImage={profile.image}
          fileInputRef={fileInputRef}
          onAvatarClick={handleAvatarClick}
          onAvatarChange={handleAvatarChange}
          name={profile.name}
          onNameChange={(value) => handleChange("name", value)}
          rating={profile.rating}
        />

        {!editing && (
          <div className={styles.followStats}>
            <div className={styles.followStatItem}>
              <span className={styles.followStatValue}>{followerCount}</span>
              <span className={styles.followStatLabel}>フォロワー</span>
            </div>
            <div className={styles.followStatItem}>
              <span className={styles.followStatValue}>{followingCount}</span>
              <span className={styles.followStatLabel}>フォロー</span>
            </div>
          </div>
        )}

        <ProfileDetailSections
          editing={editing}
          occupation={profile.occupation}
          jobOptions={jobOptions}
          achievements={profile.achievements}
          externalLinks={profile.externalLinks}
          selfIntro={profile.selfIntro}
          onAchievementsChange={(value) => handleChange("achievements", value)}
          onLinkChange={handleLinkChange}
          onAddLink={handleAddLink}
          onRemoveLink={handleRemoveLink}
          onSelfIntroChange={(value) => handleChange("selfIntro", value)}
        />

        {editing && (
          <ProfileActions
            saving={saving}
            uploadingImage={uploadingImage}
            onReset={handleReset}
            onSave={handleSave}
            onPreview={() => setPreviewOpen(true)}
          />
        )}

        <ProfileMessage message={message} messageType={messageType} />

        <Modal
          open={previewOpen}
          onOpenChange={(open) => setPreviewOpen(open)}
          title="ユーザ詳細プレビュー"
          description="現在の入力内容をユーザ詳細画面として表示します"
          maxWidth="xl"
        >
          <UserDetailPageClient data={buildPreviewData()} preview />
        </Modal>
      </div>
    </FormProvider>
  );
}
