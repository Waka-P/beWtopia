"use client";

import { Badge } from "@/components/Badge";
import LogoutButton from "@/components/LogoutButton";
import { fetcher } from "@/utils/fetcher";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./SidebarHeader.module.scss";

interface SidebarHeaderProps {
  initialCartCount: number;
}

export function SidebarHeader({ initialCartCount }: SidebarHeaderProps) {
  const pathname = usePathname();
  const isCartPage = pathname === "/cart";
  // hide on both project chat index and specific room pages
  const isBewtsChatPage = /^\/bewts\/[^/]+\/chat(?:\/.*)?$/.test(
    pathname ?? "",
  );
  const isTrialPage =
    pathname?.startsWith("/apps/") && pathname.endsWith("/trial");
  const [cartCount, setCartCount] = useState(initialCartCount);

  const fetchCartCount = async () => {
    try {
      const data = await fetcher<{
        items?: { id: number }[];
      }>("/api/cart");
      setCartCount(data.items?.length ?? 0);
    } catch {
      setCartCount(0);
    }
  };

  // biome-ignore lint: カートが更新されたときのみ実行する
  useEffect(() => {
    const handler = () => {
      fetchCartCount();
    };

    window.addEventListener("cart:updated", handler);
    return () => {
      window.removeEventListener("cart:updated", handler);
    };
  }, []);

  const showCartBadge = cartCount > 0;

  if (isBewtsChatPage || isTrialPage) {
    return null;
  }

  return (
    <header className={styles.header}>
      <h1>
        <Link href="/" className={styles.logoLink}>
          <Image
            src="/images/logo.png"
            width={1549}
            height={1749}
            alt="beWtopia"
            className={styles.logoImage}
            priority
          />
        </Link>
      </h1>

      <div className={styles.rightTop}>
        {!isCartPage && (
          <Link href="/cart" className={styles.cartLink} aria-label="カート">
            <Image
              src="/images/cart.png"
              width={1451}
              height={1309}
              alt="カート"
              className={styles.cartImage}
            />

            {showCartBadge && (
              <div className={styles.purchaseQuantity}>
                <Badge value={cartCount} variant="light" />
              </div>
            )}
          </Link>
        )}

        <div className={styles.logoutButtonWrapper}>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
