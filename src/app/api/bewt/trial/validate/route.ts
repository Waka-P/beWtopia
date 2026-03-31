import { auth } from "@/lib/auth";
import { assertTrialZipHasOnlyStaticFiles } from "@/lib/r2";
import { type NextRequest, NextResponse } from "next/server";

// ビュートのお試し機能用ZIPの最大サイズ（50MB）
const MAX_TRIAL_ZIP_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "ファイルが指定されていません" },
        { status: 400 },
      );
    }

    if (file.size > MAX_TRIAL_ZIP_BYTES) {
      return NextResponse.json(
        {
          error:
            "お試しファイルのサイズが大きすぎます。50MB以下のZIPファイルをアップロードしてください。",
        },
        { status: 400 },
      );
    }

    try {
      await assertTrialZipHasOnlyStaticFiles(file);
    } catch (err) {
      console.error("Trial ZIP validate-only error:", err);
      return NextResponse.json(
        {
          error:
            "静的ファイル（HTML/CSS/JS/画像/フォントなど）のみを含むZIPをアップロードしてください。",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Trial ZIP validate-only API error:", error);
    return NextResponse.json(
      { error: "お試しファイルの検証中にエラーが発生しました" },
      { status: 500 },
    );
  }
}
