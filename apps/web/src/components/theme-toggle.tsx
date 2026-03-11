import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={
        className ??
        "relative flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
      }
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 scale-100 transition dark:scale-0" />
      <Moon className="absolute h-4 w-4 scale-0 transition dark:scale-100" />
    </button>
  );
}
