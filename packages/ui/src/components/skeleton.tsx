function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={`rounded-md ${className ?? ""}`.trim()}
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--skeleton-from, #e7e5e4) 0%, var(--skeleton-via, #d6d3d1) 40%, var(--skeleton-from, #e7e5e4) 80%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.8s ease-in-out infinite",
      }}
      {...props}
    />
  )
}

export { Skeleton }
