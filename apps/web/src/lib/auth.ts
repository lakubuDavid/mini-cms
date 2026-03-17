import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { admin, organization, testUtils } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendEmail, sendInviteEmail } from "@/lib/email";
import {
  inviteEmailTemplate,
  verificationEmailTemplate,
} from "@/lib/email/templates";
import { env } from "@/lib/env";
import {
  ac,
  adminRole,
  memberRole,
  ownerRole,
  reviewer,
} from "@/lib/permissions";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    usePlural: true,
    schema,
  }),
  secret: env.AUTH_SECRET,
  baseURL: env.APP_URL,
  emailAndPassword: {
    enabled: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    async sendVerificationEmail({ user, url }) {
      const template = verificationEmailTemplate({ verificationUrl: url });

      void sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
      });
    },
  },
  plugins: [
    tanstackStartCookies(),
    admin({
      ac,
      defaultRole: "admin",
      roles: {
        admin: adminRole,
        reviewer,
        user: memberRole,
      },
    }),
    organization({
      ac,
      roles: {
        admin: adminRole,
        owner: ownerRole,
        member: memberRole,
        reviewer,
      },
      teams: {
        enabled: false,
      },
      allowUserToCreateOrganization: true,
      async sendInvitationEmail(data) {
        const inviteUrl = `${env.APP_URL}/invite/${data.id}`;
        const template = inviteEmailTemplate({
          inviteUrl,
          email: data.email,
        });

        await sendInviteEmail({
          to: data.email,
          subject: template.subject,
          html: template.html,
        });
      },
    }),
    apiKey({
      references: "organization",
      defaultPrefix: "mcms_",
      requireName: true,
      enableMetadata: true,
      keyExpiration: {
        defaultExpiresIn: 60 * 60 * 24 * 30,
      },
    }),
    ...(process.env.ENABLE_TEST_UTILS === "true" ? [testUtils()] : []),
  ],
});
