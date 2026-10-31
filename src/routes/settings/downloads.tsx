import { Show, createResource, createSignal } from "solid-js";
import { FolderOpen, RotateCcw, Trash2 } from "lucide-solid";
import { t } from "~/i18n";
import {
  MAX_DOWNLOAD_CONCURRENCY,
  downloadBitRate,
  downloadConcurrency,
  downloadDir,
  downloadFormat,
  downloadLayout,
  downloadOnStar,
  preferLocal,
  setDownloadBitRate,
  setDownloadConcurrency,
  setDownloadDir,
  setDownloadFormat,
  setDownloadLayout,
  setDownloadOnStar,
  setPreferLocal,
  type DownloadLayout,
  type StreamFormat,
} from "~/state/settings";
import {
  downloadDiskSpace,
  downloadEntries,
  downloadedBytes,
  pickDownloadDir,
  removeAllDownloads,
  resolveDownloadDir,
  revealDownload,
} from "~/state/downloads";
import { formatBytes } from "~/lib/format";
import { isTauri } from "~/lib/platform";
import { cn } from "~/lib/utils";
import { EmptyState } from "~/components/common";
import { Button } from "~/components/ui/button";
import { Select } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Row, SettingsSection, SettingsSubPage } from "./shared";

const formatOptions: StreamFormat[] = ["raw", "mp3", "opus", "aac", "flac"];

const bitrateOptions = [0, 320, 256, 192, 128];

const layoutOptions: Array<{ value: DownloadLayout; example: string }> = [
  { value: "artist-album", example: "Artist/Album/01 - Title" },
  { value: "album", example: "Album/01 - Title" },
  { value: "flat", example: "Artist - Title" },
];

