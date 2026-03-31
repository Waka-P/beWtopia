import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { truncate } from "@/utils/truncate";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { GanttPageClient } from "./GanttPageClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string; roomId: string }>;
}): Promise<Metadata> {
  const { publicId, roomId } = await params;
  if (!publicId || typeof publicId !== "string") notFound();
  if (!roomId || typeof roomId !== "string") notFound();

  const project = await prisma.bewtsProject.findUnique({
    where: { publicId },
    include: {
      rooms: true,
    },
  });

  if (!project) notFound();

  const room = project.rooms.find((r) => r.id === Number(roomId));
  if (!room) notFound();

  return {
    title: `ガントチャート：${truncate(project.name, 15)} - ${room.name}`,
  };
}
export default async function GanttPage({
  params,
}: {
  params: Promise<{ publicId: string; roomId: string }>;
}) {
  const { publicId, roomId: roomIdStr } = await params;
  const roomId = Number(roomIdStr);
  if (!publicId || Number.isNaN(roomId)) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  const myId = session?.user?.id ? Number(session.user.id) : null;

  const project = await prisma.bewtsProject.findUnique({
    where: { publicId },
    include: {
      permissions: true,
      roles: true,
      rooms: {
        include: {
          members: { select: { userId: true } },
        },
      },
    },
  });

  if (!project) notFound();

  const isJoined = myId
    ? Boolean(project.permissions.find((p) => p.userId === myId))
    : false;
  if (!isJoined) notFound();

  const room = project.rooms.find((r) => r.id === roomId);
  if (!room) notFound();

  const isAdmin = myId
    ? Boolean(
        project.permissions.find(
          (p) => p.userId === myId && p.level === "ADMIN",
        ),
      )
    : false;

  return (
    <GanttPageClient
      project={{
        id: project.id,
        publicId: project.publicId,
        name: project.name,
      }}
      room={{
        id: room.id,
        name: room.name,
        isAllRoom: Boolean(room.isAllRoom),
      }}
      roles={project.roles.map((r) => ({
        id: r.id,
        name: r.name,
        userIds: (
          project.rooms.find((roomItem) => roomItem.roleId === r.id)?.members ??
          []
        ).map((member) => member.userId),
      }))}
      isAdmin={isAdmin}
    />
  );
}
