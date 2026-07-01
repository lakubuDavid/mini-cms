import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  Link,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";
import { ThemeProvider } from "next-themes";


import { TooltipProvider } from "@workspace/ui/components/tooltip"

import { env } from "@/lib/env";
import appCss from "@/styles/app.css?url";
import type { PostHogConfig } from "posthog-js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60_000, // 2 minutes — individual queries override as needed
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
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
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
        404
      </h1>
      <p className="max-w-md text-sm text-stone-500">
        Page not found. The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
      >
        Go home
      </Link>
    </div>
  ),
  shellComponent: RootDocument,
  component: () => <Outlet />,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const content = (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col">
        <TooltipProvider>
        {isWebAnalyticsEnabled && posthogKey ? (
          <PostHogProvider apiKey={posthogKey} options={posthogOptions}>
            {content}
          </PostHogProvider>
        ) : (
          content
        )}
        </TooltipProvider>
        <Scripts />
      </body>
    </html>
  );
}
