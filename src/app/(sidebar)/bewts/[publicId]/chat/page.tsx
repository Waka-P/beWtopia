import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

// Redirect to canonical room-specific route
import BewtsChatClient from "./BewtsChatClient";

type Room = {
  id: number;
  name: string;
  isAllRoom: boolean;
  roleId?: number | null;
};

export default async function BewtsChatPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  if (!publicId || typeof publicId !== "string") notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  const myId = session?.user?.id ? Number(session.user.id) : null;

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
  if (!isJoined) return notFound(); // only members can open Bewts chat

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

  const initialRoom = rooms.find((r) => r.isAllRoom) ?? rooms[0];
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

  // Redirect to the room-specific page (canonical URL)
  const targetRoomId = initialRoom?.id ?? null;
  if (targetRoomId) {
    redirect(`/bewts/${publicId}/chat/${targetRoomId}`);
  }

  // Fallback (shouldn't normally render) - render client component
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
      initialRoomId={initialRoom?.id ?? null}
      isAdmin={isAdmin}
      userRoleId={userRole?.id ?? null}
    />
  );
}
