import type { BewtsCapability } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { defaultCapabilitiesByLevel } from "@/lib/bewtsCapabilities";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import MembersSettingsClient from "./client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  if (!publicId || typeof publicId !== "string") notFound();

  const project = await prisma.bewtsProject.findUnique({
    where: { publicId },
    select: { name: true },
  });

  if (!project) notFound();

  return {
    title: `メンバー管理 - ${project.name}`,
  };
}

export default async function BewtsSettingsMembersPage({
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
    include: {
      roles: {
        select: {
          id: true,
          name: true,
          isLeader: true,
        },
        orderBy: [{ isLeader: "desc" }, { id: "asc" }],
      },
      permissions: {
        select: {
          userId: true,
          level: true,
        },
      },
      bewtsPermissionCapabilities: {
        select: {
          userId: true,
          capability: true,
        },
      },
      rooms: {
        select: {
          id: true,
          isAllRoom: true,
          roleId: true,
          members: {
            select: {
              userId: true,
              user: {
                select: {
                  publicId: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const viewerIsAdmin = Boolean(
    await prisma.bewtsPermissionCapability.findFirst({
      where: {
        projectId: project.id,
        userId: viewerId,
        capability: {
          in: ["GRANT_PERMISSION", "ASSIGN_ROLE", "ADMIN"],
        },
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

  if (!viewerIsAdmin && !viewerIsLevelAdmin) {
    notFound();
  }

  const allRoom = project.rooms.find((room) => room.isAllRoom);
  const allRoomMembers = allRoom?.members ?? [];
  const permissionMap = new Map(
    project.permissions.map((permission) => [
      permission.userId,
      permission.level,
    ]),
  );
  const capabilityMap = new Map<number, BewtsCapability[]>();
  for (const capability of project.bewtsPermissionCapabilities) {
    const existing = capabilityMap.get(capability.userId) ?? [];
    existing.push(capability.capability);
    capabilityMap.set(capability.userId, existing);
  }
  const roleRoomMap = new Map<number, number[]>();
  for (const room of project.rooms) {
    if (room.isAllRoom || typeof room.roleId !== "number") continue;
    for (const member of room.members) {
      const roleIds = roleRoomMap.get(member.userId) ?? [];
      roleIds.push(room.roleId);
      roleRoomMap.set(member.userId, roleIds);
    }
  }

  const members = allRoomMembers
    .filter((member) => member.userId !== project.leaderId)
    .map((member) => {
      const level = permissionMap.get(member.userId) ?? "MEMBER";
      const roleIds = roleRoomMap.get(member.userId) ?? [];
      return {
        userId: member.userId,
        publicId: member.user.publicId,
        name: member.user.name,
        image: member.user.image,
        capabilities:
          capabilityMap.get(member.userId) ?? defaultCapabilitiesByLevel(level),
        roleIds,
        roleNames: project.roles
          .filter((role) => roleIds.includes(role.id))
          .map((role) => role.name),
      };
    });

  const editableRoles = project.roles
    .filter((role) => !role.isLeader)
    .map((role) => ({
      roleId: role.id,
      roleName: role.name,
    }));

  return (
    <MembersSettingsClient
      projectPublicId={project.publicId}
      projectName={project.name}
      members={members}
      roles={editableRoles}
    />
  );
}
