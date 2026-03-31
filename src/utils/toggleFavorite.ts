export type ToggleFavoriteResult = {
  isFavorite: boolean;
  favoritesCount?: number;
};

export async function toggleFavoriteOnServer(
  appPublicId: string,
  nextIsFavorite: boolean,
): Promise<ToggleFavoriteResult | null> {
  const method = nextIsFavorite ? "POST" : "DELETE";

  const res = await fetch(`/api/apps/${appPublicId}/favorite`, {
    method,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  if (!res.ok) {
    try {
      // biome-ignore lint/suspicious/noConsole: デバッグ用ログ
      console.error("failed to toggle favorite", await res.text());
    } catch {
      // ignore
    }
    return null;
  }

  return (await res.json()) as ToggleFavoriteResult;
}
