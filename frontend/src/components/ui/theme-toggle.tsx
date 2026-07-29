import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/hooks/use-theme";
import { useI18n } from "@/lib/i18n/use-i18n";

export function ThemeToggle() {
  const t = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [isSwitching, setIsSwitching] = useState(false);
  const switchTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(switchTimeout.current), []);

  function handleClick() {
    toggleTheme();
    setIsSwitching(false);
    requestAnimationFrame(() => setIsSwitching(true));
    clearTimeout(switchTimeout.current);
    switchTimeout.current = setTimeout(() => setIsSwitching(false), 560);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={handleClick}
      data-theme={theme}
      aria-pressed={isDark}
      aria-label={isDark ? t.shell.switchToLight : t.shell.switchToDark}
      className={cn("theme-toggle", isSwitching && "is-switching")}
    >
      <Sun
        aria-hidden="true"
        className={cn("theme-icon", theme === "light" ? "text-ink opacity-100" : "text-ink-muted opacity-40")}
      />
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb" />
      </span>
      <Moon
        aria-hidden="true"
        className={cn("theme-icon", theme === "dark" ? "text-ink opacity-100" : "text-ink-muted opacity-40")}
      />
    </button>
  );
}
