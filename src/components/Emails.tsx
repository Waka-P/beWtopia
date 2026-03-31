import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface EmailProps {
  name: string;
  actionUrl: string;
}

interface ChangeEmailConfirmationProps extends EmailProps {
  newEmail: string;
}

export function ResetPasswordEmail({ name, actionUrl }: EmailProps) {
  return (
    <Html>
      <Head />
      <Preview>パスワードリセットのご案内</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* ロゴセクション */}
          <Section style={logoSection}>
            <Img
              src={process.env.BEWTOPIA_LOGO_URL}
              width="2072"
              height="494"
              alt="beWtopia Logo"
              style={logo}
            />
          </Section>

          {/* メインコンテンツ */}
          <Section style={content}>
            <Heading style={heading}>{name}さん、こんにちは！</Heading>

            <Text style={paragraph}>
              パスワードリセットのご案内です。
              <br />
              以下のボタンをクリックして、パスワードの再設定を行なってください。
              <br />
            </Text>

            {/* ボタン */}
            <Section style={buttonContainer}>
              <Button style={button} href={actionUrl}>
                パスワードをリセット
              </Button>
            </Section>

            <Text style={paragraph}>
              ※有効期限は1時間です。
              <br />
              ※本メールに心当たりがない場合は、ボタンをクリックせず破棄してください。
            </Text>

            <Text style={paragraph}>
              ご不明な点がございましたら、
              <Link href="mailto:bewtopia.dev@gmail.com">
                bewtopia.dev@gmail.com
              </Link>
              までお気軽にお問い合わせください。
            </Text>

            <Text style={paragraph}>
              よろしくお願いいたします。
              <br />
              beWtopiaサポートチーム
            </Text>
          </Section>

          {/* フッター */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} beWtopia. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function VerifyEmail({ name, actionUrl }: EmailProps) {
  return (
    <Html>
      <Head />
      <Preview>ようこそ、{name}さん！</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* ロゴセクション */}
          <Section style={logoSection}>
            <Img
              src={process.env.BEWTOPIA_LOGO_URL}
              width="2072"
              height="494"
              alt="beWtopia Logo"
              style={logo}
            />
          </Section>

          {/* メインコンテンツ */}
          <Section style={content}>
            <Heading style={heading}>ようこそ、{name}さん！</Heading>

            <Text style={paragraph}>
              アカウントの作成ありがとうございます！
              以下のボタンをクリックして、メールアドレスを認証してください。
            </Text>

            {/* ボタン */}
            <Section style={buttonContainer}>
              <Button style={button} href={actionUrl}>
                始める
              </Button>
            </Section>

            <Text style={paragraph}>
              ※有効期限は24時間です。
              <br />
              ※本メールに心当たりがない場合は、ボタンをクリックせず破棄してください。
            </Text>

            <Text style={paragraph}>
              ご不明な点がございましたら、
              <Link href="mailto:bewtopia.dev@gmail.com">
                bewtopia.dev@gmail.com
              </Link>
              までお気軽にお問い合わせください。
            </Text>

            <Text style={paragraph}>
              よろしくお願いいたします。
              <br />
              beWtopiaサポートチーム
            </Text>
          </Section>

          {/* フッター */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} beWtopia. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function ChangeEmail({
  name,
  newEmail,
  actionUrl,
}: ChangeEmailConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>メールアドレス変更の確認</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* ロゴセクション */}
          <Section style={logoSection}>
            <Img
              src={process.env.BEWTOPIA_LOGO_URL}
              width="2072"
              height="494"
              alt="beWtopia Logo"
              style={logo}
            />
          </Section>

          {/* メインコンテンツ */}
          <Section style={content}>
            <Heading style={heading}>こんにちは、{name}さん！</Heading>

            <Text style={paragraph}>
              メールアドレスの変更リクエストを受け付けました。
              以下のボタンをクリックして、新しいメールアドレス（{newEmail}
              ）に変更することを確認してください。
            </Text>

            {/* ボタン */}
            <Section style={buttonContainer}>
              <Button style={button} href={actionUrl}>
                メールアドレスを確認する
              </Button>
            </Section>

            <Text style={paragraph}>
              ご不明な点がございましたら、
              <Link href="mailto:bewtopia.dev@gmail.com">
                bewtopia.dev@gmail.com
              </Link>
              までお気軽にお問い合わせください。
            </Text>

            <Text style={paragraph}>
              よろしくお願いいたします。
              <br />
              beWtopiaサポートチーム
            </Text>
          </Section>

          {/* フッター */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} beWtopia. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function ChangeEmailConfirm({ name, actionUrl }: EmailProps) {
  return (
    <Html>
      <Head />
      <Preview>メールアドレス変更の確認</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* ロゴセクション */}
          <Section style={logoSection}>
            <Img
              src={process.env.BEWTOPIA_LOGO_URL}
              width="2072"
              height="494"
              alt="beWtopia Logo"
              style={logo}
            />
          </Section>

          {/* メインコンテンツ */}
          <Section style={content}>
            <Heading style={heading}>こんにちは、{name}さん！</Heading>

            <Text style={paragraph}>
              メールアドレスの変更リクエストを受け付けました。
              以下のボタンをクリックして、このメールアドレスに変更することを確認してください。
            </Text>

            {/* ボタン */}
            <Section style={buttonContainer}>
              <Button style={button} href={actionUrl}>
                メールアドレスを確認する
              </Button>
            </Section>

            <Text style={paragraph}>
              ※有効期限は24時間です。
              <br />
              ※本メールに心当たりがない場合は、ボタンをクリックせず破棄してください。
            </Text>

            <Text style={paragraph}>
              ご不明な点がございましたら、
              <Link href="mailto:bewtopia.dev@gmail.com">
                bewtopia.dev@gmail.com
              </Link>
              までお気軽にお問い合わせください。
            </Text>

            <Text style={paragraph}>
              よろしくお願いいたします。
              <br />
              beWtopiaサポートチーム
            </Text>
          </Section>

          {/* フッター */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} beWtopia. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// スタイル定義(scssが使用できないため)
const main = {
  backgroundColor: "#00091Abc",
};

const container = {
  maxWidth: "600px",
  margin: "4rem auto",
  padding: "1.25rem 0",
  backgroundColor: "#00091A",
};

const logoSection = {
  padding: "1.25rem 2.5rem",
  textAlign: "center" as const,
};

const logo = {
  width: "400px",
  maxWidth: "100%",
  height: "auto",
  margin: "0 auto",
};

const content = {
  padding: "0 2.5rem",
};

const heading = {
  fontSize: "1.5rem",
  fontWeight: "bold",
  color: "#eee",
  marginBottom: "1rem",
};

const paragraph = {
  fontSize: "1rem",
  lineHeight: 1.5,
  color: "#aaa",
  marginBottom: "1.5rem",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "2rem 0",
};

const button = {
  display: "inline-block",
  padding: "0.75rem 2rem",
  background:
    "linear-gradient(135deg, #00ffff 5%, #14c8ee 50%, #0b8de3 85%, #0251d8 100%)",
  borderRadius: "9999px",
  color: "#fff",
  textAlign: "center" as const,
  textDecoration: "none",
  fontWeight: "bold",
  fontSize: "1.1rem",
};

const footer = {
  marginTop: "2rem",
  padding: "1.25rem 2.5rem",
  borderTop: "1px solid #aaa",
};

const footerText = {
  margin: "0.5rem 0",
  fontSize: "0.875rem",
  color: "#888",
  textAlign: "center" as const,
};
