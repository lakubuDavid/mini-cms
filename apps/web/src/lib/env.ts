import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const runtimeEnv = {
  ...process.env,
  ...import.meta.env,
};

export const env = createEnv({
  clientPrefix: "PUBLIC_",
  client: {
    PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    PUBLIC_ENABLE_WEB_ANALYTICS: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    PUBLIC_HIDE_HOME: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    PUBLIC_POSTHOG_KEY: z.string().optional(),
    PUBLIC_POSTHOG_HOST: z.string().optional(),
  },
  server: {
    AUTH_SECRET: z.string().min(1),
    DEMO_MAX_COLLECTIONS_PER_PROJECT: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    DEMO_MAX_ITEMS_PER_COLLECTION: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    DEMO_MAX_PROJECTS_PER_WORKSPACE: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    DEMO_MAX_WORKSPACES_PER_USER: z.coerce.number().int().positive().optional(),
    KV_REST_API_TOKEN: z.string().min(1).optional(),
    KV_REST_API_URL: z.string().url().optional(),
    RESEND_API_KEY: z.string().min(1),
    TURSO_AUTH_TOKEN: z.string().min(1),
    TURSO_DB_URL: z.string().min(1),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  },
  shared: {
    APP_URL: z.string().url().default("http://localhost:3000"),
    DOCS_URL: z.string().url().default("http://localhost:3001/docs"),
    POSTHOG_KEY: z.string().optional(),
  },
  runtimeEnv,
  emptyStringAsUndefined: true,
});
