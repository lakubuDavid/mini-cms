import { loader } from "fumadocs-core/source";
import type { Folder, Node, Root } from "fumadocs-core/page-tree";
import { docs } from "fumadocs-mdx:collections/server";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  pageTree: {
    transformers: [
      {
        root(node) {
          return groupDocsTree(node);
        },
      },
    ],
  },
});

const contentUrls = new Set(["/docs/dashboard"]);
const developerUrls = new Set([
  "/docs/api",
  "/docs/cli",
  "/docs/environment",
  "/docs/hosting",
]);

function groupDocsTree(root: Root): Root {
  const intro: Node[] = [];
  const content: Node[] = [];
  const developer: Node[] = [];
  const remaining: Node[] = [];

  for (const child of root.children) {
    if (hasUrl(child, "/docs")) {
      intro.push(child);
      continue;
    }

    if (matchesAnyUrl(child, contentUrls)) {
      content.push(child);
      continue;
    }

    if (matchesAnyUrl(child, developerUrls)) {
      developer.push(child);
      continue;
    }

    remaining.push(child);
  }

  return {
    ...root,
    children: [
      ...intro,
      ...(content.length
        ? [createGroupFolder("content", "Content", content)]
        : []),
      ...(developer.length
        ? [createGroupFolder("developer", "Developer", developer)]
        : []),
      ...remaining,
    ],
  };
}

function createGroupFolder(id: string, name: string, children: Node[]): Folder {
  return {
    $id: `group-${id}`,
    type: "folder",
    name,
    defaultOpen: true,
    collapsible: true,
    children,
  };
}

function matchesAnyUrl(node: Node, urls: Set<string>) {
  for (const url of urls) {
    if (hasUrl(node, url)) {
      return true;
    }
  }

  return false;
}

function hasUrl(node: Node, url: string): boolean {
  if (node.type === "page") {
    return node.url === url;
  }

  if (node.type === "separator") {
    return false;
  }

  if (node.index?.url === url) {
    return true;
  }

  return node.children.some((child) => hasUrl(child, url));
}
