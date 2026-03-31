import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type PostBody = {
  appPublicId: string;
  salesFormat: "P" | "S";
};

type DeleteBody = {
  cartItemId: number;
};

type PatchBody = {
  cartItemId: number;
  salesFormat: "P" | "S";
};

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 });
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
      return NextResponse.json({ items: [] });
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

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Failed to fetch cart", error);
    return NextResponse.json(
      { error: "Failed to fetch cart" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 });
    }

    const body = (await req.json()) as Partial<PostBody>;
    const appPublicId = body.appPublicId;
    const salesFormat = body.salesFormat;

    if (!appPublicId || typeof appPublicId !== "string") {
      return NextResponse.json({ error: "Invalid app id" }, { status: 400 });
    }

    if (salesFormat !== "P" && salesFormat !== "S") {
      return NextResponse.json(
        { error: "Invalid sales format" },
        { status: 400 },
      );
    }

    const app = await prisma.app.findUnique({
      where: { publicId: appPublicId },
      include: { salesPlans: true },
    });

    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    const hasPlan = app.salesPlans.some(
      (plan) => plan.salesFormat === salesFormat,
    );
    if (!hasPlan) {
      return NextResponse.json(
        { error: "Requested sales plan does not exist for this app" },
        { status: 400 },
      );
    }

    let cart = await prisma.cart.findFirst({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        appId: app.id,
        salesFormat,
      },
    });

    if (existingItem) {
      return NextResponse.json({ cartItem: existingItem, duplicated: true });
    }

    const cartItem = await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        appId: app.id,
        salesFormat,
      },
    });

    return NextResponse.json({ cartItem });
  } catch (error) {
    console.error("Failed to add to cart", error);
    return NextResponse.json(
      { error: "Failed to add to cart" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 });
    }

    const body = (await req.json()) as Partial<DeleteBody>;
    const cartItemId = Number(body.cartItemId);

    if (!Number.isInteger(cartItemId) || cartItemId <= 0) {
      return NextResponse.json(
        { error: "Invalid cart item id" },
        { status: 400 },
      );
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: {
          userId,
        },
      },
    });

    if (!cartItem) {
      return NextResponse.json(
        { error: "Cart item not found" },
        { status: 404 },
      );
    }

    await prisma.cartItem.delete({ where: { id: cartItem.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete cart item", error);
    return NextResponse.json(
      { error: "Failed to delete cart item" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(session.user.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 });
    }

    const body = (await req.json()) as Partial<PatchBody>;
    const cartItemId = Number(body.cartItemId);
    const salesFormat = body.salesFormat;

    if (!Number.isInteger(cartItemId) || cartItemId <= 0) {
      return NextResponse.json(
        { error: "Invalid cart item id" },
        { status: 400 },
      );
    }

    if (salesFormat !== "P" && salesFormat !== "S") {
      return NextResponse.json(
        { error: "Invalid sales format" },
        { status: 400 },
      );
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: { userId },
      },
      include: {
        app: { include: { salesPlans: true } },
      },
    });

    if (!cartItem) {
      return NextResponse.json(
        { error: "Cart item not found" },
        { status: 404 },
      );
    }

    const hasPlan = cartItem.app.salesPlans.some(
      (plan) => plan.salesFormat === salesFormat,
    );

    if (!hasPlan) {
      return NextResponse.json(
        { error: "Requested sales plan does not exist for this app" },
        { status: 400 },
      );
    }

    await prisma.cartItem.update({
      where: { id: cartItem.id },
      data: { salesFormat },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to update cart item", error);
    return NextResponse.json(
      { error: "Failed to update cart item" },
      { status: 500 },
    );
  }
}
