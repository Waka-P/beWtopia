export async function fetcher<JSON = unknown>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<JSON> {
  const isFormData = init?.body instanceof FormData;
  const headers = new Headers(init?.headers);

  if (isFormData) {
    // FormDataの場合はContent-Typeを削除（ブラウザがboundary付きで自動設定するため）
    headers.delete("Content-Type");
  } else if (!headers.has("Content-Type")) {
    // FormData以外でContent-Typeが設定されていない場合はJSONとする
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(input, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}${res.statusText ? `: ${res.statusText}` : ""}`;
    let body: unknown = null;

    // 可能ならJSONエラーメッセージを優先
    try {
      const json = await res.clone().json();
      body = json;
      if (json && typeof json === "object" && "error" in json) {
        const errMsg = (json as { error?: unknown }).error;
        if (typeof errMsg === "string" && errMsg.trim().length > 0) {
          message = errMsg;
        }
      }
    } catch {
      // JSONでなければテキスト本文をメッセージに使う
      try {
        const text = await res.text();
        if (text.trim().length > 0) {
          message = text;
          body = text;
        }
      } catch {
        // 何も取れなければステータスベースのメッセージのまま
      }
    }

    const error = new Error(message) as Error & {
      status?: number;
      body?: unknown;
    };
    error.status = res.status;
    error.body = body;
    throw error;
  }

  return res.json();
}
