# beWtopia

「一人の想いが、みんなの"ほしい"になる。」
WebアプリのC2Cプラットフォームです。

## Overview
- Next.js App Router を基盤にしたフルスタック構成
- Prisma + MySQL でデータ管理
- 認証は Better Auth、決済は Stripe、メール送信は Resend を利用
- 画像は Cloudinary を想定し、リッチなコンテンツ制作に対応

## Main Features
- アプリ/テンプレートの公開、検索、タグ付け、レビュー
- カート、購入履歴、サブスク型のチェックアウト
- ユーザー認証 (OAuth: Google / Facebook)
- チャット、通知、リクエストなどのコミュニケーション機能
- ビュート(出品)/ビューズ(共同出品)
- Tiptap + Yjs を活用したリッチテキスト共同編集

## Tech Stack
- Frontend: Next.js 16, React 19, TypeScript, Sass
- Backend: Next.js Route Handlers, Prisma 7, MySQL
- Auth: Better Auth
- Payment: Stripe
- Media: Cloudinary
- Email: Resend
- Editor/Realtime: Tiptap, Yjs
- Tooling: Biome, pnpm

## Project Structure
```
src/
  app/                # App Router routes, layouts, and route handlers
  components/         # UI components
  lib/                # Auth, Prisma, Stripe, Cloudinary utilities
  utils/              # Helper functions
prisma/               # Prisma schema and migrations
public/               # Static assets
```

## Local Setup
### 1) Environment
```bash
devbox shell
devbox services start
```

### 2) Install & Migrate
```bash
pnpm app:setup
```

### 3) Run
```bash
pnpm dev
```

共同編集可能なメモ用のWebSocketjサーバはこちらで起動します。
```bash
CALLBACK_URL='http://localhost:3000/api/bewts/memo/callback' CALLBACK_OBJECTS='{"prosemirror":"XmlFragment"}' CALLBACK_SECRET='ecd8d0f890ddf59de26f21b067eadfda3f0295452d79c0a66b5d898d62e8cc0f' pnpm exec y-websocket
```

## Environment Variables
以下は .env の例です。値は環境に合わせて設定してください。
```
DIRECT_URL=mysql://root:@localhost:3306/bewtopia
DATABASE_URL=mysql://root:@localhost:3306/bewtopia
DATABASE_HOST=localhost
DATABASE_USER=root
DATABASE_NAME=bewtopia
BETTER_AUTH_SECRET=***
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
RESEND_API_KEY=***
EMAIL_SENDER_NAME=***
EMAIL_SENDER_ADDRESS=***
BEWTOPIA_LOGO_URL=***
NEXT_PUBLIC_GOOGLE_CLIENT_ID=***
GOOGLE_CLIENT_SECRET=***
FACEBOOK_CLIENT_ID=***
FACEBOOK_CLIENT_SECRET=***
CLOUDINARY_CLOUD_NAME=***
CLOUDINARY_API_KEY=***
CLOUDINARY_API_SECRET=***
CLOUDINARY_URL=***
CLOUDINARY_API_PROXY=***
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=***
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=***
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=***
STRIPE_SECRET_KEY=***
STRIPE_WEBHOOK_SECRET=***
R2_ENDPOINT=***
R2_BUCKET=***
R2_ACCESS_KEY_ID=***
R2_SECRET_ACCESS_KEY=***
```

## Useful Scripts
- pnpm dev: 開発サーバ起動
- pnpm build: 本番ビルド
- pnpm start: 本番サーバ起動
- pnpm app:setup: 依存関係インストール + Prisma migrate/generate
- pnpm seed: シード投入
- pnpm format / pnpm lint / pnpm check: Biome 実行

## Notes
- Prisma Client は src/generated/prisma に生成されます。
- 画像ドメインは next.config.ts の remotePatterns で許可しています。
