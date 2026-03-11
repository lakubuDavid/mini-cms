import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { DocsNavAuthLinks } from "@/components/docs-nav-auth-links";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "Mini CMS Docs",
    },
    links: [
      {
        type: "custom",
        children: <DocsNavAuthLinks />,
        on: "all",
      },
    ],
  };
}
