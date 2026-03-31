import { BewtForm } from "@/app/(sidebar)/bewt/BewtForm";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

async function getTags(userId: number) {
  const globalTags = await prisma.tag.findMany({
    where: {
      users: {
        none: {},
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  const userTags = await prisma.tag.findMany({
    where: {
      users: {
        some: {
          userId,
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return [...globalTags, ...userTags];
}

async function getSystemTemplates() {
  const templates = await prisma.appTemplate.findMany({
    where: {
      userId: undefined,
    },
    select: {
      id: true,
      name: true,
      body: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  return templates.map((tem) => ({ ...tem, userId: null }));
}

export const metadata: Metadata = {
  title: "ビューズ共同出品",
};

export default async function BewtsBewtPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  if (!publicId || typeof publicId !== "string") {
    notFound();
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = Number.parseInt(session.user.id, 10);

  const project = await prisma.bewtsProject.findUnique({
    where: { publicId },
    include: {
      permissions: {
        where: { userId },
        select: { level: true },
      },
      leader: {
        select: { id: true },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const isLeader = project.leaderId === userId;
  const perm = project.permissions[0] ?? null;
  const hasPublishPermission =
    perm && (perm.level === "ADMIN" || perm.level === "PUBLISHER");

  if (!isLeader && !hasPublishPermission) {
    notFound();
  }

  const tags = await getTags(userId);
  const templates = await getSystemTemplates();

  return (
    <BewtForm
      tags={tags}
      templates={templates}
      submitLabel="ビューズ"
      bewtsProjectPublicId={publicId}
      afterSuccessUrl="/bewt/complete?from=bewts"
    />
  );
}
