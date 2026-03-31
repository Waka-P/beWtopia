import type { JSX } from "react";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_SENDER = `${process.env.EMAIL_SENDER_NAME} <${process.env.EMAIL_SENDER_ADDRESS}>`;
export const sendEmail = async ({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: JSX.Element;
}) => {
  return await resend.emails.send({
    from: EMAIL_SENDER,
    to,
    subject,
    react,
  });
};
