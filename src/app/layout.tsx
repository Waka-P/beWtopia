import SplashScreen from "@/components/SplashScreen";
import "destyle.css";
import type { Metadata } from "next";
import { Zen_Kaku_Gothic_New } from "next/font/google";
import { headers } from "next/headers";
import "./globals.scss";

const zenKakuGothicNew = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-zen-kaku-gothic-new",
});

export const metadata: Metadata = {
  title: {
    template: "beWtopia | %s",
    default: 'beWtopia | 一人の想いが、みんなの"ほしい"になる',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const referer = headerStore.get("referer") ?? "";
  const host = headerStore.get("host") ?? "";
  const pathname = headerStore.get("x-pathname") ?? "";

  // referer が空 or 自サイト以外 → 外部からの遷移
  const showSplash =
    (!referer || !referer.includes(host)) &&
    !pathname.includes("/unsupported-device");

  return (
    <html lang="ja">
      <body data-gptw="" className={zenKakuGothicNew.className}>
        <SplashScreen show={showSplash} />
        <main>{children}</main>
      </body>
    </html>
  );
}
