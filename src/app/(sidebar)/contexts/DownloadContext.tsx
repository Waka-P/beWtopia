"use client";
import { createContext, useContext, useState } from "react";

type DownloadItem = {
  id: string;
  name: string;
  fileUrl: string;
  status: "idle" | "downloading" | "done" | "failed";
  error?: string | null; // optional human-readable error for UI/debugging
};

type DownloadContextType = {
  items: DownloadItem[];
  addItems: (items: DownloadItem[]) => void;
  startDownload: (id: string) => Promise<void>;
  startAll: () => Promise<void>;
};

const DownloadContext = createContext<DownloadContextType | null>(null);

export const DownloadProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [items, setItems] = useState<DownloadItem[]>([]);

  const addItems = (newItems: DownloadItem[]) => {
    // dedupe by id and preserve existing status when present
    setItems((prev) => {
      const map = new Map(prev.map((i) => [i.id, i]));
      for (const ni of newItems) {
        const existing = map.get(ni.id);
        if (existing) {
          // update metadata (name/fileUrl) but keep current status/error
          map.set(ni.id, { ...existing, name: ni.name, fileUrl: ni.fileUrl });
        } else {
          // ensure error field exists
          map.set(ni.id, { ...ni, error: null });
        }
      }
      return Array.from(map.values());
    });
  };

  const downloadFile = async (item: DownloadItem) => {
    // mark downloading (guard against concurrent runs)
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: "downloading" } : i)),
    );

    try {
      // try direct fetch first
      let res = await fetch(item.fileUrl);

      // if direct fetch is unauthorized/forbidden, try server-side proxy
      if (!res.ok && (res.status === 401 || res.status === 403)) {
        console.warn(
          "Direct file fetch returned",
          res.status,
          "— trying proxy download for",
          item.id,
        );
        const proxyUrl = `/api/apps/${encodeURIComponent(item.id)}/download`;
        const proxyRes = await fetch(proxyUrl, { credentials: "include" });
        if (!proxyRes.ok) {
          throw new Error(`Proxy download failed: ${proxyRes.status}`);
        }
        res = proxyRes;
      }

      if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
      const blob = await res.blob();

      // determine filename: use app name as base, preserve sensible extension
      const sanitize = (s: string) => s.replace(/[\\/?%*:|"<>]/g, "_");
      const baseName = sanitize(item.name || "download");

      // try to extract extension from Content-Disposition or URL
      let ext = "";
      const cd = res.headers.get("Content-Disposition") || "";
      const cdMatch =
        /filename\*=(?:UTF-8'')?([^;\n]+)$/i.exec(cd) ||
        /filename="?([^";]+)"?/i.exec(cd);
      if (cdMatch?.[1]) {
        try {
          const cdName = decodeURIComponent(cdMatch[1].replace(/^"|"$/g, ""));
          const m = cdName.match(/(\.[^/.]+)$/);
          if (m) ext = m[1];
        } catch {
          const m = cdMatch[1].replace(/^"|"$/g, "").match(/(\.[^/.]+)$/);
          if (m) ext = m[1];
        }
      } else {
        try {
          const u = new URL(item.fileUrl);
          const p = u.pathname.split("/").pop();
          if (p) {
            const m = p.match(/(\.[^/.]+)$/);
            if (m) ext = m[1];
          }
        } catch {
          // ignore
        }
      }

      const contentType = (res.headers.get("Content-Type") || "").toLowerCase();

      // reject obviously-wrong content types (e.g. image served instead of zip)
      if (contentType.startsWith("image/")) {
        console.error(
          "Downloaded file has image content-type, aborting:",
          contentType,
          item.fileUrl,
        );
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "failed" } : i)),
        );
        return;
      }
      // ensure we have an extension; prefer extracted ext, else infer from content-type
      if (!ext) {
        if (
          contentType.includes("zip") ||
          contentType.includes("x-zip-compressed") ||
          contentType.includes("octet-stream")
        ) {
          ext = ".zip";
        } else if (
          contentType.includes("apk") ||
          contentType.includes("android")
        ) {
          ext = ".apk";
        } else if (
          contentType.includes("msdownload") ||
          contentType.includes("exe")
        ) {
          ext = ".exe";
        } else {
          ext = ".zip"; // fallback
        }
      }

      const base = baseName.replace(/\.[^/.]+$/, "");
      const filename = `${base}${ext}`;

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);

      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "done" } : i)),
      );
    } catch (err) {
      console.error("downloadFile error", err);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "failed" } : i)),
      );
    }
  };

  const startDownload = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (item.status === "downloading") return; // already in progress
    await downloadFile(item);
  };

  const startAll = async () => {
    const snapshot = items.slice();
    for (const item of snapshot) {
      if (item.status === "downloading") continue;
      await downloadFile(item);
    }
  };

  return (
    <DownloadContext.Provider
      value={{ items, addItems, startDownload, startAll }}
    >
      {children}
    </DownloadContext.Provider>
  );
};

export const useDownload = () => {
  const ctx = useContext(DownloadContext);
  if (!ctx) throw new Error("DownloadProvider missing");
  return ctx;
};
