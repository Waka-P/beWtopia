import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getObjectFromR2 } from "@/lib/r2";
import type { GetObjectCommandOutput } from "@aws-sdk/client-s3";
import fs from "fs";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import os from "os";
import path from "path";
import * as unzipper from "unzipper";

const ALLOWED_EXTENSIONS: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function normalizeRequestedPathFromSegments(
  segments: string[] | undefined,
): string {
  const raw =
    segments && segments.length > 0 ? segments.join("/") : "index.html";
  const noLeadingSlash = raw.replace(/^\/+/, "");
  if (noLeadingSlash.includes("..")) {
    throw new Error("Invalid path");
  }
  return noLeadingSlash || "index.html";
}

async function findIndexHtml(tmpDir: string): Promise<string | null> {
  const targets = new Set(["index.html", "index.htm"]);

  async function walk(dir: string): Promise<string | null> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = await walk(fullPath);
        if (found) return found;
      } else if (entry.isFile() && targets.has(entry.name.toLowerCase())) {
        return fullPath;
      }
    }
    return null;
  }

  return walk(tmpDir);
}

async function findFileBySuffix(
  tmpDir: string,
  requestedPath: string,
): Promise<string | null> {
  const target = requestedPath.replace(/\\/g, "/");

  async function walk(dir: string): Promise<string | null> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = await walk(fullPath);
        if (found) return found;
      } else if (entry.isFile()) {
        const rel = path.relative(tmpDir, fullPath).replace(/\\/g, "/");
        if (rel === target || rel.endsWith("/" + target)) {
          return fullPath;
        }
      }
    }
    return null;
  }

  return walk(tmpDir);
}

async function extractZipToTempDir(
  body: GetObjectCommandOutput["Body"],
): Promise<string> {
  if (!body) {
    throw new Error("Empty R2 object body");
  }

  const tmpBase = os.tmpdir();
  const tmpDir = await fs.promises.mkdtemp(path.join(tmpBase, "bewt-trial-"));

  const stream = body as NodeJS.ReadableStream;

  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(unzipper.Extract({ path: tmpDir }))
      .on("close", () => resolve())
      .on("error", (err: unknown) => reject(err));
  });

  return tmpDir;
}

async function readFileFromTempDir(
  tmpDir: string,
  requestedPath: string,
): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const ext = path.extname(requestedPath).toLowerCase();
  const contentType = ALLOWED_EXTENSIONS[ext];
  if (!contentType) {
    throw new Error("Disallowed extension");
  }

  const absPath = path.resolve(tmpDir, requestedPath);
  if (!absPath.startsWith(tmpDir)) {
    throw new Error("Path traversal detected");
  }

  try {
    const buffer = await fs.promises.readFile(absPath);
    return { buffer, contentType };
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === "ENOENT") {
      throw Object.assign(new Error("File not found"), { code: "ENOENT" });
    }
    throw err;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string; path?: string[] }> },
) {
  const { publicId, path: segments } = await params;
  if (!publicId || typeof publicId !== "string") {
    return NextResponse.json({ error: "Invalid app id" }, { status: 400 });
  }

  const requestedPath = normalizeRequestedPathFromSegments(segments);

  // 認証必須（購入有無は問わず、ログインユーザーのみトライアル可能）
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  const userId = Number(session.user.id);

  const app = await prisma.app.findUnique({
    where: { publicId },
    select: {
      id: true,
      trial: {
        select: {
          trialDays: true,
          trialFileKey: true,
        },
      },
    },
  });

  if (!app || !app.trial || !app.trial.trialFileKey) {
    return NextResponse.json(
      { error: "トライアルファイルがありません" },
      { status: 404 },
    );
  }

  // ユーザーごとのお試し開始日時を取得（なければ作成）
  const usage = await prisma.appTrialUsage.upsert({
    where: {
      appId_userId: {
        appId: app.id,
        userId,
      },
    },
    update: {},
    create: {
      appId: app.id,
      userId,
    },
  });

  if (typeof app.trial.trialDays === "number") {
    const trialEndAt = new Date(
      usage.startedAt.getTime() + app.trial.trialDays * 24 * 60 * 60 * 1000,
    );
    if (new Date() >= trialEndAt) {
      return NextResponse.json(
        { error: "お試し期間は終了しました" },
        { status: 403 },
      );
    }
  }

  let tmpDir: string | null = null;
  try {
    const object = (await getObjectFromR2(
      app.trial.trialFileKey,
    )) as GetObjectCommandOutput;
    if (!object || !object.Body) {
      return NextResponse.json(
        { error: "ファイルが見つかりません" },
        { status: 404 },
      );
    }

    tmpDir = await extractZipToTempDir(object.Body);

    let buffer: Buffer;
    let contentType: string;
    try {
      ({ buffer, contentType } = await readFileFromTempDir(
        tmpDir,
        requestedPath,
      ));
    } catch (readErr: any) {
      if (readErr && readErr.code === "ENOENT") {
        if (requestedPath === "index.html") {
          const found = await findIndexHtml(tmpDir);
          if (found) {
            const rel = path.relative(tmpDir, found);
            ({ buffer, contentType } = await readFileFromTempDir(tmpDir, rel));
          } else {
            return NextResponse.json(
              { error: "指定されたファイルが見つかりません" },
              { status: 404 },
            );
          }
        } else {
          const found = await findFileBySuffix(tmpDir, requestedPath);
          if (found) {
            const rel = path.relative(tmpDir, found);
            ({ buffer, contentType } = await readFileFromTempDir(tmpDir, rel));
          } else {
            return NextResponse.json(
              { error: "指定されたファイルが見つかりません" },
              { status: 404 },
            );
          }
        }
      } else {
        throw readErr;
      }
    }

    if (contentType.startsWith("text/html")) {
      const html = buffer.toString("utf8");
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": contentType,
        },
      });
    }

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (err) {
    console.error("trial asset error", err);
    return NextResponse.json(
      { error: "お試しファイルの読み取りに失敗しました" },
      { status: 500 },
    );
  } finally {
    if (tmpDir) {
      try {
        await fs.promises.rm(tmpDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error("failed to cleanup trial temp dir", cleanupErr);
      }
    }
  }
}
