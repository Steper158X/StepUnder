import { Match, Show, Switch } from "solid-js";
import { AlertCircle, ArrowDownToLine, CircleCheck, Download } from "lucide-solid";
import type { Song } from "~/lib/types";
import {
  useDownloads,
  type DownloadJob,
  type DownloadStatus,
} from "~/state/downloads";
import { t } from "~/i18n";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

/** 0–1 when the size is known, otherwise null. */
export function jobProgress(job: DownloadJob): number | null {
  return job.total ? Math.min(1, job.received / job.total) : null;
}

function progressOf(status: DownloadStatus): number | null {
  return status.state === "done" ? null : jobProgress(status.job);
}

/** Small ring that fills as a download progresses. */
export function ProgressRing(props: { value: number | null; class?: string }) {
  const radius = 6;
  const length = 2 * Math.PI * radius;
  return (
    <svg
      viewBox="0 0 16 16"
      class={cn("size-3.5", props.value === null && "animate-spin", props.class)}
    >
      <circle
        cx="8"
        cy="8"
        r={radius}
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="opacity-25"
      />
      <circle
        cx="8"
        cy="8"
        r={radius}
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-dasharray={String(length)}
        stroke-dashoffset={String(length * (1 - (props.value ?? 0.25)))}
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}

/** Shows whether a song is downloaded, downloading or failed; nothing otherwise. */
export function DownloadIndicator(props: { song: Song; class?: string }) {
  const downloads = useDownloads();
  const status = () => downloads.status(props.song);

  return (
    <Show when={status()}>
      {(current) => (
        <span
          class={cn("flex items-center p-1.5 max-md:p-2", props.class)}
          title={t(
            current().state === "done"
              ? "download.downloaded"
              : current().state === "error"
                ? "download.failed"
                : "download.downloading",
          )}
        >
          <Switch>
            <Match when={current().state === "done"}>
              <CircleCheck class="size-3.5 text-primary" />
            </Match>
            <Match when={current().state === "error"}>
              <AlertCircle class="size-3.5 text-destructive" />
            </Match>
            <Match when={current().state === "queued"}>
              <ArrowDownToLine class="size-3.5 animate-pulse text-muted-foreground" />
            </Match>
            <Match when={current().state === "downloading"}>
              <ProgressRing value={progressOf(current())} class="text-primary" />
            </Match>
          </Switch>
        </span>
      )}
    </Show>
  );
}

/** Icon button for album and playlist headers: downloads every song. */
export function DownloadAllButton(props: { songs: Song[]; class?: string }) {
  const downloads = useDownloads();
  const allDone = () =>
    props.songs.length > 0 &&
    props.songs.every((song) => downloads.isDownloaded(song));

  return (
    <Show when={downloads.available}>
      <Button
        variant="ghost"
        size="icon"
        class={cn("shrink-0", allDone() && "text-primary", props.class)}
        onClick={() => downloads.download(props.songs)}
        disabled={!props.songs.length || allDone()}
        title={t(allDone() ? "download.allDownloaded" : "download.downloadAll")}
        aria-label={t(allDone() ? "download.allDownloaded" : "download.downloadAll")}
      >
        <Show when={allDone()} fallback={<Download class="size-4" />}>
          <CircleCheck class="size-4" />
        </Show>
      </Button>
    </Show>
  );
}
