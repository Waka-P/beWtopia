import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { truncate } from "@/utils/truncate";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import BewtsChatClient from "../BewtsChatClient";

type Room = {
  id: number;
  name: string;
  isAllRoom: boolean;
  roleId?: number | null;
};

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
    title: `${truncate(project.name, 15)} - ${room.name}`,
  };
}

export default async function BewtsChatRoomPage({
  params,
}: {
  params: Promise<{ publicId: string; roomId: string }>;
}) {
  const { publicId, roomId } = await params;
  if (!publicId || typeof publicId !== "string") notFound();
  if (!roomId || typeof roomId !== "string") notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  const myId = session?.user?.id ? Number(session.user.id) : null;
  const myName = session?.user?.name ?? null;

  const project = await prisma.bewtsProject.findUnique({
    where: { publicId },
    include: {
      roles: true,
      rooms: { include: { members: { select: { userId: true } } } },
      permissions: true,
      leader: { select: { id: true, name: true, image: true } },
    },
  });

  if (!project) notFound();

  const isJoined = myId
    ? Boolean(project.permissions.find((p) => p.userId === myId))
    : false;
  if (!isJoined) return notFound();

  const isAdmin = myId
    ? Boolean(
        project.permissions.find(
          (p) => p.userId === myId && p.level === "ADMIN",
        ) || project.leader?.id === myId,
      )
    : false;

  const userRole =
    myId == null
      ? null
      : project.roles.find((role) => {
          const roleRoom = project.rooms.find(
            (room) => room.roleId === role.id,
          );
          return roleRoom?.members.some((member) => member.userId === myId);
        });

  const rooms: Room[] = project.rooms.map((r) => ({
    id: r.id,
    name: r.name,
    isAllRoom: Boolean(r.isAllRoom),
    roleId: r.roleId ?? null,
  }));

  const numericRoomId = Number(roomId);
  const roomExists = rooms.some((r) => r.id === numericRoomId);
  if (!roomExists) notFound();

  const allRoomMembers = project.rooms.find((r) => r.isAllRoom)?.members ?? [];
  const leaderId = project.leader?.id ?? null;
  const uniqueMemberIds = Array.from(
    new Set(allRoomMembers.map((m) => m.userId)),
  );
  const memberCount =
    leaderId != null
      ? uniqueMemberIds.filter((id) => id !== leaderId).length
      : uniqueMemberIds.length;
  const totalMemberCount = leaderId != null ? memberCount + 1 : memberCount;

  return (
    <BewtsChatClient
      project={{
        id: project.id,
        publicId: project.publicId,
        name: project.name,
        memberCount,
        totalMemberCount,
      }}
      rooms={rooms}
      initialRoomId={numericRoomId}
      isAdmin={isAdmin}
      userRoleId={userRole?.id ?? null}
      currentUserName={myName}
    />
  );
}
