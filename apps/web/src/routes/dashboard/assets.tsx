import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteAssetServerFn,
  requestAssetUploadServerFn,
  confirmAssetUploadServerFn,
} from "@/lib/assets-helpers";
import { projectsQueryOptions, assetsQueryOptions } from "@/lib/queries";
import { ALLOWED_ASSET_MIME_TYPES, MAX_ASSET_FILE_SIZE } from "@/lib/assets";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Check,
  Copy,
  File,
  FileText,
  Film,
  Image as ImageIcon,
  LoaderCircle,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/dashboard/assets" as never)({
  validateSearch: (search: Record<string, unknown>) => ({
    projectId:
      typeof search.projectId === "string" && search.projectId.length > 0
        ? search.projectId
        : undefined,
    type:
      typeof search.type === "string" &&
      ["images", "videos", "documents"].includes(search.type)
        ? (search.type as "images" | "videos" | "documents")
        : undefined,
  }),
  component: DashboardAssetsPage,
});

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function DashboardAssetsPage() {
  const queryClient = useQueryClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigate = useNavigate({ from: "/dashboard/assets" as any });
  const search = Route.useSearch() as {
    projectId?: string;
    type?: "images" | "videos" | "documents";
  };

  const projectsQuery = useQuery(projectsQueryOptions());
  const projects = projectsQuery.data ?? [];
  const selectedProjectId = search.projectId ?? "";
  const selectedType = search.type;

  // Auto-select first project when none is set
  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) {
      void navigate({
        search: ((current: Record<string, unknown>) => ({
          ...current,
          projectId: projects[0].id,
        })) as never,
        replace: true,
      });
    }
  }, [navigate, projects, selectedProjectId]);

  const effectiveProjectId = selectedProjectId || projects[0]?.id || "";

  const assetsQuery = useQuery(
    assetsQueryOptions(1, 100, effectiveProjectId || undefined),
  );

  const allAssets = assetsQuery.data?.items ?? [];
  const isLoading = projectsQuery.isLoading || assetsQuery.isLoading;

  // Client-side type filter
  const assets = useMemo(() => {
    if (!selectedType) return allAssets;
    return allAssets.filter((asset) => {
      if (selectedType === "images") return asset.contentType.startsWith("image/");
      if (selectedType === "videos") return asset.contentType.startsWith("video/");
      if (selectedType === "documents") return asset.contentType === "application/pdf";
      return true;
    });
  }, [allAssets, selectedType]);

  // Counts per type
  const typeCounts = useMemo(() => {
    let images = 0;
    let videos = 0;
    let documents = 0;
    for (const asset of allAssets) {
      if (asset.contentType.startsWith("image/")) images++;
      else if (asset.contentType.startsWith("video/")) videos++;
      else if (asset.contentType === "application/pdf") documents++;
    }
    return { all: allAssets.length, images, videos, documents };
  }, [allAssets]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["assets"] });
  }

  const projectName =
    projects.find((p) => p.id === effectiveProjectId)?.name ?? null;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">Assets</h2>
            {!isLoading && (
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium tabular-nums text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                {allAssets.length}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-stone-500">
            Upload project-scoped files for use in collection items and external
            content.
          </p>
        </div>
        <AssetUploadDialog
          projectId={effectiveProjectId}
          projectName={projectName}
          onUploaded={invalidate}
        />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-end gap-4">
        <label className="grid gap-1.5 min-w-[14rem] max-w-sm">
          <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
            Project
          </span>
          <select
            value={effectiveProjectId}
            onChange={(event) =>
              void navigate({
                search: ((current: Record<string, unknown>) => ({
                  ...current,
                  projectId: event.target.value || undefined,
                })) as never,
              })
            }
            className="rounded-lg border-2 border-stone-300 bg-white px-3 py-2.5 text-sm font-medium outline-none transition focus:border-stone-900 focus:ring-2 focus:ring-stone-900/20 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:focus:border-stone-400 dark:focus:ring-stone-400/20"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        {/* Type filter chips */}
        <div className="flex items-center gap-1.5">
          {(
            [
              { key: undefined, label: "All", count: typeCounts.all },
              { key: "images", label: "Images", count: typeCounts.images },
              { key: "videos", label: "Videos", count: typeCounts.videos },
              { key: "documents", label: "Docs", count: typeCounts.documents },
            ] as const
          ).map((chip) => {
            const isActive = selectedType === chip.key;
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() =>
                  void navigate({
                    search: ((current: Record<string, unknown>) => ({
                      ...current,
                      type: chip.key,
                    })) as never,
                  })
                }
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                }`}
              >
                {chip.label}
                <span
                  className={`tabular-nums ${isActive ? "text-stone-300 dark:text-stone-500" : "text-stone-400 dark:text-stone-500"}`}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <AssetsGridSkeleton />
      ) : (
        <AssetsGrid assets={assets} onDeleted={invalidate} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Assets Grid
// ---------------------------------------------------------------------------

function AssetsGrid(props: {
  assets: Array<{
    id: string;
    filename: string;
    contentType: string;
    publicUrl: string;
    size: number;
    createdAt: string;
  }>;
  onDeleted: () => void;
}) {
  const [selectedAsset, setSelectedAsset] = useState<
    (typeof props.assets)[number] | null
  >(null);

  if (!props.assets.length) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-14 text-center dark:border-stone-700 dark:bg-stone-900/60">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-stone-500 shadow-sm dark:bg-stone-800 dark:text-stone-400">
          <Upload className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-base font-medium text-stone-900 dark:text-stone-100">
          No assets yet
        </h3>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Upload your first file to create a project asset library.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {props.assets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            onClick={() => setSelectedAsset(asset)}
            className="group overflow-hidden rounded-xl border border-stone-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md dark:border-stone-800 dark:bg-stone-900"
          >
            <div className="flex aspect-[16/10] items-center justify-center overflow-hidden bg-gradient-to-br from-stone-100 via-stone-50 to-stone-200 dark:from-stone-900 dark:via-stone-800 dark:to-stone-900">
              {asset.contentType.startsWith("image/") ? (
                <img
                  src={asset.publicUrl}
                  alt={asset.filename}
                  className="h-full w-full object-cover"
                />
              ) : asset.contentType.startsWith("video/") ? (
                <video
                  src={asset.publicUrl}
                  className="h-full w-full object-cover"
                  muted
                  preload="metadata"
                />
              ) : (
                <AssetTypeIcon
                  contentType={asset.contentType}
                  className="h-10 w-10 text-stone-400 dark:text-stone-500"
                />
              )}
            </div>
            <div className="space-y-2 p-4">
              <div>
                <p className="line-clamp-1 text-sm font-medium text-stone-900 dark:text-stone-100">
                  {asset.filename}
                </p>
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  {formatAssetSize(asset.size)} &middot; {asset.contentType}
                </p>
              </div>
              <p className="text-xs text-stone-400 dark:text-stone-500">
                Added {new Date(asset.createdAt).toLocaleDateString()}
              </p>
            </div>
          </button>
        ))}
      </div>

      {selectedAsset ? (
        <AssetDetailsDialog
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onDeleted={() => {
            setSelectedAsset(null);
            props.onDeleted();
          }}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Upload Dialog (with drag-and-drop + progress)
// ---------------------------------------------------------------------------

function AssetUploadDialog(props: {
  projectId: string;
  projectName: string | null;
  onUploaded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const acceptedTypes = useMemo(() => ALLOWED_ASSET_MIME_TYPES.join(","), []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, pending]);

  function handleFileSelect(selectedFile: File | null) {
    if (!selectedFile) return;
    setError(null);

    if (
      !ALLOWED_ASSET_MIME_TYPES.includes(
        selectedFile.type as (typeof ALLOWED_ASSET_MIME_TYPES)[number],
      )
    ) {
      setError(`Unsupported file type: ${selectedFile.type || "unknown"}`);
      return;
    }

    if (selectedFile.size > MAX_ASSET_FILE_SIZE) {
      setError(
        `File is too large (${formatAssetSize(selectedFile.size)}). Max 10MB.`,
      );
      return;
    }

    setFile(selectedFile);
  }

  // Drag-and-drop handlers
  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current++;
    if (event.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);

      const droppedFile = event.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!props.projectId) {
      setError("Select a project before uploading assets.");
      return;
    }

    if (!file) {
      setError("Choose a file to upload.");
      return;
    }

    setPending(true);
    setError(null);
    setUploadProgress(0);

    try {
      const request = await requestAssetUploadServerFn({
        data: {
          projectId: props.projectId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        },
      });

      // Upload with XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", request.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed (${xhr.status}).`));
          }
        });

        xhr.addEventListener("error", () =>
          reject(new Error("Upload failed. Check your network connection.")),
        );

        xhr.send(file);
      });

      await confirmAssetUploadServerFn({ data: { id: request.assetId } });

      setFile(null);
      setUploadProgress(0);
      setOpen(false);
      props.onUploaded();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload asset.",
      );
    } finally {
      setPending(false);
    }
  }

  function handleClose() {
    if (pending) return;
    setOpen(false);
    setFile(null);
    setError(null);
    setUploadProgress(0);
    dragCounter.current = 0;
    setIsDragging(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
      >
        <Plus className="h-4 w-4" />
        Upload asset
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) handleClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Upload asset"
        >
          <div className="w-full max-w-xl rounded-xl border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">
                  Upload asset
                </h3>
                <p className="mt-1 text-sm text-stone-500">
                  Upload to {props.projectName ?? "the selected project"}.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-stone-800 dark:hover:text-stone-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
              {/* Drag-and-drop zone */}
              <label
                className={`relative grid cursor-pointer gap-3 rounded-xl border-2 border-dashed p-6 text-center transition ${
                  isDragging
                    ? "border-stone-900 bg-stone-100 dark:border-stone-400 dark:bg-stone-800"
                    : file
                      ? "border-stone-400 bg-stone-50 dark:border-stone-600 dark:bg-stone-800/40"
                      : "border-stone-300 bg-stone-50 hover:border-stone-400 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800/40 dark:hover:border-stone-600 dark:hover:bg-stone-800"
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {file ? (
                  <>
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300">
                      <AssetTypeIcon
                        contentType={file.type}
                        className="h-5 w-5"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                        {file.name}
                      </p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {formatAssetSize(file.size)} &middot; {file.type}
                      </p>
                    </div>
                    {!pending && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setFile(null);
                        }}
                        className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-200 hover:text-stone-700 dark:hover:bg-stone-700 dark:hover:text-stone-200"
                        aria-label="Remove file"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-stone-200 text-stone-500 dark:bg-stone-700 dark:text-stone-400">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-700 dark:text-stone-200">
                        {isDragging
                          ? "Drop your file here"
                          : "Drag & drop or click to browse"}
                      </p>
                      <p className="mt-0.5 text-xs text-stone-400">
                        Images, PDFs, and videos up to 10MB
                      </p>
                    </div>
                  </>
                )}
                <input
                  type="file"
                  accept={acceptedTypes}
                  onChange={(event) =>
                    handleFileSelect(event.target.files?.[0] ?? null)
                  }
                  className="sr-only"
                />
              </label>

              {/* Upload progress bar */}
              {pending && uploadProgress > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span>Uploading...</span>
                    <span className="tabular-nums">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                    <div
                      className="h-full rounded-full bg-stone-900 transition-all duration-300 ease-out dark:bg-stone-100"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {error ? (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3 border-t border-stone-200 pt-4 dark:border-stone-800">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={pending}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-stone-700 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !file || file.size > MAX_ASSET_FILE_SIZE}
                  className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
                >
                  {pending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : null}
                  {pending ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Asset Details Dialog
// ---------------------------------------------------------------------------

function AssetDetailsDialog(props: {
  asset: {
    id: string;
    filename: string;
    contentType: string;
    publicUrl: string;
    size: number;
    createdAt: string;
  };
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [pendingDelete, setPendingDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pendingDelete) {
        props.onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pendingDelete, props]);

  async function handleDelete() {
    if (!confirm(`Delete asset "${props.asset.filename}"?`)) {
      return;
    }

    setPendingDelete(true);

    try {
      await deleteAssetServerFn({ data: { id: props.asset.id } });
      props.onDeleted();
    } finally {
      setPendingDelete(false);
    }
  }

  function handleCopyUrl() {
    void navigator.clipboard.writeText(props.asset.publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          props.onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Asset details"
    >
      <div className="w-full max-w-xl rounded-xl border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-900">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold tracking-tight">
              {props.asset.filename}
            </h3>
            <p className="mt-1 text-sm text-stone-500">
              {props.asset.contentType}
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Preview */}
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-800/40">
            {props.asset.contentType.startsWith("image/") ? (
              <img
                src={props.asset.publicUrl}
                alt={props.asset.filename}
                className="max-h-80 w-full object-contain"
              />
            ) : props.asset.contentType.startsWith("video/") ? (
              <video
                src={props.asset.publicUrl}
                controls
                className="max-h-80 w-full"
                preload="metadata"
              >
                <track kind="captions" />
              </video>
            ) : (
              <div className="flex h-48 items-center justify-center">
                <AssetTypeIcon
                  contentType={props.asset.contentType}
                  className="h-10 w-10 text-stone-400"
                />
              </div>
            )}
          </div>

          {/* Metadata */}
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Size" value={formatAssetSize(props.asset.size)} />
            <Detail
              label="Uploaded"
              value={new Date(props.asset.createdAt).toLocaleString()}
            />
            <Detail label="Asset ID" value={props.asset.id} mono />
            <Detail
              label="Public URL"
              value={props.asset.publicUrl}
              mono
            />
          </dl>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-stone-200 pt-4 dark:border-stone-800">
          <button
            type="button"
            onClick={handleCopyUrl}
            className="inline-flex items-center gap-2 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium transition hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-green-600 dark:text-green-400">
                  Copied
                </span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy URL
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={pendingDelete}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingDelete ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {pendingDelete ? "Deleting..." : "Delete asset"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function AssetsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
        >
          <Skeleton className="aspect-[16/10] w-full" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function AssetTypeIcon(props: { contentType: string; className?: string }) {
  if (props.contentType.startsWith("image/")) {
    return <ImageIcon className={props.className} />;
  }

  if (props.contentType.startsWith("video/")) {
    return <Film className={props.className} />;
  }

  if (props.contentType === "application/pdf") {
    return <FileText className={props.className} />;
  }

  return <File className={props.className} />;
}

function Detail(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-800 dark:bg-stone-800/30">
      <dt className="text-xs uppercase tracking-wide text-stone-400 dark:text-stone-500">
        {props.label}
      </dt>
      <dd
        className={`mt-1 break-all text-sm text-stone-800 dark:text-stone-100 ${props.mono ? "font-mono text-xs" : ""}`}
      >
        {props.value}
      </dd>
    </div>
  );
}

function formatAssetSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
