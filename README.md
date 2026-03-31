This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## clone した後やること・注意点
### やること
・拡張機能([Biome](https://marketplace.visualstudio.com/items?itemName=biomejs.biome))をインストール  
・```docker volume create bewtopia-data```を実行  
・```rm -rf node_modules```を実行(node_modulesが存在する場合)
### 注意点
・docker composeでコンテナに入った後、毎回必ず```pnpm run setup```を実行する

<br><br><br>
## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
DIRECT_URL=mysql://root:root@db:3306/bewtopia
DATABASE_URL=mysql://root:root@db:3306/bewtopia
DATABASE_HOST=db
DATABASE_USER=root
DATABASE_PASSWORD=root
DATABASE_NAME=bewtopia
BETTER_AUTH_SECRET=後述
BETTER_AUTH_URL=http://localhost:3000
GIT_USER_NAME=自分のGitHubユーザ名
GIT_USER_EMAIL=GitHubに登録してある自分のメールアドレス
RESEND_API_KEY=*******
EMAIL_SENDER_NAME=beWtopia
EMAIL_SENDER_ADDRESS=noreply@bewtopia.com
BEWTOPIA_LOGO_URL=https://res.cloudinary.com/daw7pt5sj/image/upload/v1766583044/beWtopia_fzx7vp.png
NEXT_PUBLIC_GOOGLE_CLIENT_ID=*******
GOOGLE_CLIENT_SECRET=*******
FACEBOOK_CLIENT_ID=*******
FACEBOOK_CLIENT_SECRET=*******
```
(BETTER_AUTH_SECRETには、[ここ](https://www.better-auth.com/docs/installation)でGenerate Secretボタンを押して出てきた値を記述する)<br><br>
4. インストールした拡張機能Dev Containersで「コンテナーで再度開く」を選択する  
5. ターミナルで```docker compose exec app bash```を実行してコンテナに入り、コンテナ内で以下を実行
```
pnpm prisma migrate deploy  
pnpm prisma generate
pnpm prisma db seed #シード値を生成する場合
```  
6. ```pnpm dev```でサーバを起動
### 注意点
- コミット前に```pnpm format```を実行
- Dev Containersでなんか上手くいかないという時は、「コンテナーのリビルド」を試す
- 現在の構成ではDev Containers内でgit add/commitはできるが、pushはできない(他のコマンドは未検証)