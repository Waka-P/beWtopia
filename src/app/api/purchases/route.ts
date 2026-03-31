import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const userId = Number(session.user.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return new Response(JSON.stringify({ error: "INVALID_USER" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const purchases = await prisma.purchaseHistory.findMany({
      where: { userId },
      include: {
        app: { include: { owner: true } },
        salesPlan: true,
      },
      orderBy: { purchasedAt: "desc" },
    });

    const data = purchases.map((p) => ({
      id: p.id,
      purchasedAt: p.purchasedAt,
      appPublicId: p.app.publicId,
      appName: p.app.name,
      appIconUrl: p.app.appIconUrl,
      price: p.salesPlan.price,
      salesFormat: p.salesPlan.salesFormat === "P" ? "買い切り" : "サブスク",
      sellerName: p.app.owner?.name ?? null,
      sellerIconUrl: p.app.owner?.image ?? null,
    }));

    return new Response(JSON.stringify({ items: data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("GET /api/purchases error", e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
