import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { collectionSnippetsQueryOptions } from "@/lib/queries";
import { CopyButton } from "@/components/copy-button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ArrowLeft, Lock, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/dashboard/collections/$name/code")({
  validateSearch: (search: Record<string, unknown>) => ({
    projectId:
      typeof search.projectId === "string" && search.projectId.length > 0
        ? search.projectId
        : undefined,
  }),
  component: CollectionCodePage,
});

const SNIPPET_TABS = [
  { id: "fetch", label: "Fetch", hint: "No dependencies. Copy into any app." },
  { id: "types", label: "Types", hint: "TypeScript types for this collection." },
  {
    id: "client",
    label: "Client",
    hint: "Same output as `mini-cms generate`.",
  },
  {
    id: "cli",
    label: "CLI",
    hint: "Generate the files locally instead.",
  },
] as const;

type SnippetTab = (typeof SNIPPET_TABS)[number]["id"];

function CollectionCodePage() {
  const { name } = Route.useParams();
  const search = Route.useSearch();
  const [tab, setTab] = useState<SnippetTab>("fetch");

  const snippetsQuery = useQuery(
    collectionSnippetsQueryOptions(name, search.projectId ?? ""),
  );

  if (!search.projectId) {
    return (
      <section className="space-y-6">
        <BackLink name={name} projectId={undefined} />
        <p className="text-sm text-stone-500">
          Select a project to see code snippets for this collection.
        </p>
      </section>
    );
  }

  if (snippetsQuery.isLoading) {
    return <CodePageSkeleton />;
  }

  if (!snippetsQuery.data) {
    return (
      <section className="space-y-6">
        <BackLink name={name} projectId={search.projectId} />
        <p className="text-sm text-stone-500">Collection not found.</p>
      </section>
    );
  }

  const data = snippetsQuery.data;
  const activeTab =
    SNIPPET_TABS.find((candidate) => candidate.id === tab) ?? SNIPPET_TABS[0];
  const snippet = data.snippets[activeTab.id];
  const isRestricted = data.apiAccess.type !== "public";

  return (
    <section className="space-y-6">
      <BackLink name={data.collection.name} projectId={search.projectId} />

      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Use {data.collection.name} in your app
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Read items from this collection over the public API. The generated
          client matches what{" "}
          <code className="rounded bg-stone-100 px-1 text-xs">mini-cms generate</code>{" "}
          writes to disk.
        </p>
      </div>

      {isRestricted ? (
        <ApiAccessNotice apiAccess={data.apiAccess} />
      ) : null}

      <div className="overflow-hidden rounded-lg border border-stone-200">
        <div className="flex flex-wrap gap-1 border-b border-stone-200 bg-stone-50 p-2">
          {SNIPPET_TABS.map((candidate) => {
            const isActive = candidate.id === activeTab.id;
            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => setTab(candidate.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                }`}
              >
                {candidate.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm text-stone-500">{activeTab.hint}</p>
            <CopyButton value={snippet} label={`Copy ${activeTab.label}`} />
          </div>
          <div className="overflow-hidden rounded-lg border border-stone-200">
            <CodeMirror
              value={snippet}
              readOnly
              theme="dark"
              extensions={
                activeTab.id === "cli"
                  ? []
                  : [javascript({ typescript: activeTab.id === "types" || activeTab.id === "client" })]
              }
              maxHeight="480px"
              basicSetup={{
                lineNumbers: true,
                highlightActiveLine: false,
                foldGutter: false,
                autocompletion: false,
              }}
              className="text-xs"
            />
          </div>
        </div>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200 px-4 py-3">
          <dt className="text-xs uppercase tracking-wider text-stone-500">
            Workspace
          </dt>
          <dd className="mt-1 flex items-center gap-1.5">
            <code className="truncate font-mono text-xs text-stone-700">
              {data.workspaceId}
            </code>
            <CopyButton value={data.workspaceId} label="" />
          </dd>
        </div>
        <div className="rounded-lg border border-stone-200 px-4 py-3">
          <dt className="text-xs uppercase tracking-wider text-stone-500">
            Project
          </dt>
          <dd className="mt-1 flex items-center gap-1.5">
            <code className="truncate font-mono text-xs text-stone-700">
              {data.projectId}
            </code>
            <CopyButton value={data.projectId} label="" />
          </dd>
        </div>
      </dl>
    </section>
  );
}

function ApiAccessNotice(props: { apiAccess: { type: string; allowedDomains?: string[] } }) {
  const isDisabled = props.apiAccess.type === "none";
  const domains = props.apiAccess.allowedDomains ?? [];

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
      {isDisabled ? (
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div className="space-y-1">
        <p className="font-medium">
          {isDisabled
            ? "Public API access is disabled for this project."
            : "This project restricts public API access."}
        </p>
        <p className="text-xs">
          {isDisabled
            ? "The snippet below will return 403 until API access is enabled in the project settings."
            : domains.length
              ? `Only requests from ${domains.join(", ")} will be served. Requests from other origins return 403.`
              : "Only requests from allowed domains will be served."}
        </p>
      </div>
    </div>
  );
}

function BackLink(props: { name: string; projectId?: string }) {
  return (
    <div>
      <Link
        to="/dashboard/collections/$name"
        params={{ name: props.name }}
        search={{ page: 1, projectId: props.projectId, env: undefined }}
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-900"
      >
        <ArrowLeft className="h-4 w-4" />
        {props.name}
      </Link>
    </div>
  );
}

function CodePageSkeleton() {
  return (
    <section className="space-y-6">
      <Skeleton className="h-4 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </section>
  );
}
