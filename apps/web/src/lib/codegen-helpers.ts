import { createServerFn } from "@tanstack/react-start";
import {
  generateClientSource,
  generateDeclarationsSource,
  generateTypesSource,
} from "@lakubudavid/mini-cli/codegen-core";
import { env } from "@/lib/env";

export type ApiAccess = {
  type: "public" | "restricted" | "none";
  allowedDomains?: string[];
};

export type CollectionSnippets = {
  collection: { id: string; name: string; slug: string };
  workspaceId: string;
  projectId: string;
  baseUrl: string;
  apiAccess: ApiAccess;
  snippets: {
    /** Dependency-free fetch call against the public items endpoint. */
    fetch: string;
    /** Generated TypeScript types for this collection. */
    types: string;
    /** Full generated client, same output as `mini-cms generate`. */
    client: string;
    /** Type declarations that accompany the client. */
    declarations: string;
    /** CLI commands that produce the same files on disk. */
    cli: string;
  };
};

/**
 * Builds the copy-paste snippets shown in the dashboard.
 *
 * The client and type snippets come from the same generator the CLI uses, so
 * the dashboard can never drift from `mini-cms generate`. The fetch snippet is
 * presentation-only and mirrors the public items endpoint.
 */
export const getCollectionSnippetsServerFn = createServerFn({ method: "GET" })
  .validator((data: { slug: string; projectId: string }) => data)
  .handler(async ({ data, ...ctx }): Promise<CollectionSnippets> => {
    const { getActiveProjectContext } = await import("./project-access");
    const { getCollectionBySlug } = await import("../db/queries/collections");
    const { getProjectById } = await import("../db/queries/projects");

    const { organizationId, access } = await getActiveProjectContext(ctx);

    if (!access.all && !access.projectIds.includes(data.projectId)) {
      throw new Error("Project not found in this workspace.");
    }

    const project = await getProjectById(data.projectId, organizationId, access);
    if (!project) {
      throw new Error("Project not found in this workspace.");
    }

    const collection = await getCollectionBySlug(
      data.slug,
      organizationId,
      data.projectId,
    );
    if (!collection) {
      throw new Error("Collection not found in this workspace.");
    }

    const baseUrl = env.PUBLIC_APP_URL.replace(/\/$/, "");
    const target = {
      baseUrl,
      workspaceId: organizationId,
      projectId: data.projectId,
    };
    const synced = [
      {
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
        description: collection.description ?? null,
        schema: collection.schema,
      },
    ];

    return {
      collection: {
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
      },
      workspaceId: organizationId,
      projectId: data.projectId,
      baseUrl,
      apiAccess: (project.apiAccess ?? { type: "public" }) as ApiAccess,
      snippets: {
        fetch: buildFetchSnippet({
          baseUrl,
          workspaceId: organizationId,
          projectId: data.projectId,
          slug: collection.slug,
        }),
        types: generateTypesSource(synced, organizationId),
        client: generateClientSource(target, synced),
        declarations: generateDeclarationsSource(target, synced),
        cli: buildCliSnippet({
          workspaceId: organizationId,
          projectId: data.projectId,
        }),
      },
    };
  });

function buildFetchSnippet(input: {
  baseUrl: string;
  workspaceId: string;
  projectId: string;
  slug: string;
}) {
  const url = new URL("/api/collections/items", `${input.baseUrl}/`);
  url.searchParams.set("w", input.workspaceId);
  url.searchParams.set("p", input.projectId);
  url.searchParams.set("collection_slug", input.slug);
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", "10");

  return [
    `const response = await fetch(`,
    `  ${JSON.stringify(url.toString())},`,
    `);`,
    ``,
    `if (!response.ok) {`,
    `  throw new Error(\`Request failed: \${response.status}\`);`,
    `}`,
    ``,
    `const { items, pagination } = await response.json();`,
    ``,
    `console.log(items, pagination.total);`,
    ``,
  ].join("\n");
}

function buildCliSnippet(input: {
  workspaceId: string;
  projectId: string;
}) {
  return [
    `# Fetch schemas and generate types + client locally`,
    `mini-cms pull \\`,
    `  --workspace-id ${input.workspaceId} \\`,
    `  --project-id ${input.projectId}`,
    ``,
    `mini-cms generate`,
    ``,
  ].join("\n");
}
