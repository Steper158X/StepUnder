/** 245 -> "4:05", 3725 -> "1:02:05" */
export function formatTime(totalSeconds?: number | null): string {
  if (!totalSeconds || totalSeconds < 0 || !Number.isFinite(totalSeconds)) {
    return "0:00";
  }
  const seconds = Math.floor(totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = s.toString().padStart(2, "0");
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

export function formatCount(count: number | undefined, suffix: string) {
  if (!count) return `0 ${suffix}`;
  return `${count.toLocaleString()} ${suffix}`;
}

/** "2024-05-01T10:00:00Z" -> "2024" */
export function formatYear(value?: string | number | null): string {
  if (!value) return "";
  const text = String(value);
  const match = text.match(/^(\d{4})/);
  return match ? match[1] : "";
}

/** "2024-05-01T10:00:00Z" -> localized short date ("1 พ.ค. 2024"). */
export function formatDate(value?: string | null, locale?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
