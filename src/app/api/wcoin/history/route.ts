import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildCoinHistoryItems } from "@/lib/wcoin";

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

    const url = new URL(req.url);
    const pageParam = url.searchParams.get("page");
    const pageSizeParam = url.searchParams.get("pageSize");
    const allParam = url.searchParams.get("all");

    const fetchAll =
      allParam === "1" || allParam === "true" || allParam === "yes";

    const page = fetchAll ? 0 : Math.max(0, Number(pageParam ?? 0) || 0);
    const pageSize = fetchAll
      ? undefined
      : Math.min(100, Math.max(1, Number(pageSizeParam ?? 20) || 20));

    const [rawItems, total] = await Promise.all([
      prisma.coinTransaction.findMany({
        where: {
          OR: [{ receiverUserId: userId }, { senderUserId: userId }],
        },
        orderBy: { createdAt: "desc" },
        skip: fetchAll ? 0 : page * (pageSize ?? 20),
        take: pageSize,
        select: {
          id: true,
          amount: true,
          createdAt: true,
          memo: true,
          receiverUserId: true,
          senderUserId: true,
          receiverUser: {
            select: { id: true, name: true },
          },
          senderUser: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.coinTransaction.count({
        where: {
          OR: [{ receiverUserId: userId }, { senderUserId: userId }],
        },
      }),
    ]);

    const items = buildCoinHistoryItems(rawItems, userId);

    return new Response(
      JSON.stringify({
        items,
        page,
        pageSize,
        total,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (e) {
    console.error("Get coin history error", e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
