import { prisma } from "@/lib/prisma";

export type CoinHistoryItem = {
  id: number;
  amount: number;
  createdAt: string;
  receiverUserId: number | null;
  senderUserId: number | null;
  direction: "in" | "out";
  type: "charge" | "purchase" | "tip_in" | "tip_out" | "other";
  label: string;
  counterpartyUserId: number | null;
  counterpartyName: string | null;
};

type TxWithUsers = {
  id: number;
  amount: number;
  createdAt: Date;
  memo: string | null;
  receiverUserId: number | null;
  senderUserId: number | null;
  receiverUser: { id: number; name: string | null } | null;
  senderUser: { id: number; name: string | null } | null;
};

export function buildCoinHistoryItems(
  rawItems: TxWithUsers[],
  userId: number,
): CoinHistoryItem[] {
  return rawItems.map((tx) => {
    const direction = (tx.senderUserId === userId ? "out" : "in") as
      | "in"
      | "out";

    let type: CoinHistoryItem["type"] = "other";
    let label = "";
    let counterpartyUserId: number | null = null;
    let counterpartyName: string | null = null;

    const memo = tx.memo ?? "";

    let appNameFromMemo: string | null = null;
    if (memo.startsWith("wcoin_purchase:")) {
      const parts = memo.split(":");
      const appPart = parts.find((p) => p.startsWith("appName="));
      if (appPart) {
        const encoded = appPart.slice("appName=".length);
        try {
          appNameFromMemo = decodeURIComponent(encoded);
        } catch {
          appNameFromMemo = null;
        }
      }
    }

    if (memo.startsWith("coin_charge:")) {
      type = "charge";
      label = "チャージ";
    } else if (memo.startsWith("wcoin_purchase:")) {
      // Wコインによるアプリ購入・売上
      type = "purchase";

      if (
        tx.senderUserId !== null &&
        tx.receiverUserId !== null &&
        tx.senderUserId !== tx.receiverUserId
      ) {
        // 購入者 → 販売者 への送金として記録されているケース
        if (direction === "out") {
          // 自分が購入者
          counterpartyUserId = tx.receiverUserId;
          counterpartyName = tx.receiverUser?.name ?? null;
          label = appNameFromMemo ? `${appNameFromMemo}の購入` : "アプリ購入";
        } else {
          // 自分が販売者
          counterpartyUserId = tx.senderUserId;
          counterpartyName = tx.senderUser?.name ?? null;
          label = appNameFromMemo
            ? `${appNameFromMemo}の販売売上`
            : "アプリ売上";
        }
      } else {
        // 旧データや片側のみの記録
        if (direction === "out") {
          label = appNameFromMemo ? `${appNameFromMemo}の購入` : "アプリ購入";
        } else {
          label = appNameFromMemo
            ? `${appNameFromMemo}の販売売上`
            : "アプリ売上";
        }
      }
    } else if (
      tx.senderUserId !== null &&
      tx.receiverUserId !== null &&
      tx.senderUserId !== tx.receiverUserId
    ) {
      if (direction === "out") {
        type = "tip_out";
        counterpartyUserId = tx.receiverUserId;
        counterpartyName = tx.receiverUser?.name ?? null;
        label = counterpartyName
          ? `${counterpartyName}さんへの投げ銭`
          : "投げ銭（送信）";
      } else {
        type = "tip_in";
        counterpartyUserId = tx.senderUserId;
        counterpartyName = tx.senderUser?.name ?? null;
        label = counterpartyName
          ? `${counterpartyName}さんからの投げ銭`
          : "投げ銭（受信）";
      }
    } else if (
      tx.senderUserId !== null &&
      tx.receiverUserId !== null &&
      tx.senderUserId === tx.receiverUserId
    ) {
      type = "purchase";
      label = "アプリ購入";
    } else {
      type = direction === "out" ? "other" : "other";
      label = direction === "out" ? "支払い" : "受け取り";
    }

    return {
      id: tx.id,
      amount: tx.amount,
      createdAt: tx.createdAt.toISOString(),
      receiverUserId: tx.receiverUserId,
      senderUserId: tx.senderUserId,
      direction,
      type,
      label,
      counterpartyUserId,
      counterpartyName,
    };
  });
}

export async function getWcoinSummary(userId: number) {
  const [user, rawItems, total] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { coinBalance: true },
    }),
    prisma.coinTransaction.findMany({
      where: {
        OR: [{ receiverUserId: userId }, { senderUserId: userId }],
      },
      orderBy: { createdAt: "desc" },
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

  const history = buildCoinHistoryItems(rawItems as TxWithUsers[], userId);

  return {
    balance: user?.coinBalance ?? 0,
    history,
    total,
  };
}
