import { auth } from "@/lib/auth";
import { uploadImage } from "@/lib/cloudinary";
import { assertTrialZipHasOnlyStaticFiles, uploadZipToR2 } from "@/lib/r2";
import { type NextRequest, NextResponse } from "next/server";

// お試し機能が正常に動作することを想定した最大ZIPサイズ（例: 50MB）
const MAX_TRIAL_ZIP_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    // ユーザー認証チェック
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string; // "image" or "zip"
    const folder = formData.get("folder") as string;

    if (!file) {
      return NextResponse.json(
        { error: "ファイルが指定されていません" },
        { status: 400 },
      );
    }

    let url: string;
    let bytes = file.size;

    let key: string | undefined;

    // ビュートのお試しファイル（apps/trial-files 配下）に対しては、
    // ファイルサイズとZIPの中身（静的ファイルのみ）を検証する
    if (
      type === "zip" &&
      typeof folder === "string" &&
      folder.startsWith("apps/trial-files")
    ) {
      // サイズ制限
      if (file.size > MAX_TRIAL_ZIP_BYTES) {
        return NextResponse.json(
          {
            error:
              "お試しファイルのサイズが大きすぎます。50MB以下のZIPファイルをアップロードしてください。",
          },
          { status: 400 },
        );
      }

      // 中身の拡張子ホワイトリスト検証
      try {
        await assertTrialZipHasOnlyStaticFiles(file);
      } catch (err) {
        console.error("Trial ZIP validation error:", err);
        return NextResponse.json(
          {
            error:
              "静的ファイル（HTML/CSS/JS/画像/フォントなど）のみを含むZIPをアップロードしてください。",
          },
          { status: 400 },
        );
      }
    }

    if (type === "zip") {
      const result = await uploadZipToR2(file, folder);
      url = result.url;
      bytes = result.bytes;
      key = result.key;
    } else {
      url = await uploadImage(file, folder);
    }

    return NextResponse.json({ url, bytes, key });
  } catch (error) {
    console.error("アップロードエラー:", error);
    return NextResponse.json(
      { error: "ファイルのアップロードに失敗しました" },
      { status: 500 },
    );
  }
}
