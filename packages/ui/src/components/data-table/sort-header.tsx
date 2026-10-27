"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"
import type { SortState } from "./types"

type SortHeaderProps = {
  label: React.ReactNode
  columnId: string
  sort: SortState
  onToggle: (columnId: string) => void
  className?: string
}

/**
 * A clickable column header that toggles `asc → desc → none` on the
 * referenced column. Renders a small arrow icon to indicate state.
 */
export function SortHeader({ label, columnId, sort, onToggle, className }: SortHeaderProps) {
  const active = sort?.by === columnId
  const order = active ? sort?.order : null

  return (
    <button
      type="button"
      onClick={() => onToggle(columnId)}
      className={cn(
        "group inline-flex items-center gap-1 text-left font-medium text-stone-600 transition hover:text-stone-900",
        active && "text-stone-900",
        className,
      )}
      aria-sort={order === "asc" ? "ascending" : order === "desc" ? "descending" : "none"}
    >
      {label}
      <span
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center text-stone-400 group-hover:text-stone-600",
          active && "text-stone-700",
        )}
        aria-hidden="true"
      >
        {order === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : order === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100" />
        )}
      </span>
    </button>
  )
}
