import { auth } from "@/lib/auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type RouteConfig = {
  allowedReferer: string;
  redirectWithSession: string;
  redirectWithoutSession: string;
};

const PROTECTED_ROUTES: Record<string, RouteConfig> = {
  "/signup/success": {
    allowedReferer: "/signup",
    redirectWithSession: "/",
    redirectWithoutSession: "/signup",
  },
  "/reset-password/success": {
    allowedReferer: "/reset-password",
    redirectWithSession: "/",
    redirectWithoutSession: "/login",
  },
  "/forgot-password/success": {
    allowedReferer: "/forgot-password",
    redirectWithSession: "/",
    redirectWithoutSession: "/forgot-password",
  },
};

export async function proxy(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-pathname", req.nextUrl.pathname);

  const isMobile = /iPhone|Android|Mobile|iPad|iPod/i.test(ua);
  const url = req.nextUrl.clone();

  if (url.pathname.startsWith("/unsupported-device")) {
    if (!isMobile) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next({
      request: {
        headers: reqHeaders,
      },
    });
  }

  if (isMobile) {
    url.pathname = "/unsupported-device";
    return NextResponse.redirect(url);
  }

  const path = req.nextUrl.pathname;
  const routeConfig = PROTECTED_ROUTES[path];

  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
  if (routeConfig) {
    try {
      session = await auth.api.getSession({ headers: req.headers });
    } catch {
      session = null;
    }
  }

  // トークン期限切れの場合のリダイレクト処理
  if (path === "/") {
    const error = req.nextUrl.searchParams.get("error");
    if (error === "token_expired") {
      return NextResponse.redirect(new URL("/signup/token-expired", req.url));
    }
  }

  // 保護されたルートのチェック
  if (routeConfig) {
    const referer = req.headers.get("referer");
    const isValidReferer = referer?.includes(routeConfig.allowedReferer);

    if (!isValidReferer) {
      const redirectPath = session
        ? routeConfig.redirectWithSession
        : routeConfig.redirectWithoutSession;
      return NextResponse.redirect(new URL(redirectPath, req.url));
    }
  }

  return NextResponse.next({
    request: {
      headers: reqHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/",
    "/signup/success",
    "/signup/token-expired",
    "/reset-password/success",
    "/forgot-password/success",
    "/((?!api|_next/static|_next/image|.*\\.png$).*)",
  ],
};
