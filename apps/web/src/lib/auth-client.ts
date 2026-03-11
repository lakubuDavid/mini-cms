import { createAuthClient } from "better-auth/react";
import { apiKeyClient } from "@better-auth/api-key/client";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import {
  ac,
  adminRole,
  memberRole,
  ownerRole,
  reviewer,
} from "@/lib/permissions";
import { env } from "@/lib/env";

const publicAppUrl = import.meta.env.PUBLIC_APP_URL || env.PUBLIC_APP_URL;

export const authClient = createAuthClient({
  baseURL: publicAppUrl,
  plugins: [
    adminClient({
      ac,
      roles: {
        admin: adminRole,
        reviewer,
        user: memberRole,
      },
    }),
    organizationClient({
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
    }),
    apiKeyClient(),
  ],
});
