import { Resend } from "resend";
import { env } from "@/lib/env";

export const DEFAULT_FROM_EMAIL = "mini-cms@lakubudavid.me";

export const resend = new Resend(env.RESEND_API_KEY);

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string | string[];
  text?: string;
};

export async function sendEmail(input: SendEmailInput) {
  return resend.emails.send({
    from: input.from ?? DEFAULT_FROM_EMAIL,
    to: input.to,
    subject: input.subject,
    html: input.html,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    ...(input.text ? { text: input.text } : {}),
  });
}

export async function sendInviteEmail(input: {
  to: string;
  subject: string;
  html: string;
}) {
  return sendEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
