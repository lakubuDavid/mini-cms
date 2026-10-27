"use client"

import { ArrowLeft, ArrowRight, Info } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { DEFAULT_PAGE_SIZES } from "./types"

type DataTablePaginationProps = {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  /** Optional list of allowed page sizes; defaults to 10/25/50. */
  pageSizes?: readonly number[]
  /** Optional override for the tooltip text. */
  pageSizeTooltip?: string
}

/**
 * Pagination bar that sits below the table: "Showing N items · Page X of
 * Y" on the left, page-size `<Select>` (with an `(i)` tooltip) + prev/next
 * on the right.
 */
export function DataTablePagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizes = DEFAULT_PAGE_SIZES,
  pageSizeTooltip = "Choose how many items to show per page. Larger page sizes load more data and may take longer to fetch.",
}: DataTablePaginationProps) {
  const safePage = Math.max(1, Math.min(page, Math.max(1, totalPages)))
  const canPrev = safePage > 1
  const canNext = safePage < totalPages

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-sm">
      <span className="text-stone-500">
        {total === 0
          ? "No items"
          : `Showing ${total} ${total === 1 ? "item" : "items"} · Page ${safePage} of ${Math.max(1, totalPages)}`}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-stone-500">
          <span className="hidden sm:inline">Rows per page</span>
          <span className="sm:hidden">Rows</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(parseInt(value, 10))}
          >
            <SelectTrigger size="sm" className="w-20" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-stone-400 transition hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="About rows per page"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{pageSizeTooltip}</TooltipContent>
          </Tooltip>
        </label>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={!canPrev}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition",
              canPrev
                ? "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                : "pointer-events-none border-stone-100 text-stone-300",
            )}
            aria-label="Previous page"
          >
            <ArrowLeft className="h-3 w-3" />
            <span className="hidden sm:inline">Prev</span>
          </button>
          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={!canNext}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition",
              canNext
                ? "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                : "pointer-events-none border-stone-100 text-stone-300",
            )}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
