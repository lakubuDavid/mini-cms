import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function DocsNavAuthLinks() {
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    authClient.getSession().then((result) => {
      setStatus(result.data?.user ? "authenticated" : "unauthenticated");
    }).catch(() => {
      setStatus("unauthenticated");
    });
  }, []);

  if (status === "loading") {
    return null;
  }

  if (status === "authenticated") {
    return (
      <a
        href="/dashboard"
        className="rounded-full bg-stone-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
      >
        Dashboard
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href="/login"
        className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-medium transition hover:border-stone-900 hover:text-stone-900 dark:border-stone-700 dark:text-stone-300 dark:hover:border-stone-400 dark:hover:text-white"
      >
        Sign in
      </a>
      <a
        href="/signup"
        className="rounded-full bg-stone-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
      >
        Sign up
      </a>
    </div>
  );
}
