import { For, Show, createMemo, createSignal } from "solid-js";
import {
  Download,
  FolderOpen,
  Play,
  RotateCw,
  Settings,
  Shuffle,
  Trash2,
  X,
} from "lucide-solid";
import { A } from "@solidjs/router";
import type { Song } from "~/lib/types";
import { useServers } from "~/state/servers";
import { usePlayer } from "~/player/store";
import {
  cancelDownloads,
  downloadEntries,
  downloadJobs,
  removeDownloads,
  resolveDownloadDir,
  revealDownload,
  useDownloads,
  type DownloadJob,
} from "~/state/downloads";
import { t } from "~/i18n";
import { formatBytes } from "~/lib/format";
import { isTauri } from "~/lib/platform";
import { Page, PageHeader, Section } from "~/components/layout-bits";
import { TrackList } from "~/components/track-row";
import { Cover, EmptyState } from "~/components/common";
import { jobProgress } from "~/components/download-status";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function JobRow(props: { job: DownloadJob }) {
  const downloads = useDownloads();
  const progress = () => jobProgress(props.job);
  const detail = () => {
    if (props.job.state === "error") return props.job.error ?? t("download.failed");
    if (props.job.state === "queued") return t("download.queued");
    const received = formatBytes(props.job.received) || "0 KB";
    return props.job.total
      ? `${received} / ${formatBytes(props.job.total)}`
      : received;
  };

  return (
    <div class="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5">
      <Cover
        coverArtId={props.job.song.coverArt}
        size={64}
        alt={props.job.song.album ?? props.job.song.title}
        class="size-8 rounded"
      />
      <div class="min-w-0 space-y-1">
        <div class="flex min-w-0 items-baseline justify-between gap-2">
          <p class="truncate text-sm font-medium">{props.job.song.title}</p>
          <span
            class={
              props.job.state === "error"
                ? "max-w-[50%] truncate text-xs text-destructive"
                : "shrink-0 text-xs tabular-nums text-muted-foreground"
            }
            title={detail()}
          >
            {detail()}
          </span>
        </div>
        <div class="h-1 overflow-hidden rounded-full bg-secondary">
          <div
            class={
              props.job.state === "error"
                ? "h-full bg-destructive"
                : progress() === null && props.job.state === "downloading"
                  ? "h-full w-1/3 animate-pulse bg-primary"
                  : "h-full bg-primary transition-[width] duration-300"
            }
            style={
              progress() !== null
                ? { width: `${(progress() ?? 0) * 100}%` }
                : props.job.state === "error"
                  ? { width: "100%" }
                  : undefined
            }
          />
        </div>
      </div>
      <div class="flex items-center">
        <Show when={props.job.state === "error"}>
          <Button
            variant="ghost"
            size="icon-sm"
            title={t("download.retry")}
            aria-label={t("download.retry")}
            onClick={() => downloads.download([props.job.song])}
          >
            <RotateCw class="size-3.5" />
          </Button>
        </Show>
        <Button
          variant="ghost"
          size="icon-sm"
          title={t(props.job.state === "error" ? "action.close" : "download.cancel")}
          aria-label={t(
            props.job.state === "error" ? "action.close" : "download.cancel",
          )}
          onClick={() => void cancelDownloads([props.job.key])}
        >
          <X class="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function DownloadsPage() {
  const servers = useServers();
  const player = usePlayer();
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [removing, setRemoving] = createSignal(false);

  const entries = createMemo(() =>
    downloadEntries()
      .filter((entry) => entry.serverId === servers.activeId())
      .sort((a, b) => b.downloadedAt - a.downloadedAt),
  );
  const songs = createMemo<Song[]>(() => entries().map((entry) => entry.song));
  const jobs = createMemo(() =>
    downloadJobs().filter((job) => job.serverId === servers.activeId()),
  );
  const totalBytes = () =>
    entries().reduce((sum, entry) => sum + entry.size, 0);

  function playSongs(list: Song[]) {
    if (!list.length) return;
    player.playNow(list, 0, t("downloads.title"));
  }

  async function removeAll() {
    setRemoving(true);
    try {
      await removeDownloads(entries().map((entry) => entry.key));
      setConfirmOpen(false);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Page>
      <PageHeader
        title={t("downloads.title")}
        subtitle={
          songs().length
            ? t("downloads.summary", {
                count: songs().length,
                size: formatBytes(totalBytes()),
              })
            : t("downloads.subtitle")
        }
        actions={
          <div class="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={!songs().length}
              onClick={() => playSongs(songs())}
            >
              <Play class="size-4 fill-current" />
              {t("action.play")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!songs().length}
              onClick={() => playSongs(shuffled(songs()))}
            >
              <Shuffle class="size-3.5" />
              {t("action.shuffle")}
            </Button>
            <Show when={isTauri}>
              <Button
                variant="ghost"
                size="icon-sm"
                title={t("download.openFolder")}
                aria-label={t("download.openFolder")}
                onClick={() =>
                  void resolveDownloadDir().then((dir) => revealDownload(dir))
                }
              >
                <FolderOpen class="size-4" />
              </Button>
            </Show>
            <A
              href="/settings/downloads"
              class={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              title={t("settings.downloads")}
              aria-label={t("settings.downloads")}
            >
              <Settings class="size-4" />
            </A>
          </div>
        }
      />

      <Show
        when={isTauri}
        fallback={
          <EmptyState
            icon={<Download class="size-5" />}
            title={t("downloads.desktopOnly")}
          />
        }
      >
        <Show when={jobs().length}>
          <Section
            title={t("downloads.inProgress", { count: jobs().length })}
            class="mb-6"
          >
            <div class="flex flex-col gap-0.5">
              <For each={jobs()}>{(job) => <JobRow job={job} />}</For>
            </div>
          </Section>
        </Show>

        <Show
          when={songs().length}
          fallback={
            <Show when={!jobs().length}>
              <EmptyState
                icon={<Download class="size-5" />}
                title={t("downloads.empty")}
                description={t("downloads.emptyHint")}
              />
            </Show>
          }
        >
          <Section
            title={t("downloads.downloaded")}
            action={
              <Button
                variant="ghost"
                size="sm"
                class="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 class="size-3.5" />
                {t("download.removeAll")}
              </Button>
            }
          >
            <TrackList
              songs={songs()}
              sourceName={t("downloads.title")}
              showCover
              showAlbum
            />
          </Section>
        </Show>
      </Show>

      <Dialog
        open={confirmOpen()}
        onOpenChange={(open) => !removing() && setConfirmOpen(open)}
      >
        <DialogContent class="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("download.removeAllTitle")}</DialogTitle>
            <DialogDescription>
              {t("download.removeAllDescription", { count: songs().length })}
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
    </Page>
  );
}
