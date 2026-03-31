"use client";

import { cn } from "@/lib/cn";
import { fetcher } from "@/utils/fetcher";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CartItem, PurchaseOption } from "./page";
import styles from "./page.module.scss";

function formatPrice(option: PurchaseOption, price?: number | null) {
  if (!price && price !== 0) return "";
  const formatted = price.toLocaleString();
  return option === "サブスク" ? `¥${formatted}/月` : `¥${formatted}`;
}

type Props = {
  initialItems: CartItem[];
};

export default function CartClient({ initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>(initialItems);
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());

  const itemCountLabel = useMemo(
    () => (items.length > 0 ? `${items.length}個の商品` : "0個の商品"),
    [items.length],
  );

  const { subtotalBuy, subtotalSub } = useMemo(() => {
    let buy = 0;
    let sub = 0;

    for (const item of items) {
      if (item.selected === "買い切り") {
        const price = item.selectable ? item.buyPrice : item.fixedPrice;
        if (price) buy += price;
      } else if (item.selected === "サブスク") {
        const price = item.selectable ? item.subPrice : item.fixedPrice;
        if (price) sub += price;
      }
    }

    return { subtotalBuy: buy, subtotalSub: sub };
  }, [items]);

  const handleToggleOption = (id: number, option: PurchaseOption) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || !item.selectable) return item;

        if (item.isOpen) {
          const nextSelected = option;

          // サーバー側のカートアイテムの販売形式も更新
          void fetcher("/api/cart", {
            method: "PATCH",
            body: JSON.stringify({
              cartItemId: id,
              salesFormat: nextSelected === "買い切り" ? "P" : "S",
            }),
          }).catch((e: unknown) => {
            console.error("Failed to update cart item sales format", e);
          });

          return { ...item, isOpen: false, selected: nextSelected };
        }

        return { ...item, isOpen: true };
      }),
    );
  };

  const handleDelete = (id: number) => {
    // サーバー側のカートアイテムも削除
    void fetcher("/api/cart", {
      method: "DELETE",
      body: JSON.stringify({ cartItemId: id }),
    })
      .then(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("cart:updated"));
        }
      })
      .catch((e) => {
        console.error("Failed to delete cart item", e);
      });

    const row = document.getElementById(`cart-row-${id}`);
    if (row) {
      const currentHeight = row.offsetHeight;
      row.style.height = `${currentHeight}px`;
    }

    // フェードアウト開始
    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    // 不透明度トランジション終了後
    window.setTimeout(() => {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      if (row) {
        row.style.height = "0px";
      }

      // 高さトランジション完了後に実際に配列から削除
      window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id));
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 400);
    }, 300);
  };

  const sum = subtotalBuy + subtotalSub;

  return (
    <div className={styles.page}>
      <div className={styles.cart}>
        <div className={styles.cartHeader}>
          <h2>カート</h2>
          <p className="item-count">{itemCountLabel}</p>
        </div>
        <div className={styles.wrapper}>
          {items.length === 0 ? (
            <div className={styles.emptyMessage}>
              カートに追加された商品はありません。
            </div>
          ) : (
            <table className={styles.cartItems}>
              <colgroup>
                <col style={{ width: "35%" }} />
                <col style={{ width: "23%" }} />
                <col style={{ width: "23%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>商品</th>
                  <th>販売形式</th>
                  <th>価格</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isRemoving = removingIds.has(item.id);
                  const isHidden = hiddenIds.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      id={`cart-row-${item.id}`}
                      className={cn(
                        isRemoving && styles.fadeOut,
                        isHidden && styles.hidden,
                      )}
                    >
                      <td>
                        <Link href={`/apps/${item.appPublicId}`}>
                          <Image
                            className={styles.icon}
                            src={
                              item.iconUrl && item.iconUrl.length > 0
                                ? item.iconUrl
                                : "/images/icon-default.png"
                            }
                            alt={item.name}
                            width={50}
                            height={50}
                          />
                          <p>{item.name}</p>
                        </Link>
                      </td>
                      <td>
                        {item.selectable ? (
                          <div
                            className={
                              item.isOpen
                                ? `${styles.select} ${styles.animate}`
                                : styles.select
                            }
                          >
                            {(["買い切り", "サブスク"] as PurchaseOption[]).map(
                              (opt) => {
                                const isSelected = item.selected === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    data-option={opt}
                                    className={cn(styles.selectButton, {
                                      [styles.selected]: isSelected,
                                      [styles.unselected]: !isSelected,
                                    })}
                                    onClick={() =>
                                      handleToggleOption(item.id, opt)
                                    }
                                  >
                                    {opt}
                                  </button>
                                );
                              },
                            )}
                          </div>
                        ) : (
                          <div>{item.selected}</div>
                        )}
                      </td>
                      <td
                        className={cn(styles.price, {
                          [styles.open]: item.selectable && item.isOpen,
                          [styles.showBuy]:
                            item.selectable &&
                            !item.isOpen &&
                            item.selected === "買い切り",
                          [styles.showSub]:
                            item.selectable &&
                            !item.isOpen &&
                            item.selected === "サブスク",
                        })}
                      >
                        {item.selectable ? (
                          <>
                            <div
                              className={cn(styles.priceItem, styles.priceBuy)}
                            >
                              {formatPrice("買い切り", item.buyPrice)}
                            </div>
                            <div
                              className={cn(styles.priceItem, styles.priceSub)}
                            >
                              {formatPrice("サブスク", item.subPrice)}
                            </div>
                          </>
                        ) : (
                          formatPrice(item.selected, item.fixedPrice)
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          aria-label="削除"
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                          }}
                        >
                          <Image
                            className={styles.delete}
                            src="/images/delete.png"
                            alt="削除"
                            width={18}
                            height={18}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className={styles.bottom} />
        </div>
      </div>

      <div className={styles.total}>
        <div className={cn(styles.amount, styles.otp)}>
          <h2>買い切り</h2>
          <p>小計：{formatPrice("買い切り", subtotalBuy)}</p>
        </div>
        <div className={cn(styles.amount, styles.sub)}>
          <h2>サブスク</h2>
          <p>小計：{formatPrice("サブスク", subtotalSub)}</p>
        </div>

        <div className={styles.sum}>
          合計金額：¥{sum.toLocaleString()}
          <div className={styles.attnWrap}>
            <div className={styles.ast}>※</div>
            <div className={styles.attnCont}>
              <div className={styles.attnFlex}>
                <div className={styles.attn}>サブスクリプション商品は、</div>
                <div className={styles.attn}>初回支払い後</div>
              </div>
              <div className={styles.attn}>自動的に毎月請求されます。</div>
            </div>
          </div>
        </div>

        <button
          type="button"
          className={styles.toBuy}
          disabled={items.length === 0}
          onClick={() => {
            router.push("/checkout");
          }}
        >
          購入手続きへ
        </button>
      </div>
    </div>
  );
}
