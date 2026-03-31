import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ProjectDeleteSection from "./ProjectDeleteSection";
import ProjectStatusToggle from "./ProjectStatusToggle";
import styles from "./Settings.module.scss";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;

  const project = await prisma.bewtsProject.findUnique({
    where: { publicId },
    select: { name: true },
  });

  if (!project) {
    return { title: "プロジェクトが見つかりません" };
  }

  return { title: `設定 - ${project.name}` };
}

export default async function BewtsSettingsPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    redirect("/login");
  }

  const viewerId = Number(session.user.id);
  const { publicId } = await params;

  const project = await prisma.bewtsProject.findUnique({
    where: { publicId },
    select: {
      publicId: true,
      name: true,
      id: true,
      status: true,
    },
  });

  if (!project) {
    notFound();
  }

  const viewerCanManage = Boolean(
    await prisma.bewtsPermissionCapability.findFirst({
      where: {
        projectId: project.id,
        userId: viewerId,
        capability: { in: ["MANAGE_PROJECT", "GRANT_PERMISSION"] },
      },
      select: { id: true },
    }),
  );

  const viewerIsLevelAdmin = Boolean(
    await prisma.bewtsPermission.findFirst({
      where: {
        projectId: project.id,
        userId: viewerId,
        level: "ADMIN",
      },
      select: { id: true },
    }),
  );

  if (!viewerCanManage && !viewerIsLevelAdmin) {
    notFound();
  }

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <Link href={`/bewts/${project.publicId}`} className={styles.trail}>
          <span className={styles.trailArrow}>&#9664;</span>
          {project.name}
        </Link>
      </div>

      <section className={styles.section}>
        <h1 className={styles.title}>プロジェクト設定</h1>
      </section>

      <section className={styles.statusSection}>
        <h2 className={styles.sectionTitle}>プロジェクトのステータス</h2>
        <ProjectStatusToggle
          publicId={project.publicId}
          initialStatus={project.status}
        />
      </section>

      <section className={styles.section}>
        <div className={styles.settingLinkGrid}>
          <Link
            href={`/bewts/${project.publicId}/settings/edit`}
            className={styles.settingLinkCard}
          >
            <h2 className={styles.sectionTitle}>プロジェクト編集</h2>
            <p className={styles.hint}>
              概要・募集人数・期間・スキル・役割構成を編集します。
            </p>
          </Link>

          <Link
            href={`/bewts/${project.publicId}/settings/members`}
            className={styles.settingLinkCard}
          >
            <h2 className={styles.sectionTitle}>権限・役割設定</h2>
            <p className={styles.hint}>
              メンバー権限と各役割の担当者を設定します。
            </p>
          </Link>
        </div>
      </section>

      <ProjectDeleteSection
        publicId={project.publicId}
        projectName={project.name}
      />
    </div>
  );
}
