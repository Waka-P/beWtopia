import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { HttpsProxyAgent } from "https-proxy-agent";
import { nanoid } from "nanoid";
import path from "path";
import * as unzipper from "unzipper";

async function fileToBuffer(file: File | Blob): Promise<Buffer> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("r2: arrayBuffer failed:", error);
    try {
      const text = await file.text();
      return Buffer.from(text, "latin1");
    } catch (err) {
      console.error("r2: fallback text failed:", err);
      throw new Error("Unable to convert file to buffer for R2 upload");
    }
  }
}

function getS3Client() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 configuration missing. Set R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY",
    );
  }

  // build base client config
  const clientConfig: any = {
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };

  // Configure HTTP handler options (increase request timeout for slow/proxied networks)
  // - Can be overridden by R2_REQUEST_TIMEOUT_MS environment variable (milliseconds)
  const requestTimeoutMs = Number(process.env.R2_REQUEST_TIMEOUT_MS ?? 120000); // default 2 minutes
  const handlerOptions: any = { requestTimeout: requestTimeoutMs };

  // If a proxy is configured in the environment, use an HTTPS proxy agent so
  // AWS SDK v3's HTTP handler sends requests through the corporate proxy.
  const proxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  if (proxy) {
    console.info("R2: using proxy:", proxy);
    const agent = new HttpsProxyAgent(proxy);
    handlerOptions.httpsAgent = agent as any;
  }

  console.info(`R2: http requestTimeout=${requestTimeoutMs}ms`);
  clientConfig.requestHandler = new NodeHttpHandler(handlerOptions);

  return new S3Client(clientConfig);
}

// お試しファイル用: 静的ファイルとして許可する拡張子（トライアル配信用APIと揃える）
const TRIAL_STATIC_ALLOWED_EXTENSIONS = new Set<string>([
  ".html",
  ".htm",
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
]);

async function assertZipBufferHasOnlyStaticFiles(
  buffer: Buffer,
): Promise<void> {
  const directory = await unzipper.Open.buffer(buffer);

  for (const entry of directory.files) {
    // ディレクトリは無視
    if (entry.type === "Directory") continue;

    const entryPath = entry.path ?? "";
    const ext = path.extname(entryPath).toLowerCase();

    if (!TRIAL_STATIC_ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(
        `ZIP に許可されていないファイル拡張子 (${ext || "なし"}) が含まれています。お試しファイルには静的ファイル（HTML/CSS/JS/画像/フォントなど）のみを含めてください。`,
      );
    }
  }
}

/**
 * ビュートのお試し用ZIPが「静的ファイルのみ」かを検証する（ホワイトリスト方式）
 * - 不正な拡張子が含まれている場合は Error を投げる
 */
export async function assertTrialZipHasOnlyStaticFiles(
  file: File,
): Promise<void> {
  const buffer = await fileToBuffer(file);
  await assertZipBufferHasOnlyStaticFiles(buffer);
}

/**
 * ZIP を R2 にアップロードして公開 URL を返す
 * - folder: 任意のプレフィックス (例: "bewtopia/apps/files")
 */
export async function uploadZipToR2(
  file: File,
  folder: string,
): Promise<{ url: string; bytes: number; key: string }> {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET is not configured");

  const buffer = await fileToBuffer(file);
  const keySafeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

  // sanitize folder: trim slashes and remove leading bucket name if present
  let sanitizedFolder = folder.replace(/(^|\/)\/+|\/$/g, "");
  if (sanitizedFolder.startsWith(`${bucket}/`)) {
    sanitizedFolder = sanitizedFolder.slice(bucket.length + 1);
  }
  const keyPrefix = sanitizedFolder ? `${sanitizedFolder}/` : "";
  const key = `${keyPrefix}${Date.now()}_${nanoid(8)}_${keySafeName}`;

  const client = getS3Client();
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type || "application/zip",
        // optionally set ACL or metadata if needed
      }),
    );
  } catch (err) {
    console.error("R2 upload failed:", err);
    const maybeErr = err as unknown;
    let code: string | undefined;
    if (
      typeof maybeErr === "object" &&
      maybeErr !== null &&
      "code" in maybeErr
    ) {
      code = String((maybeErr as { code?: unknown }).code ?? undefined);
    } else {
      code = (err as Error).name || "UNKNOWN";
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`R2 upload failed (${code}): ${msg}`);
  }

  // 公開 URL を組み立てる (優先: NEXT_PUBLIC_R2_PUBLIC_URL を使用)
  const publicBase =
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
    `${process.env.R2_ENDPOINT}/${bucket}`;
  const url = `${publicBase.replace(/\/$/, "")}/${encodeURIComponent(key)}`;

  return { url, bytes: buffer.length, key };
}

/**
 * キーから公開 URL を組み立てる（configが揃っていれば使用）
 */
export function publicUrlForKey(key: string) {
  const bucket = process.env.R2_BUCKET;
  const publicBase =
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
    (bucket ? `${process.env.R2_ENDPOINT}/${bucket}` : undefined);
  if (!publicBase) return null;
  return `${publicBase.replace(/\/$/, "")}/${encodeURIComponent(key)}`;
}
/**
 * R2 から Object を取得して返す
 */
export async function getObjectFromR2(key: string) {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET is not configured");

  const client = getS3Client();
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const res = await client.send(cmd);
  return res;
}
