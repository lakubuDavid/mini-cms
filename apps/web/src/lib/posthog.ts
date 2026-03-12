import { createHash } from "node:crypto";
import { PostHog } from "posthog-node";
import { env } from "@/lib/env";

let posthogClient: PostHog | null = null;

type Primitive = string | number | boolean | null;
type EventProperties = Record<string, Primitive | Primitive[] | undefined>;

type AnalyticsIdentity = {
  distinctId: string;
  organizationId?: string | null;
  projectId?: string | null;
};

type ErrorProperties = EventProperties & {
  area?: string;
  operation?: string;
};

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function anonymizeId(value: string | null | undefined, prefix: string) {
  if (!value) return undefined;
  return `${prefix}_${hashValue(value).slice(0, 16)}`;
}

export function anonymizeServerValue(
  value: string | null | undefined,
  prefix = "value",
) {
  return anonymizeId(value, prefix);
}

function sanitizeProperties(properties: EventProperties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  );
}

function buildGroups(identity?: Omit<AnalyticsIdentity, "distinctId">) {
  const organizationGroup = anonymizeId(identity?.organizationId, "org");
  const projectGroup = anonymizeId(identity?.projectId, "project");

  return sanitizeProperties({
    organization: organizationGroup,
    project: projectGroup,
  });
}

function isPosthogEnabled() {
  return Boolean(env.POSTHOG_KEY);
}

export function getServerClient() {
  if (posthogClient) return posthogClient;

  if (!isPosthogEnabled()) {
    return null;
  }

  posthogClient = new PostHog(env.POSTHOG_KEY!, {
    host: "https://eu.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });

  posthogClient.register({
    environment: process.env.NODE_ENV ?? "unknown",
    runtime: "server",
  });

  return posthogClient;
}

export function createAnonymousServerIdentity(input?: {
  subject?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
}): AnalyticsIdentity {
  const distinctId = anonymizeId(
    input?.subject
      ?? `${input?.organizationId ?? "unknown"}:${input?.projectId ?? "unknown"}`,
    "actor",
  )!;

  return {
    distinctId,
    organizationId: input?.organizationId,
    projectId: input?.projectId,
  };
}

export async function captureServerEvent(input: {
  event: string;
  identity: AnalyticsIdentity;
  properties?: EventProperties;
}) {
  const client = getServerClient();

  if (!client) {
    return;
  }

  try {
    await client.capture({
      distinctId: input.identity.distinctId,
      event: input.event,
      properties: {
        ...sanitizeProperties(input.properties),
        ...buildGroups(input.identity),
      },
    });
  } catch {
    // Best-effort analytics only.
  }
}

export async function captureServerError(input: {
  error: unknown;
  identity?: AnalyticsIdentity;
  properties?: ErrorProperties;
}) {
  const client = getServerClient();

  if (!client) {
    return;
  }

  const errorName = input.error instanceof Error ? input.error.name : "UnknownError";
  const errorMessage = input.error instanceof Error
    ? input.error.message
    : typeof input.error === "string"
      ? input.error
      : "Unexpected error";

  try {
    await client.capture({
      distinctId:
        input.identity?.distinctId
        ?? createAnonymousServerIdentity({ subject: "server-error" }).distinctId,
      event: "server_error",
      properties: {
        ...sanitizeProperties(input.properties),
        ...buildGroups(input.identity),
        error_name: errorName,
        error_message: errorMessage,
      },
    });
  } catch {
    // Best-effort analytics only.
  }
}
