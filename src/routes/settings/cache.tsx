import { Show, createResource, createSignal } from "solid-js";
import { FolderOpen, Trash2 } from "lucide-solid";
import { t } from "~/i18n";
import {
  COVER_CACHE_DAYS,
  COVER_CACHE_SIZES_MB,
  coverCacheEnabled,
  coverCacheMaxDays,
  coverCacheMaxMb,
  setCoverCacheEnabled,
  setCoverCacheMaxDays,
  setCoverCacheMaxMb,
} from "~/state/settings";
import {
  clearCoverCache,
  configuredRevision,
  coverCacheDir,
  coverCacheStats,
} from "~/state/cover-cache";
import { revealDownload } from "~/state/downloads";
import { formatBytes } from "~/lib/format";
import { isTauri } from "~/lib/platform";
import { cn } from "~/lib/utils";
import { EmptyState } from "~/components/common";
import { toast } from "~/components/toaster";
import { Button } from "~/components/ui/button";
import { Select } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Row, SettingsSection, SettingsSubPage } from "./shared";

const MB = 1024 * 1024;

function sizeLabel(mb: number) {
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
}

function daysLabel(days: number) {
  if (days === 0) return t("settings.coverCacheNever");
  if (days === 1) return t("settings.coverCacheOneDay");
  return t("settings.coverCacheDays", { count: days });
}

export default function CacheSettingsPage() {
  const [clearing, setClearing] = createSignal(false);
  // Re-measured after clearing and once new settings were applied (which
  // trims the cache to the size limit).
  const [stats, { refetch }] = createResource(
    () => (isTauri ? configuredRevision() + 1 : undefined),
    () => coverCacheStats(),
  );

  const usedPercent = () => {
    const used = stats()?.bytes ?? 0;
    return Math.min(100, (used / (coverCacheMaxMb() * MB)) * 100);
  };

  async function clear() {
    setClearing(true);
    try {
      await clearCoverCache();
      toast(t("settings.coverCacheCleared"), undefined, "default");
    } catch (error) {
      toast(t("settings.coverCacheClearFailed"), String(error), "error");
    } finally {
      setClearing(false);
      void refetch();
    }
  }

  async function openFolder() {
    try {
      await revealDownload(await coverCacheDir());
    } catch (error) {
      toast(t("download.openFailed"), String(error), "error");
    }
  }

  return (
    <Show
      when={isTauri}
      fallback={
        <SettingsSubPage title={t("settings.cache")}>
          <EmptyState title={t("settings.cacheDesktopOnly")} class="my-4" />
        </SettingsSubPage>
      }
    >
      <SettingsSubPage
        title={t("settings.cache")}
        sections={
          <SettingsSection title={t("settings.coverCacheUsage")}>
            <div class="space-y-2 py-3.5">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <p class="text-sm font-medium">
                  {t("settings.coverCacheUsed")}
                </p>
                <p class="text-xs tabular-nums text-muted-foreground">
                  {t("settings.coverCacheSummary", {
                    count: stats()?.files ?? 0,
                    size: formatBytes(stats()?.bytes) || "0 KB",
                    limit: sizeLabel(coverCacheMaxMb()),
                  })}
                </p>
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  class={cn(
                    "h-full rounded-full transition-[width]",
                    usedPercent() > 90 ? "bg-amber-500" : "bg-primary",
                  )}
                  style={{ width: `${usedPercent()}%` }}
                />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 py-3.5 md:flex md:flex-wrap md:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void openFolder()}
              >
                <FolderOpen class="size-3.5" />
                {t("settings.coverCacheOpenFolder")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="hover:text-destructive"
                disabled={clearing() || !stats()?.files}
                onClick={() => void clear()}
              >
                <Trash2 class="size-3.5" />
                {t("settings.coverCacheClear")}
              </Button>
            </div>
          </SettingsSection>
        }
      >
        <Row
          label={t("settings.coverCacheEnabled")}
          description={t("settings.coverCacheEnabledHint")}
          inline
        >
          <Switch
            checked={coverCacheEnabled()}
            onChange={setCoverCacheEnabled}
            label={t("settings.coverCacheEnabled")}
          />
        </Row>

        <Row
          label={t("settings.coverCacheMaxSize")}
          description={t("settings.coverCacheMaxSizeHint")}
        >
          <div class="w-full md:w-44">
            <Select
              aria-label={t("settings.coverCacheMaxSize")}
              value={String(coverCacheMaxMb())}
              disabled={!coverCacheEnabled()}
              options={COVER_CACHE_SIZES_MB.map((mb) => ({
                value: String(mb),
                label: sizeLabel(mb),
              }))}
              onChange={(value) => setCoverCacheMaxMb(Number(value))}
            />
          </div>
        </Row>

        <Row
          label={t("settings.coverCacheMaxAge")}
          description={t("settings.coverCacheMaxAgeHint")}
        >
          <div class="w-full md:w-44">
            <Select
              aria-label={t("settings.coverCacheMaxAge")}
              value={String(coverCacheMaxDays())}
              disabled={!coverCacheEnabled()}
              options={COVER_CACHE_DAYS.map((days) => ({
                value: String(days),
                label: daysLabel(days),
              }))}
              onChange={(value) => setCoverCacheMaxDays(Number(value))}
            />
          </div>
        </Row>
      </SettingsSubPage>
    </Show>
  );
}
