"use client";

import { ConfirmModal } from "@/components/ConfirmModal";
import { toggleFavoriteOnServer } from "@/utils/toggleFavorite";
import { useEffect, useState } from "react";
import styles from "../home.module.scss";
import AppCard from "./AppCard";
import HomeCarousel from "./HomeCarousel";

export type HomePageApp = {
  publicId: string;
  name: string;
  summary: string;
  description: string;
  rating: number;
  iconUrl: string | null;
  thumbnailUrl: string | null;
  isFavorite?: boolean;
};

export type HomePageContentProps = {
  userName?: string | null;
  apps: HomePageApp[];
  carouselApps: {
    popular: HomePageApp[];
    subscription: HomePageApp[];
    template: HomePageApp[];
    new: HomePageApp[];
  };
};

export default function HomePageContent({
  apps,
  carouselApps,
}: HomePageContentProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [favoriteAppIds, setFavoriteAppIds] = useState<string[]>(
    apps.filter((app) => app.isFavorite).map((app) => app.publicId),
  );
  const [favoriteProcessingIds, setFavoriteProcessingIds] = useState<string[]>(
    [],
  );
  const [hiddenAppIds, setHiddenAppIds] = useState<string[]>([]);
  const [hideTargetApp, setHideTargetApp] = useState<HomePageApp | null>(null);

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // メニュー本体またはトグルボタン内のクリックなら閉じない
      if (
        target.closest("[data-home-action-menu]") ||
        target.closest("[data-home-action-menu-btn]")
      ) {
        return;
      }

      setOpenMenuId(null);
    };
    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () =>
      document.removeEventListener("mousedown", handleDocumentMouseDown);
  }, []);

  const toggleFavorite = async (appPublicId: string) => {
    if (favoriteProcessingIds.includes(appPublicId)) return;

    const nextIsFavorite = !favoriteAppIds.includes(appPublicId);
    setFavoriteProcessingIds((prev) => [...prev, appPublicId]);

    try {
      const data = await toggleFavoriteOnServer(appPublicId, nextIsFavorite);
      if (!data) return;

      setFavoriteAppIds((prev) => {
        const exists = prev.includes(appPublicId);
        if (data.isFavorite) {
          return exists ? prev : [...prev, appPublicId];
        }
        return exists ? prev.filter((id) => id !== appPublicId) : prev;
      });
    } catch (e) {
      console.error("failed to toggle favorite", e);
    } finally {
      setFavoriteProcessingIds((prev) =>
        prev.filter((id) => id !== appPublicId),
      );
    }
  };

  const handleHideConfirm = async () => {
    if (!hideTargetApp) return;
    try {
      const res = await fetch(`/api/apps/${hideTargetApp.publicId}/hidden`, {
        method: "POST",
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        console.error("failed to hide app", await res.text());
        return;
      }
      setHiddenAppIds((prev) =>
        prev.includes(hideTargetApp.publicId)
          ? prev
          : [...prev, hideTargetApp.publicId],
      );
      setOpenMenuId(null);
    } catch (e) {
      console.error("failed to hide app", e);
    } finally {
      setHideTargetApp(null);
    }
  };

  return (
    <div className={styles.home}>
      <HomeCarousel carouselApps={carouselApps} />

      <section className={styles.recommendedApps}>
        <h1>おすすめ</h1>

        <div className={styles.appsCont}>
          {apps.length === 0 ? (
            <p>まだ出品されているアプリがありません。</p>
          ) : (
            apps.map((app) => {
              if (hiddenAppIds.includes(app.publicId)) {
                return null;
              }
              const isFavorite = favoriteAppIds.includes(app.publicId);

              return (
                <AppCard
                  key={app.publicId}
                  app={app}
                  isMenuOpen={openMenuId === app.publicId}
                  isFavorite={isFavorite}
                  onToggleMenu={() =>
                    setOpenMenuId((prev) =>
                      prev === app.publicId ? null : app.publicId,
                    )
                  }
                  onToggleFavorite={() => toggleFavorite(app.publicId)}
                  onHide={() => setHideTargetApp(app)}
                />
              );
            })
          )}
        </div>
      </section>

      <ConfirmModal
        open={!!hideTargetApp}
        title="アプリを非表示にしますか？"
        message="設定画面から再表示できます。"
        appName={hideTargetApp?.name}
        confirmLabel="非表示にする"
        cancelLabel="キャンセル"
        onConfirm={handleHideConfirm}
        onCancel={() => setHideTargetApp(null)}
      />
    </div>
  );
}
