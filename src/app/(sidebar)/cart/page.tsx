import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { headers } from "next/headers";
import CartClient from "./CartClient";

export const metadata: Metadata = {
  title: "カート",
};

export type PurchaseOption = "買い切り" | "サブスク";

export type CartItem = {
  id: number;
  name: string;
  appPublicId: string;
  iconUrl: string | null;
  selectable: boolean;
  selected: PurchaseOption;
  buyPrice?: number;
  subPrice?: number;
  fixedPrice?: number;
  isOpen?: boolean;
};

async function getCartItems(): Promise<CartItem[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return [];
  }

  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return [];
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
    return [];
  }

  const mapped: CartItem[] = cart.items
    .map((item): CartItem | null => {
      const oneTimePlan = item.app.salesPlans.find(
        (p) => p.salesFormat === "P",
      );
      const subPlan = item.app.salesPlans.find((p) => p.salesFormat === "S");

      const hasOneTime = !!oneTimePlan;
      const hasSub = !!subPlan;

      const selectable = hasOneTime && hasSub;

      const selected: PurchaseOption =
        item.salesFormat === "P" ? "買い切り" : "サブスク";

      if (selectable) {
        return {
          id: item.id,
          name: item.app.name,
          appPublicId: item.app.publicId,
          iconUrl: item.app.appIconUrl,
          selectable: true,
          selected,
          buyPrice: oneTimePlan?.price,
          subPrice: subPlan?.price,
          isOpen: false,
        };
      }

      // どちらか一方のみ
      if (hasOneTime) {
        return {
          id: item.id,
          name: item.app.name,
          appPublicId: item.app.publicId,
          iconUrl: item.app.appIconUrl,
          selectable: false,
          selected: "買い切り" as const,
          fixedPrice: oneTimePlan?.price,
        };
      }

      if (hasSub) {
        return {
          id: item.id,
          name: item.app.name,
          appPublicId: item.app.publicId,
          iconUrl: item.app.appIconUrl,
          selectable: false,
          selected: "サブスク" as const,
          fixedPrice: subPlan?.price,
        };
      }

      // プランが無い想定外ケースはスキップ
      return null;
    })
    .filter((i): i is CartItem => i !== null);

  return mapped;
}

export default async function CartPage() {
  const items = await getCartItems();

  return <CartClient initialItems={items} />;
}
