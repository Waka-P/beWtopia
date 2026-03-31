import Sidebar from "@/app/(sidebar)/components/Sidebar";
import { SidebarHeader } from "@/app/(sidebar)/components/SidebarHeader";
import type { User } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppDetailNavigationMarker } from "./components/AppDetailNavigationMarker";
import { SidebarProvider } from "./contexts/SidebarContext";
import styles from "./layout.module.scss";

async function getCartCount(currUser: User): Promise<number> {
  try {
    const userId = Number(currUser.id);
    if (Number.isNaN(userId)) {
      return 0;
    }

    const cart = await prisma.cart.findFirst({
      where: { userId },
      include: {
        items: {
          include: {
            app: {
              include: {
                salesPlans: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      return 0;
    }

    const items = cart.items.map((item) => ({
      id: item.id,
      appPublicId: item.app.publicId,
      salesFormat: item.salesFormat,
      app: {
        publicId: item.app.publicId,
        name: item.app.name,
        appIconUrl: item.app.appIconUrl,
        salesPlans: item.app.salesPlans,
      },
    }));
    return items.length;
  } catch {
    return 0;
  }
}

async function getUnreadNotificationCount(currUser: User): Promise<number> {
  try {
    const userId = Number(currUser.id);
    if (Number.isNaN(userId)) {
      return 0;
    }

    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return count;
  } catch {
    return 0;
  }
}

async function getUnreadChatCount(currUser: User): Promise<number> {
  try {
    const userId = Number(currUser.id);
    if (Number.isNaN(userId)) {
      return 0;
    }

    const rooms = await prisma.chatRoom.findMany({
      where: {
        members: {
          some: {
            userId,
            isHidden: false,
          },
        },
      },
      include: {
        members: {
          select: {
            userId: true,
            deletedAt: true,
          },
        },
      },
    });

    if (rooms.length === 0) {
      return 0;
    }

    // /api/chat/rooms の unreadCount と同じ基準で「未読ルーム数」を計算する
    const unreadFlags = await Promise.all(
      rooms.map(async (room) => {
        const member = room.members.find((m) => m.userId === userId);
        if (!member) return false;

        const deletedAt = member.deletedAt ?? undefined;

        const unreadCount = await prisma.chatMessage.count({
          where: {
            roomId: room.id,
            userId: { not: userId },
            reads: { none: { userId } },
            ...(deletedAt ? { createdAt: { gt: deletedAt } } : {}),
          },
        });

        return unreadCount > 0;
      }),
    );

    return unreadFlags.filter(Boolean).length;
  } catch {
    return 0;
  }
}

export default async function SidebarLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const headersList = await headers();

  const session = await auth.api.getSession({
    headers: headersList,
  });

  if (!session) {
    redirect("/login");
  }

  const currUser = await prisma.user.findUnique({
    where: { id: Number(session.user.id) },
  });

  if (!currUser) {
    redirect("/login");
  }

  const [initialCartCount, unreadNotificationCount, unreadChatCount] =
    await Promise.all([
      getCartCount(currUser),
      getUnreadNotificationCount(currUser),
      getUnreadChatCount(currUser),
    ]);

  return (
    <SidebarProvider>
      <AppDetailNavigationMarker />
      <div className={styles.sidebarLayout}>
        <Sidebar
          user={session?.user}
          unreadNotificationCount={unreadNotificationCount}
          unreadChatCount={unreadChatCount}
        />
        <div className={styles.mainColumn}>
          <SidebarHeader initialCartCount={initialCartCount} />
          <div className={styles.content}>
            {children}
            {modal}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
