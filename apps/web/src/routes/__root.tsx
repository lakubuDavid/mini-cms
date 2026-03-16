import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";

import { env } from "@/lib/env";
import appCss from "@/styles/app.css?url";
import type { PostHogConfig } from "posthog-js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
});

const posthogKey = import.meta.env.PUBLIC_POSTHOG_KEY ?? "";
const posthogOptions : PostHogConfig = {
  //@ts-ignore the posthog povide won't be initialized if PUBLIC_POSTHOG_HOST is undefined so no need to care about this error
  api_host: import.meta.env.PUBLIC_POSTHOG_HOST,
} as const;
const isWebAnalyticsEnabled = env.PUBLIC_ENABLE_WEB_ANALYTICS === true;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Mini CMS",
      },
      {
        name: "description",
        content: "A minimalist self-hosted CMS for development agencies.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  component: () => <Outlet />,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const content = (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col">
        {isWebAnalyticsEnabled && posthogKey ? (
          <PostHogProvider apiKey={posthogKey} options={posthogOptions}>
            {content}
          </PostHogProvider>
        ) : (
          content
        )}
        <Scripts />
      </body>
    </html>
  );
}