export default function DownloadSettingsPage() {
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [removing, setRemoving] = createSignal(false);
  const [folder] = createResource(
    () => (isTauri ? downloadDir() || "default" : undefined),
    () => resolveDownloadDir(),
  );

  // Re-measured when the folder changes or a download finishes or is removed.
  const [disk] = createResource(
    () => {
      const path = folder();
      return path ? { path, count: downloadEntries().length } : undefined;
    },
    ({ path }) => downloadDiskSpace(path).catch(() => null),
  );
  const usedPercent = () => {
    const space = disk();
    return space && space.total
      ? ((space.total - space.available) / space.total) * 100
      : 0;
  };

  async function changeFolder() {
    const picked = await pickDownloadDir();
    if (picked) setDownloadDir(picked);
  }

  async function removeAll() {
    setRemoving(true);
    try {
      await removeAllDownloads();
      setConfirmOpen(false);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Show
      when={isTauri}
      fallback={
        <SettingsSubPage title={t("settings.downloads")}>
          <EmptyState title={t("downloads.desktopOnly")} class="my-4" />
        </SettingsSubPage>
      }
    >
      <SettingsSubPage
        title={t("settings.downloads")}
        sections={
          <SettingsSection title={t("settings.downloadStorage")}>
            <Show when={disk()}>
              {(space) => (
                <div class="space-y-2 py-3.5">
                  <div class="flex flex-wrap items-baseline justify-between gap-2">
                    <p class="text-sm font-medium">
                      {t("settings.downloadDrive", { drive: space().drive })}
                    </p>
                    <p class="text-xs tabular-nums text-muted-foreground">
                      {t("settings.downloadDriveFree", {
                        free: formatBytes(space().available) || "0 KB",
                        total: formatBytes(space().total),
                      })}
                    </p>
                  </div>
                  <div class="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      class={cn(
                        "h-full rounded-full",
                        usedPercent() > 90 ? "bg-destructive" : "bg-primary",
                      )}
                      style={{ width: `${usedPercent()}%` }}
                    />
                  </div>
                </div>
              )}
            </Show>
            <Row
              label={t("settings.downloadUsed")}
              description={t("downloads.summary", {
                count: downloadEntries().length,
                size: formatBytes(downloadedBytes()) || "0 KB",
              })}
            >
              <Button
                variant="outline"
                size="sm"
                class="hover:text-destructive"
                disabled={!downloadEntries().length}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 class="size-3.5" />
                {t("download.removeAll")}
              </Button>
            </Row>
          </SettingsSection>
        }
      >
        <Row
          label={t("settings.downloadFolder")}
          description={folder() ?? t("settings.audioDeviceLoading")}
          class="[&_p:last-child]:break-all"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => void changeFolder()}
          >
            {t("settings.downloadFolderChange")}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            title={t("download.openFolder")}
            aria-label={t("download.openFolder")}
            disabled={!folder()}
            onClick={() => void revealDownload(folder()!)}
          >
            <FolderOpen class="size-3.5" />
          </Button>
          <Show when={downloadDir()}>
            <Button
              variant="ghost"
              size="icon-sm"
              title={t("settings.downloadFolderReset")}
              aria-label={t("settings.downloadFolderReset")}
              onClick={() => setDownloadDir("")}
            >
              <RotateCcw class="size-3.5" />
            </Button>
          </Show>
        </Row>

        <Row
          label={t("settings.preferLocal")}
          description={t("settings.preferLocalHint")}
        >
          <Switch
            checked={preferLocal()}
            onChange={setPreferLocal}
            label={t("settings.preferLocal")}
          />
        </Row>

        <Row
          label={t("settings.downloadFormat")}
          description={t("settings.downloadFormatHint")}
        >
          <div class="w-44">
            <Select
              aria-label={t("settings.downloadFormat")}
              value={downloadFormat()}
              options={formatOptions.map((value) => ({
                value,
                label:
                  value === "raw"
                    ? t("settings.downloadFormatRaw")
                    : value.toUpperCase(),
              }))}
              onChange={(value) => setDownloadFormat(value as StreamFormat)}
            />
          </div>
        </Row>

        <Show when={downloadFormat() !== "raw"}>
          <Row
            label={t("settings.downloadBitrate")}
            description={t("settings.downloadBitrateHint")}
          >
            <div class="w-44">
              <Select
                aria-label={t("settings.downloadBitrate")}
                value={String(downloadBitRate())}
                options={bitrateOptions.map((value) => ({
                  value: String(value),
                  label:
                    value === 0
                      ? t("settings.bitrateOriginal")
                      : `${value} kbps`,
                }))}
                onChange={(value) => setDownloadBitRate(Number(value))}
              />
            </div>
          </Row>
        </Show>

        <Row
          label={t("settings.downloadLayout")}
          description={t("settings.downloadLayoutHint")}
        >
          <div class="w-56">
            <Select
              aria-label={t("settings.downloadLayout")}
              value={downloadLayout()}
              options={layoutOptions.map((option) => ({
                value: option.value,
                label: option.example,
              }))}
              onChange={(value) => setDownloadLayout(value as DownloadLayout)}
            />
          </div>
        </Row>

        <Row
          label={t("settings.downloadConcurrency")}
          description={t("settings.downloadConcurrencyHint")}
        >
          <div class="w-44">
            <Select
              aria-label={t("settings.downloadConcurrency")}
              value={String(downloadConcurrency())}
              options={Array.from(
                { length: MAX_DOWNLOAD_CONCURRENCY },
                (_, index) => ({
                  value: String(index + 1),
                  label: String(index + 1),
                }),
              )}
              onChange={(value) => setDownloadConcurrency(Number(value))}
            />
          </div>
        </Row>

        <Row
          label={t("settings.downloadOnStar")}
          description={t("settings.downloadOnStarHint")}
        >
          <Switch
            checked={downloadOnStar()}
            onChange={setDownloadOnStar}
            label={t("settings.downloadOnStar")}
          />
        </Row>
      </SettingsSubPage>

      <Dialog
        open={confirmOpen()}
        onOpenChange={(open) => !removing() && setConfirmOpen(open)}
      >
        <DialogContent class="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("download.removeAllTitle")}</DialogTitle>
            <DialogDescription>
              {t("download.removeAllDescription", {
                count: downloadEntries().length,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={removing()}
            >
              {t("action.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void removeAll()}
              disabled={removing()}
            >
              <Trash2 class="size-4" />
              {t("action.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Show>
  );
}
